import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FastingSettings } from '@/types/db';

// Imported from the root layout so it is registered before any notification can arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const FASTING_START_ID = 'fasting-window-start';
const FASTING_END_ID = 'fasting-window-end';
const FASTING_CHANNEL_ID = 'fasting';

export type ScheduleResult = 'scheduled' | 'disabled' | 'denied' | 'unsupported';

// Android 8+ delivers notifications only through a channel, and Android 13+ won't even show
// the permission prompt until one exists, so create it before asking.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(FASTING_CHANNEL_ID, {
    name: 'Fasting reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Parses "H:MM"/"HH:MM"(:SS) into a valid 24h time, or null. */
export function parseHHMM(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

export async function cancelFastingNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(FASTING_START_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(FASTING_END_ID).catch(() => undefined);
}

export async function scheduleFastingNotifications(settings: FastingSettings): Promise<ScheduleResult> {
  if (Platform.OS === 'web') return 'unsupported';
  await cancelFastingNotifications();
  if (!settings.enabled || (!settings.notify_start && !settings.notify_end)) return 'disabled';
  const start = parseHHMM(settings.eating_window_start);
  if (!start) throw new Error(`Invalid eating window start "${settings.eating_window_start}"`);
  if (!(await ensureNotificationPermissions())) return 'denied';

  const endTotal = (start.hour * 60 + start.minute + settings.eating_window_minutes) % (24 * 60);
  const end = { hour: Math.floor(endTotal / 60), minute: endTotal % 60 };
  const daily = (t: { hour: number; minute: number }) => ({
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: t.hour,
    minute: t.minute,
    channelId: FASTING_CHANNEL_ID,
  } as const);

  if (settings.notify_start) {
    await Notifications.scheduleNotificationAsync({
      identifier: FASTING_START_ID,
      content: { title: 'Eating window open', body: 'Your eating window has started. Time to refuel.' },
      trigger: daily(start),
    });
  }
  if (settings.notify_end) {
    await Notifications.scheduleNotificationAsync({
      identifier: FASTING_END_ID,
      content: { title: 'Fasting starts now', body: 'Eating window closed. Fasting begins.' },
      trigger: daily(end),
    });
  }

  if (__DEV__) {
    const queued = await Notifications.getAllScheduledNotificationsAsync();
    console.log(
      '[notifications] scheduled:',
      JSON.stringify(queued.map((n) => ({ id: n.identifier, trigger: n.trigger }))),
    );
  }
  return 'scheduled';
}
