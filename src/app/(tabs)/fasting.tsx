import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Pill, Screen } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { parseHHMM, scheduleFastingNotifications, type ScheduleResult } from '@/lib/notifications';
import type { FastingProtocol, FastingSettings } from '@/types/db';
import { colors, space } from '@/lib/theme';

const SAVED_MESSAGE: Record<ScheduleResult, string> = {
  scheduled: 'Fasting reminders scheduled.',
  disabled: 'Fasting reminders turned off.',
  denied: 'Settings saved, but notifications are blocked. Allow them for andler-fit in system settings to get reminders.',
  unsupported: 'Settings saved. Reminders only work in the mobile app.',
};

const PROTOCOLS: { key: FastingProtocol; label: string; minutes: number }[] = [
  { key: '16_8', label: '16:8', minutes: 8 * 60 },
  { key: '18_6', label: '18:6', minutes: 6 * 60 },
  { key: '20_4', label: '20:4', minutes: 4 * 60 },
  { key: 'omad', label: 'OMAD', minutes: 60 },
];

export default function Fasting() {
  const { session } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [protocol, setProtocol] = useState<FastingProtocol>('16_8');
  const [windowMinutes, setWindowMinutes] = useState(8 * 60);
  const [start, setStart] = useState('12:00');
  const [notifyStart, setNotifyStart] = useState(true);
  const [notifyEnd, setNotifyEnd] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from('fasting_settings').select('*').eq('user_id', uid).maybeSingle();
    if (data) {
      const d = data as FastingSettings;
      setEnabled(d.enabled);
      setProtocol(d.protocol);
      setWindowMinutes(d.eating_window_minutes);
      setStart(d.eating_window_start.slice(0, 5));
      setNotifyStart(d.notify_start);
      setNotifyEnd(d.notify_end);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const startTime = parseHHMM(start);
    if (!startTime) {
      Alert.alert('Check the time', 'Enter the eating window start as HH:MM, e.g. 12:00.');
      return;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const row: FastingSettings = {
      user_id: uid,
      enabled,
      protocol,
      eating_window_start: `${pad(startTime.hour)}:${pad(startTime.minute)}:00`,
      eating_window_minutes: windowMinutes,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      notify_start: notifyStart,
      notify_end: notifyEnd,
    };
    try {
      setSaving(true);
      const { error } = await supabase.from('fasting_settings').upsert(row);
      if (error) throw error;
      const result = await scheduleFastingNotifications(row);
      Alert.alert('Saved', SAVED_MESSAGE[result]);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingVertical: space.lg }}>
        <Text style={s.h1}>Intermittent fasting</Text>
        <Card style={{ marginBottom: space.md }}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Enabled</Text>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>
        </Card>

        <Text style={s.label}>Protocol</Text>
        <View style={s.row}>
          {PROTOCOLS.map((p) => (
            <Pill
              key={p.key}
              label={p.label}
              active={protocol === p.key}
              onPress={() => {
                setProtocol(p.key);
                setWindowMinutes(p.minutes);
              }}
            />
          ))}
        </View>

        <Text style={s.label}>Eating window starts (HH:MM)</Text>
        <TextInput value={start} onChangeText={setStart} placeholder="12:00" style={s.input} placeholderTextColor={colors.muted} />
        <Text style={[s.muted, { marginTop: 6 }]}>Window length: {Math.round(windowMinutes / 60)} h</Text>

        <Card style={{ marginTop: space.md }}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Notify when window opens</Text>
            <Switch value={notifyStart} onValueChange={setNotifyStart} />
          </View>
          <View style={[s.rowBetween, { marginTop: space.sm }]}>
            <Text style={s.label}>Notify when fasting starts</Text>
            <Switch value={notifyEnd} onValueChange={setNotifyEnd} />
          </View>
        </Card>

        <View style={{ height: space.lg }} />
        <Button title="Save" loading={saving} onPress={save} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: space.md },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card, marginTop: 8 },
});
