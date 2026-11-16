import * as Notifications from 'expo-notifications';
import type { FastingSettings } from '@/types/db';

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

export async function ensureNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function parseHHMM(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 12, minute: Number.isFinite(m) ? m : 0 };
}

export async function cancelFastingNotifications(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FASTING_START_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(FASTING_END_ID).catch(() => undefined);
}

export async function scheduleFastingNotifications(settings: FastingSettings): Promise<void> {
  await cancelFastingNotifications();
  if (!settings.enabled) return;
  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  const start = parseHHMM(settings.eating_window_start);
  const endTotal = (start.hour * 60 + start.minute + settings.eating_window_minutes) % (24 * 60);
  const end = { hour: Math.floor(endTotal / 60), minute: endTotal % 60 };

  if (settings.notify_start) {
    await Notifications.scheduleNotificationAsync({
      identifier: FASTING_START_ID,
      content: { title: 'Eating window open', body: 'Your eating window has started. Time to refuel.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: start.hour,
        minute: start.minute,
      },
    });
  }
  if (settings.notify_end) {
    await Notifications.scheduleNotificationAsync({
      identifier: FASTING_END_ID,
      content: { title: 'Fasting starts now', body: 'Eating window closed. Fasting begins.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: end.hour,
        minute: end.minute,
      },
    });
  }
}
