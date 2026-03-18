// ═══════════════════════════════════════════════════════════
// Nutrition Module — Shared Types
// ═══════════════════════════════════════════════════════════

export interface DietPlan {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  description: string | null;
  daily_calories: number;
  macros: { protein: number; carbs: number; fat: number };
  icon: string;
  is_template: boolean;
  is_active: boolean;
}

export interface DietMeal {
  id: string;
  user_id: string | null;
  diet_plan_id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  day_of_week: number | null;
  ingredients: Ingredient[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_time_min: number;
  instructions: string | null;
  emoji: string;
  is_favourite: boolean;
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  aisle: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface GroceryItem {
  id: string;
  user_id: string;
  week_start: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  source_meal_ids: string[];
  is_checked: boolean;
  is_manual: boolean;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  date: string;
  meal_id: string | null;
  meal_type: string;
  meal_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
}
