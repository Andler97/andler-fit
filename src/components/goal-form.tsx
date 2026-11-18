import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Pill, Screen } from '@/components/kit';
import { loadGoalContext, saveGoal } from '@/lib/goals';
import { useAuth } from '@/providers/auth';
import type { ActivityLevel, GoalType, Sex } from '@/types/db';
import { colors, space } from '@/lib/theme';

const GOALS: { key: GoalType; label: string }[] = [
  { key: 'lose_weight', label: 'Lose weight' },
  { key: 'gain_muscle', label: 'Gain muscle' },
  { key: 'recomp', label: 'Recomp' },
];
const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];
const ACTIVITIES: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'very_active', label: 'Very active' },
];

/**
 * Goal + body-metrics form. `onboarding` starts from defaults and the root redirect gate moves the
 * user on once `onboarded_at` is set; `edit` prefills from the saved profile, active goal and latest
 * weigh-in, and calls `onDone` after saving.
 */
export function GoalForm({ mode, onDone }: { mode: 'onboarding' | 'edit'; onDone?: () => void }) {
  const { session, profile, refreshProfile } = useAuth();
  const [goalType, setGoalType] = useState<GoalType>('lose_weight');
  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('80');
  const [targetWeight, setTargetWeight] = useState('');
  const [lastWeightKg, setLastWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  const uid = session?.user.id;
  useEffect(() => {
    if (mode !== 'edit' || !uid) return;
    let active = true;
    loadGoalContext(uid, profile)
      .then(({ draft, lastWeightKg: last }) => {
        if (!active) return;
        if (draft.goalType) setGoalType(draft.goalType);
        if (draft.sex) setSex(draft.sex);
        if (draft.activity) setActivity(draft.activity);
        if (draft.age != null) setAge(String(draft.age));
        if (draft.heightCm != null) setHeight(String(draft.heightCm));
        if (draft.weightKg != null) setWeight(String(draft.weightKg));
        setTargetWeight(draft.targetWeightKg != null ? String(draft.targetWeightKg) : '');
        setLastWeightKg(last);
      })
      .catch((e: unknown) =>
        Alert.alert('Could not load your goal', e instanceof Error ? e.message : 'Please try again.'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // Load once per screen (not on `profile` changes), so refreshing after a save doesn't reset the form.
  }, [mode, uid]);

  const save = async () => {
    if (!uid) return;
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    const targetN = targetWeight.trim() ? parseFloat(targetWeight) : null;
    if (!ageN || !heightN || !weightN || (targetN != null && !targetN)) {
      Alert.alert('Missing info', 'Please fill age, height and weight with numbers.');
      return;
    }
    try {
      setSaving(true);
      await saveGoal(
        uid,
        { goalType, sex, activity, age: ageN, heightCm: heightN, weightKg: weightN, targetWeightKg: targetN },
        { profile, lastWeightKg },
      );
      await refreshProfile();
      onDone?.();
    } catch (e: unknown) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: space.lg }}>
        <Text style={s.h1}>{mode === 'edit' ? 'Edit goal' : 'Set your goal'}</Text>

        <Text style={s.label}>Goal</Text>
        <View style={s.row}>
          {GOALS.map((g) => (
            <Pill key={g.key} label={g.label} active={goalType === g.key} onPress={() => setGoalType(g.key)} />
          ))}
        </View>

        <Text style={s.label}>Sex</Text>
        <View style={s.row}>
          {SEXES.map((x) => (
            <Pill key={x.key} label={x.label} active={sex === x.key} onPress={() => setSex(x.key)} />
          ))}
        </View>

        <View style={s.grid}>
          <Field label="Age" value={age} onChange={setAge} />
          <Field label="Height (cm)" value={height} onChange={setHeight} />
          <Field label="Weight (kg)" value={weight} onChange={setWeight} />
          <Field label="Target kg (optional)" value={targetWeight} onChange={setTargetWeight} />
        </View>

        <Text style={s.label}>Activity</Text>
        <View style={s.row}>
          {ACTIVITIES.map((a) => (
            <Pill key={a.key} label={a.label} active={activity === a.key} onPress={() => setActivity(a.key)} />
          ))}
        </View>

        <View style={{ height: space.lg }} />
        <Button title={mode === 'edit' ? 'Save' : 'Save and continue'} loading={saving} onPress={save} />
        {mode === 'edit' && onDone ? (
          <>
            <View style={{ height: space.sm }} />
            <Button title="Cancel" variant="secondary" disabled={saving} onPress={onDone} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ width: '48%', marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={s.input}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: space.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: space.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card },
});
