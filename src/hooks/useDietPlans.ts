// ═══════════════════════════════════════════════════════════
// Diet Plans & Meals Hooks
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { DietPlan, DietMeal } from './useNutritionTypes';

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
