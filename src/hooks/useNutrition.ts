import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════
// Types
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

// ═══════════════════════════════════════════════════════════
// Diet Plans Hook
// ═══════════════════════════════════════════════════════════

export function useDietPlans() {
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('is_deleted', false)
        .order('is_template', { ascending: false })
        .order('name');
      if (!cancelled) {
        if (error) logger.error('[useDietPlans]', error.message);
        setPlans((rows as DietPlan[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const activatePlan = async (planId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    // Deactivate all current plans
    await supabase
      .from('diet_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id)
      .eq('is_active', true);

    // Check if plan is a template — if so, clone it for the user
    const plan = plans.find(p => p.id === planId);
    if (plan?.is_template) {
      // Clone the template plan for the user
      const { data: cloned } = await supabase
        .from('diet_plans')
        .insert({
          user_id: user.user.id,
          name: plan.name,
          type: plan.type,
          description: plan.description,
          daily_calories: plan.daily_calories,
          macros: plan.macros,
          icon: plan.icon,
          is_template: false,
          is_active: true,
        })
        .select()
        .single();

      if (cloned) {
        // Clone the meals
        const { data: templateMeals } = await supabase
          .from('diet_meals')
          .select('*')
          .eq('diet_plan_id', planId)
          .eq('is_deleted', false);

        if (templateMeals && templateMeals.length > 0) {
          await supabase.from('diet_meals').insert(
            templateMeals.map((m: any) => ({
              user_id: user.user.id,
              diet_plan_id: cloned.id,
              name: m.name,
              meal_type: m.meal_type,
              day_of_week: m.day_of_week,
              ingredients: m.ingredients,
              calories: m.calories,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              prep_time_min: m.prep_time_min,
              instructions: m.instructions,
              emoji: m.emoji,
              is_favourite: false,
            }))
          );
        }
      }
    } else {
      // Just activate existing user plan
      await supabase
        .from('diet_plans')
        .update({ is_active: true })
        .eq('id', planId);
    }

    refresh();
  };

  const deactivatePlan = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase
      .from('diet_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id)
      .eq('is_active', true);
    refresh();
  };

  return { plans, loading, refresh, activatePlan, deactivatePlan };
}

// ═══════════════════════════════════════════════════════════
// Diet Meals Hook
// ═══════════════════════════════════════════════════════════

export function useDietMeals(dietPlanId?: string) {
  const [meals, setMeals] = useState<DietMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('diet_meals')
        .select('*')
        .eq('is_deleted', false)
        .order('day_of_week')
        .order('meal_type');

      if (dietPlanId) {
        query = query.eq('diet_plan_id', dietPlanId);
      }

      const { data: rows, error } = await query;
      if (!cancelled) {
        if (error) logger.error('[useDietMeals]', error.message);
        setMeals((rows as DietMeal[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, dietPlanId]);

  const swapMeal = async (mealId: string, newMealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    const newMeal = meals.find(m => m.id === newMealId);
    if (!meal || !newMeal) return;

    // Swap day_of_week values
    await supabase.from('diet_meals').update({ day_of_week: newMeal.day_of_week }).eq('id', mealId);
    await supabase.from('diet_meals').update({ day_of_week: meal.day_of_week }).eq('id', newMealId);
    refresh();
  };

  const toggleFavourite = async (mealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;
    await supabase.from('diet_meals').update({ is_favourite: !meal.is_favourite }).eq('id', mealId);
    refresh();
  };

  return { meals, loading, refresh, swapMeal, toggleFavourite };
}

// ═══════════════════════════════════════════════════════════
// Nutrition Logs Hook
// ═══════════════════════════════════════════════════════════

export function useNutritionLogs(dateRange?: { from: string; to: string }) {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('nutrition_logs')
        .select('*')
        .eq('is_deleted', false)
        .order('logged_at', { ascending: false });

      if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
      } else {
        query = query.limit(100);
      }

      const { data: rows, error } = await query;
      if (!cancelled) {
        if (error) logger.error('[useNutritionLogs]', error.message);
        setLogs((rows as NutritionLog[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, dateRange?.from, dateRange?.to]);

  const logMeal = async (meal: DietMeal) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('nutrition_logs').insert({
      user_id: user.user.id,
      date: today,
      meal_id: meal.id,
      meal_type: meal.meal_type,
      meal_name: meal.name,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
    });

    if (error) logger.error('[logMeal]', error.message);
    else refresh();
  };

  const deleteLog = async (logId: string) => {
    await supabase.from('nutrition_logs').update({ is_deleted: true }).eq('id', logId);
    refresh();
  };

  return { logs, loading, refresh, logMeal, deleteLog };
}

// ═══════════════════════════════════════════════════════════
// Nutrition Grocery Items Hook
// ═══════════════════════════════════════════════════════════

export function useNutritionGrocery() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  // Get Monday of current week
  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const weekStart = getWeekStart();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('nutrition_grocery_items')
        .select('*')
        .eq('is_deleted', false)
        .eq('week_start', weekStart)
        .order('aisle')
        .order('name');

      if (!cancelled) {
        if (error) logger.error('[useNutritionGrocery]', error.message);
        setItems((rows as GroceryItem[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, weekStart]);

  const generateFromMeals = async (meals: DietMeal[]) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    // Delete existing auto-generated items for this week
    await supabase
      .from('nutrition_grocery_items')
      .update({ is_deleted: true })
      .eq('user_id', user.user.id)
      .eq('week_start', weekStart)
      .eq('is_manual', false);

    // Aggregate ingredients from all meals
    const ingredientMap = new Map<string, { quantity: number; unit: string; aisle: string; mealIds: string[] }>();

    for (const meal of meals) {
      if (!meal.ingredients) continue;
      for (const ing of meal.ingredients) {
        const key = `${ing.name.toLowerCase()}-${ing.unit || ''}`;
        const existing = ingredientMap.get(key);
        if (existing) {
          existing.quantity += ing.quantity || 0;
          if (!existing.mealIds.includes(meal.id)) {
            existing.mealIds.push(meal.id);
          }
        } else {
          ingredientMap.set(key, {
            quantity: ing.quantity || 0,
            unit: ing.unit || '',
            aisle: ing.aisle || 'other',
            mealIds: [meal.id],
          });
        }
      }
    }

    // Insert aggregated items
    const insertItems = Array.from(ingredientMap.entries()).map(([key, val]) => ({
      user_id: user.user.id,
      week_start: weekStart,
      name: key.split('-')[0].replace(/^\w/, c => c.toUpperCase()),
      quantity: Math.round(val.quantity * 100) / 100,
      unit: val.unit || null,
      aisle: val.aisle,
      source_meal_ids: val.mealIds,
      is_checked: false,
      is_manual: false,
    }));

    if (insertItems.length > 0) {
      await supabase.from('nutrition_grocery_items').insert(insertItems);
    }

    refresh();
  };

  const toggleItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await supabase.from('nutrition_grocery_items')
      .update({ is_checked: !item.is_checked })
      .eq('id', itemId);
    refresh();
  };

  const addManualItem = async (name: string, quantity?: number, unit?: string, aisle?: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('nutrition_grocery_items').insert({
      user_id: user.user.id,
      week_start: weekStart,
      name,
      quantity: quantity || null,
      unit: unit || null,
      aisle: aisle || 'other',
      is_checked: false,
      is_manual: true,
    });
    refresh();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from('nutrition_grocery_items').update({ is_deleted: true }).eq('id', itemId);
    refresh();
  };

  return { items, loading, refresh, weekStart, generateFromMeals, toggleItem, addManualItem, deleteItem };
}

// ═══════════════════════════════════════════════════════════
// Helper: Get active diet plan
// ═══════════════════════════════════════════════════════════
export function useActiveDiet() {
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [activeMeals, setActiveMeals] = useState<DietMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { setLoading(false); return; }

      // Find active plan
      const { data: plans } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .limit(1);

      if (!cancelled && plans && plans.length > 0) {
        const plan = plans[0] as DietPlan;
        setActivePlan(plan);

        // Fetch meals for active plan
        const { data: meals } = await supabase
          .from('diet_meals')
          .select('*')
          .eq('diet_plan_id', plan.id)
          .eq('is_deleted', false)
          .order('day_of_week')
          .order('meal_type');

        setActiveMeals((meals as DietMeal[]) || []);
      } else if (!cancelled) {
        setActivePlan(null);
        setActiveMeals([]);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return { activePlan, activeMeals, loading, refresh };
}
