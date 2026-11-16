import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Pill, Screen } from '@/components/kit';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';
import { bmr, macroTargets, tdee } from '@/lib/nutrition';
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

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [goalType, setGoalType] = useState<GoalType>('lose_weight');
  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('80');
  const [targetWeight, setTargetWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    if (!ageN || !heightN || !weightN) {
      Alert.alert('Missing info', 'Please fill age, height and weight.');
      return;
    }
    const birthDate = `${new Date().getFullYear() - ageN}-01-01`;
    const targets = macroTargets({
      goalType,
      tdee: tdee(bmr({ sex, weightKg: weightN, heightCm: heightN, age: ageN }), activity),
      weightKg: weightN,
      sex,
    });
    try {
      setSaving(true);
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          sex,
          birth_date: birthDate,
          height_cm: heightN,
          activity_level: activity,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', uid);
      if (pErr) throw pErr;
      await supabase.from('goals').update({ is_active: false }).eq('user_id', uid).eq('is_active', true);
      const { error: gErr } = await supabase.from('goals').insert({
        user_id: uid,
        goal_type: goalType,
        start_weight_kg: weightN,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        daily_calorie_target: targets.kcal,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        is_active: true,
      });
      if (gErr) throw gErr;
      await supabase.from('weight_logs').insert({ user_id: uid, weight_kg: weightN });
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: space.lg }}>
        <Text style={s.h1}>Set your goal</Text>

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
        <Button title="Save and continue" loading={saving} onPress={save} />
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
