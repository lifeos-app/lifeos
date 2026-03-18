import { useState, useCallback } from 'react';
import { Apple, UtensilsCrossed, ShoppingCart, ChevronRight } from 'lucide-react';
import { useDietPlans, useActiveDiet, useNutritionLogs, useNutritionGrocery } from '../../hooks/useNutrition';
import { DietPlanTab } from './DietPlanTab';
import { MealsTab } from './MealsTab';
import { GroceryListTab } from './GroceryListTab';

type NutritionTab = 'diet' | 'meals' | 'grocery';

export function NutritionSystem() {
  const [activeTab, setActiveTab] = useState<NutritionTab>('diet');

  const { plans, refresh: refreshPlans } = useDietPlans();
  const { activePlan, activeMeals, refresh: refreshActive } = useActiveDiet();
  const { logs, logMeal } = useNutritionLogs();
  const { items: groceryItems, weekStart, generateFromMeals, toggleItem, addManualItem, deleteItem } = useNutritionGrocery();

  const handleActivate = useCallback(async (planId: string) => {
    const { useDietPlans: _unused } = await import('../../hooks/useNutrition');
    void _unused;
    // Import supabase to do the activation directly for immediate response
    const { supabase } = await import('../../lib/supabase');
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    // Deactivate all current plans
    await supabase
      .from('diet_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id)
      .eq('is_active', true);

    // Check if plan is a template
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

    // Refresh both plans and active diet data
    refreshPlans();
    refreshActive();
    // Auto-navigate to meals after activation
    setTimeout(() => setActiveTab('meals'), 300);
  }, [plans, refreshPlans, refreshActive]);

  const handleDeactivate = useCallback(async () => {
    const { supabase } = await import('../../lib/supabase');
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase
      .from('diet_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id)
      .eq('is_active', true);
    refreshPlans();
    refreshActive();
  }, [refreshPlans, refreshActive]);

  const handleLogMeal = useCallback(async (meal: any) => {
    await logMeal(meal);
  }, [logMeal]);

  const handleToggleFavourite = useCallback(async (mealId: string) => {
    const { supabase } = await import('../../lib/supabase');
    const meal = activeMeals.find(m => m.id === mealId);
    if (meal) {
      await supabase.from('diet_meals').update({ is_favourite: !meal.is_favourite }).eq('id', mealId);
      refreshActive();
    }
  }, [activeMeals, refreshActive]);

  const tabs: { id: NutritionTab; label: string; icon: any; badge?: string }[] = [
    { id: 'diet', label: 'Diet Plan', icon: Apple },
    { id: 'meals', label: 'Meals', icon: UtensilsCrossed, badge: activeMeals.length > 0 ? String(activeMeals.length) : undefined },
    { id: 'grocery', label: 'Grocery', icon: ShoppingCart },
  ];

  return (
    <div className="nutrition-system fade-in">
      {/* Active Plan Quick Banner — shows on all tabs */}
      {activePlan && activeTab !== 'diet' && (
        <div className="ns-active-banner" onClick={() => setActiveTab('diet')}>
          <span className="ns-ab-icon">{activePlan.icon}</span>
          <span className="ns-ab-name">{activePlan.name}</span>
          <span className="ns-ab-cal">{activePlan.daily_calories} cal/day</span>
          <ChevronRight size={12} />
        </div>
      )}

      {/* Tabs */}
      <div className="nutrition-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nutrition-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge && <span className="nt-badge">{tab.badge}</span>}
              {activeTab === tab.id && <div className="nt-indicator" />}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="nutrition-tab-content">
        {activeTab === 'diet' && (
          <DietPlanTab
            plans={plans}
            activePlan={activePlan}
            activeMeals={activeMeals}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onViewMeals={() => setActiveTab('meals')}
          />
        )}
        {activeTab === 'meals' && (
          <MealsTab
            activePlan={activePlan}
            meals={activeMeals}
            logs={logs}
            onLogMeal={handleLogMeal}
            onToggleFavourite={handleToggleFavourite}
            onGoToDietPlan={() => setActiveTab('diet')}
          />
        )}
        {activeTab === 'grocery' && (
          <GroceryListTab
            items={groceryItems}
            weekStart={weekStart}
            activeMeals={activeMeals}
            onGenerate={generateFromMeals}
            onToggle={toggleItem}
            onAddManual={addManualItem}
            onDelete={deleteItem}
          />
        )}
      </div>
    </div>
  );
}
