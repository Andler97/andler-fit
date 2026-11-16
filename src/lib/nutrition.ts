import type { ActivityLevel, GoalType, Sex } from '@/types/db';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700; // approx energy in 1 kg body mass

export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// Mifflin-St Jeor
export function bmr(params: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const { sex, weightKg, heightCm, age } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // 'other': midpoint of the two offsets
}

export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return bmrValue * ACTIVITY_FACTOR[activity];
}

export interface MacroTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function macroTargets(params: {
  goalType: GoalType;
  tdee: number;
  weightKg: number;
  sex: Sex;
  rateKgPerWeek?: number;
}): MacroTargets {
  const { goalType, tdee, weightKg, sex, rateKgPerWeek = 0.5 } = params;
  const dailyDelta = (rateKgPerWeek * KCAL_PER_KG) / 7;

  let kcal: number;
  if (goalType === 'lose_weight') kcal = tdee - dailyDelta;
  else if (goalType === 'gain_muscle') kcal = tdee + dailyDelta;
  else kcal = tdee; // recomp: maintenance with high protein

  const floor = sex === 'male' ? 1500 : 1200;
  kcal = Math.max(kcal, floor);

  const proteinPerKg = goalType === 'gain_muscle' ? 2.2 : goalType === 'recomp' ? 2.0 : 1.8;
  const protein_g = Math.round(weightKg * proteinPerKg);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbsKcal = kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(carbsKcal / 4));

  return { kcal: Math.round(kcal), protein_g, carbs_g, fat_g };
}
