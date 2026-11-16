export type UnitSystem = 'metric' | 'imperial';
export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose_weight' | 'gain_muscle' | 'recomp';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FastingProtocol = '16_8' | '18_6' | '20_4' | 'omad' | 'custom';

export interface Profile {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  unit_system: UnitSystem;
  activity_level: ActivityLevel;
  locale: string;
  onboarded_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  goal_type: GoalType;
  start_weight_kg: number | null;
  target_weight_kg: number | null;
  rate_kg_per_week: number | null;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_active: boolean;
}

export interface FoodLogEntry {
  id: string;
  user_id: string;
  logged_on: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  quantity_g: number;
  servings: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}

export interface FastingSettings {
  user_id: string;
  enabled: boolean;
  protocol: FastingProtocol;
  eating_window_start: string;
  eating_window_minutes: number;
  timezone: string;
  notify_start: boolean;
  notify_end: boolean;
}
