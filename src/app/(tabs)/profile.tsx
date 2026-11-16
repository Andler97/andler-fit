import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import type { Goal } from '@/types/db';
import { colors, space } from '@/lib/theme';

export default function Profile() {
  const { session, profile, signOut } = useAuth();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle();
    setGoal((data as Goal) ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goalLabel =
    goal?.goal_type === 'lose_weight'
      ? 'Lose weight'
      : goal?.goal_type === 'gain_muscle'
        ? 'Gain muscle'
        : goal?.goal_type === 'recomp'
          ? 'Recomp'
          : '—';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingVertical: space.lg }}>
        <Text style={s.h1}>Profile</Text>
        <Card style={{ marginBottom: space.md }}>
          <Text style={s.label}>Signed in as</Text>
          <Text style={s.value}>{session?.user.email ?? profile?.display_name ?? 'You'}</Text>
        </Card>
        <Card style={{ marginBottom: space.md }}>
          <Text style={s.label}>Goal</Text>
          <Text style={s.value}>{goalLabel}</Text>
          {goal?.daily_calorie_target ? (
            <Text style={s.sub}>
              {goal.daily_calorie_target} kcal · P {goal.protein_g} / C {goal.carbs_g} / F {goal.fat_g} g
            </Text>
          ) : null}
          <Text> </Text>
          <Button title="Edit goal" variant="secondary" onPress={() => router.push('/(onboarding)/goal')} />
        </Card>
        <Button title="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: space.md },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 6 },
});
