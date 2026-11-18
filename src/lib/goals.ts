import { todayLocalISO } from '@/lib/dates';
import { ageFromBirthDate, bmr, macroTargets, tdee, type MacroTargets } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import type { ActivityLevel, Goal, GoalType, Profile, Sex } from '@/types/db';

export interface GoalDraft {
  goalType: GoalType;
  sex: Sex;
  activity: ActivityLevel;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
}

export interface SavedGoalContext {
  /** Values to prefill the form with; missing fields keep the form defaults. */
  draft: Partial<GoalDraft>;
  /** Latest logged weigh-in, so saving only logs a new one when the weight changed. */
  lastWeightKg: number | null;
}

const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

/** Current goal, body metrics and latest weigh-in, for editing an existing goal. */
export async function loadGoalContext(uid: string, profile: Profile | null): Promise<SavedGoalContext> {
  const [goalRes, weightRes] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', uid).eq('is_active', true).maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', uid)
      .order('logged_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (goalRes.error) throw goalRes.error;
  if (weightRes.error) throw weightRes.error;

  const goal = goalRes.data as Goal | null;
  const lastWeightKg = toNum(weightRes.data?.weight_kg);
  const weightKg = lastWeightKg ?? toNum(goal?.start_weight_kg);
  const heightCm = toNum(profile?.height_cm);
  return {
    lastWeightKg,
    draft: {
      ...(goal ? { goalType: goal.goal_type, targetWeightKg: toNum(goal.target_weight_kg) } : {}),
      ...(profile?.sex ? { sex: profile.sex } : {}),
      ...(profile ? { activity: profile.activity_level } : {}),
      ...(profile?.birth_date ? { age: ageFromBirthDate(profile.birth_date) } : {}),
      ...(heightCm != null ? { heightCm } : {}),
      ...(weightKg != null ? { weightKg } : {}),
    },
  };
}

/**
 * Saves body metrics and replaces the active goal with freshly computed targets.
 * First-time saves also stamp `onboarded_at`; edits leave it alone.
 */
export async function saveGoal(
  uid: string,
  draft: GoalDraft,
  opts: { profile: Profile | null; lastWeightKg: number | null },
): Promise<MacroTargets> {
  const { profile } = opts;
  const targets = macroTargets({
    goalType: draft.goalType,
    tdee: tdee(bmr({ sex: draft.sex, weightKg: draft.weightKg, heightCm: draft.heightCm, age: draft.age }), draft.activity),
    weightKg: draft.weightKg,
    sex: draft.sex,
  });

  // The form only asks for age: keep a stored birth date while it still yields the same age.
  const birthDate =
    profile?.birth_date && ageFromBirthDate(profile.birth_date) === draft.age
      ? profile.birth_date
      : `${new Date().getFullYear() - draft.age}-01-01`;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      sex: draft.sex,
      birth_date: birthDate,
      height_cm: draft.heightCm,
      activity_level: draft.activity,
      ...(profile?.onboarded_at ? {} : { onboarded_at: new Date().toISOString() }),
    })
    .eq('id', uid);
  if (profileError) throw profileError;

  // One active goal per user (unique partial index): retire the current one, insert the new one,
  // and put the old one back if the insert fails so the user is never left without targets.
  const { data: retired, error: retireError } = await supabase
    .from('goals')
    .update({ is_active: false })
    .eq('user_id', uid)
    .eq('is_active', true)
    .select('id');
  if (retireError) throw retireError;

  const { error: insertError } = await supabase.from('goals').insert({
    user_id: uid,
    goal_type: draft.goalType,
    start_weight_kg: draft.weightKg,
    target_weight_kg: draft.targetWeightKg,
    daily_calorie_target: targets.kcal,
    protein_g: targets.protein_g,
    carbs_g: targets.carbs_g,
    fat_g: targets.fat_g,
    is_active: true,
  });
  if (insertError) {
    const ids = (retired ?? []).map((g) => g.id as string);
    if (ids.length) await supabase.from('goals').update({ is_active: true }).in('id', ids);
    throw insertError;
  }

  // Weigh-ins feed the weight trend, so only log one when the weight actually changed.
  if (opts.lastWeightKg !== draft.weightKg) {
    const { error: weightError } = await supabase
      .from('weight_logs')
      .insert({ user_id: uid, weight_kg: draft.weightKg, logged_on: todayLocalISO() });
    if (weightError) console.warn('[goals] weigh-in not logged', weightError);
  }

  return targets;
}
