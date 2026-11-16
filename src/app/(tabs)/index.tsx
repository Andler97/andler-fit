import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { todayLocalISO } from '@/lib/dates';
import type { FoodLogEntry, Goal } from '@/types/db';
import { colors, space } from '@/lib/theme';

export default function Today() {
  const { session } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    const today = todayLocalISO();
    const [{ data: e }, { data: g }] = await Promise.all([
      supabase
        .from('food_log_entries')
        .select('*')
        .eq('user_id', uid)
        .eq('logged_on', today)
        .order('logged_at', { ascending: true }),
      supabase.from('goals').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle(),
    ]);
    setEntries((e as FoodLogEntry[]) ?? []);
    setGoal((g as Goal) ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = entries.reduce(
    (a, x) => ({
      kcal: a.kcal + Number(x.kcal),
      p: a.p + Number(x.protein_g),
      c: a.c + Number(x.carbs_g),
      f: a.f + Number(x.fat_g),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const remove = async (id: string) => {
    await supabase.from('food_log_entries').delete().eq('id', id);
    load();
  };

  return (
    <Screen>
      <View style={{ paddingTop: space.md, paddingBottom: space.sm }}>
        <Text style={st.h1}>Today</Text>
      </View>
      <Card style={{ marginBottom: space.md }}>
        <Text style={st.kcal}>
          {Math.round(totals.kcal)}
          {goal?.daily_calorie_target ? ` / ${goal.daily_calorie_target}` : ''} kcal
        </Text>
        <View style={st.macros}>
          <Macro label="Protein" value={totals.p} target={goal?.protein_g} />
          <Macro label="Carbs" value={totals.c} target={goal?.carbs_g} />
          <Macro label="Fat" value={totals.f} target={goal?.fat_g} />
        </View>
      </Card>
      <Button title="Scan or add food" onPress={() => router.push('/scan')} />
      <FlatList
        style={{ marginTop: space.md }}
        data={entries}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: space.lg }}>
            No entries yet. Scan a barcode to start.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => remove(item.id)} style={st.entry}>
            <View style={{ flex: 1 }}>
              <Text style={st.entryName}>{item.food_name}</Text>
              <Text style={st.entrySub}>
                {Math.round(Number(item.quantity_g))} g · {item.meal_type}
              </Text>
            </View>
            <Text style={st.entryKcal}>{Math.round(Number(item.kcal))} kcal</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target?: number | null }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontWeight: '700', color: colors.text }}>
        {Math.round(value)}
        {target ? `/${target}` : ''} g
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  kcal: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  macros: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space.md },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  entryName: { fontSize: 16, fontWeight: '600', color: colors.text },
  entrySub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  entryKcal: { fontSize: 15, fontWeight: '700', color: colors.text },
});
