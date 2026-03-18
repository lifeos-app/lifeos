import { useState, lazy, Suspense } from 'react';
import {
  Check, ChevronRight, Sparkles, Zap,
  Sunrise, Sun, Moon, Cookie, UtensilsCrossed,
  ChevronDown,
} from 'lucide-react';
import type { DietPlan, DietMeal } from '../../hooks/useNutrition';

const AIMealSuggestions = lazy(() => import('./AIMealSuggestions').then(m => ({ default: m.AIMealSuggestions })));

interface DietPlanTabProps {
  plans: DietPlan[];
  activePlan: DietPlan | null;
  activeMeals: DietMeal[];
  onActivate: (planId: string) => void;
  onDeactivate: () => void;
  onViewMeals: () => void;
}

const DIET_COLORS: Record<string, string> = {
  vegan: '#39FF14',
  vegetarian: '#4ADE80',
  mediterranean: '#F59E0B',
  keto: '#EF4444',
  asian: '#F97316',
  'high-protein': '#3B82F6',
  'clean-eating': '#10B981',
  custom: '#A855F7',
};

const MEAL_TYPE_ICON: Record<string, React.ReactNode> = {
  breakfast: <Sunrise size={13} />,
  lunch: <Sun size={13} />,
  dinner: <Moon size={13} />,
  snack: <Cookie size={13} />,
};

// Mini donut chart for macros
function MacroDonut({ macros, size = 56 }: { macros: { protein: number; carbs: number; fat: number }; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const total = macros.protein + macros.carbs + macros.fat;
  const proteinLen = (macros.protein / total) * c;
  const carbsLen = (macros.carbs / total) * c;
  const fatLen = (macros.fat / total) * c;

  return (
    <svg width={size} height={size} className="macro-donut">
      {/* Fat */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F59E0B" strokeWidth={6}
        strokeDasharray={`${fatLen} ${c - fatLen}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      {/* Carbs */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#3B82F6" strokeWidth={6}
        strokeDasharray={`${carbsLen} ${c - carbsLen}`}
        strokeDashoffset={-fatLen}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      {/* Protein */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#39FF14" strokeWidth={6}
        strokeDasharray={`${proteinLen} ${c - proteinLen}`}
        strokeDashoffset={-(fatLen + carbsLen)}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

function MacroBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="macro-bar-row">
      <span className="macro-bar-label">{label}</span>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="macro-bar-val" style={{ color }}>{value}%</span>
    </div>
  );
}

export function DietPlanTab({ plans, activePlan, activeMeals: _activeMeals, onActivate, onDeactivate, onViewMeals }: DietPlanTabProps) {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planMeals, setPlanMeals] = useState<Record<string, DietMeal[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const templatePlans = plans.filter(p => p.is_template);

  const handleToggle = async (plan: DietPlan) => {
    // Collapse if already expanded
    if (expandedPlanId === plan.id) {
      setExpandedPlanId(null);
      return;
    }

    // Expand this plan
    setExpandedPlanId(plan.id);

    // Fetch meals if not cached
    if (!planMeals[plan.id]) {
      setLoadingId(plan.id);
      const { supabase } = await import('../../lib/supabase');
      const { data: meals } = await supabase
        .from('diet_meals')
        .select('*')
        .eq('diet_plan_id', plan.id)
        .eq('is_deleted', false)
        .order('day_of_week')
        .order('meal_type');

      setPlanMeals(prev => ({ ...prev, [plan.id]: (meals || []) as DietMeal[] }));
      setLoadingId(null);
    }
  };

  // Group meals by day
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="diet-plan-tab fade-in">
      {/* Active Plan Summary */}
      {activePlan && (
        <div className="active-plan-card glass-card" style={{ '--plan-color': DIET_COLORS[activePlan.type] || '#A855F7' } as any}>
          <div className="apc-header">
            <span className="apc-icon">{activePlan.icon}</span>
            <div className="apc-info">
              <h3>{activePlan.name}</h3>
              <span className="apc-meta">{activePlan.daily_calories} cal/day · Active</span>
            </div>
            <div className="apc-macros">
              <MacroDonut macros={activePlan.macros} />
            </div>
          </div>
          <div className="apc-macro-bars">
            <MacroBar label="Protein" value={activePlan.macros.protein} color="#39FF14" />
            <MacroBar label="Carbs" value={activePlan.macros.carbs} color="#3B82F6" />
            <MacroBar label="Fat" value={activePlan.macros.fat} color="#F59E0B" />
          </div>
          <div className="apc-actions">
            <button className="btn-glow-sm" onClick={onViewMeals}>
              <ChevronRight size={14} /> View Meals
            </button>
            <button className="btn-ghost-sm" onClick={onDeactivate}>
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* AI Meal Suggestions */}
      <Suspense fallback={null}>
        <AIMealSuggestions />
      </Suspense>

      {/* Accordion Plan List */}
      <div className="diet-templates-section">
        <h3 className="section-title">
          <Sparkles size={16} />
          {activePlan ? 'Switch Diet Plan' : 'Choose a Diet Plan'}
        </h3>

        <div className="diet-accordion">
          {templatePlans.map(plan => {
            const isActive = activePlan?.type === plan.type && !activePlan?.is_template;
            const isExpanded = expandedPlanId === plan.id;
            const isLoading = loadingId === plan.id;
            const meals = planMeals[plan.id] || [];
            const color = DIET_COLORS[plan.type] || '#A855F7';

            // Group meals by day (show first 3 days)
            const groupedMeals = meals.reduce((acc, meal) => {
              const day = meal.day_of_week ?? 0;
              if (!acc[day]) acc[day] = [];
              acc[day].push(meal);
              return acc;
            }, {} as Record<number, DietMeal[]>);
            const dayEntries = Object.entries(groupedMeals).slice(0, 3);

            return (
              <div
                key={plan.id}
                className={`diet-accordion-item ${isActive ? 'is-active-plan' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                style={{ '--plan-color': color } as any}
              >
                {/* Header row — always visible */}
                <button
                  className="dai-header"
                  onClick={() => handleToggle(plan)}
                  aria-expanded={isExpanded}
                >
                  <span className="dai-icon">{plan.icon}</span>
                  <div className="dai-title-group">
                    <span className="dai-name">{plan.name}</span>
                    <span className="dai-cal">{plan.daily_calories} cal/day</span>
                  </div>
                  <div className="dai-macro-pills">
                    <span style={{ color: '#39FF14' }}>P{plan.macros.protein}%</span>
                    <span style={{ color: '#3B82F6' }}>C{plan.macros.carbs}%</span>
                    <span style={{ color: '#F59E0B' }}>F{plan.macros.fat}%</span>
                  </div>
                  <MacroDonut macros={plan.macros} size={40} />
                  {isActive && (
                    <span className="dai-active-badge">
                      <Check size={11} /> Active
                    </span>
                  )}
                  <span className="dai-chevron">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </button>

                {/* Expanded body — accordion */}
                <div className={`dai-body ${isExpanded ? 'open' : ''}`}>
                  <div className="dai-body-inner">
                    {/* Description */}
                    {plan.description && (
                      <p className="dai-description">{plan.description}</p>
                    )}

                    {/* Macro bars */}
                    <div className="dai-macro-bars">
                      <MacroBar label="Protein" value={plan.macros.protein} color="#39FF14" />
                      <MacroBar label="Carbs" value={plan.macros.carbs} color="#3B82F6" />
                      <MacroBar label="Fat" value={plan.macros.fat} color="#F59E0B" />
                    </div>

                    {/* Sample meals */}
                    {isLoading ? (
                      <div className="dai-loading">Loading sample meals...</div>
                    ) : meals.length > 0 ? (
                      <div className="dai-meals-preview">
                        <div className="dai-meals-label">Sample meals</div>
                        {dayEntries.map(([day, dayMeals]) => (
                          <div key={day} className="dai-day-row">
                            <span className="dai-day-name">{dayNames[parseInt(day)]}</span>
                            <div className="dai-day-chips">
                              {(dayMeals as DietMeal[]).map(meal => (
                                <span key={meal.id} className="dai-meal-chip">
                                  <span className="dai-meal-type-icon">
                                    {MEAL_TYPE_ICON[meal.meal_type] ?? <UtensilsCrossed size={12} />}
                                  </span>
                                  <span className="dai-meal-name">{meal.name}</span>
                                  <span className="dai-meal-cal">{meal.calories} cal</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {meals.length > 12 && (
                          <div className="dai-more">+{meals.length - 12} more meals across the week</div>
                        )}
                      </div>
                    ) : null}

                    {/* CTA */}
                    <div className="dai-cta-row">
                      {isActive ? (
                        <button className="btn-ghost" onClick={onDeactivate}>
                          Deactivate Plan
                        </button>
                      ) : (
                        <button
                          className="btn-glow"
                          onClick={() => { onActivate(plan.id); setExpandedPlanId(null); }}
                        >
                          <Zap size={14} /> Choose This Plan
                        </button>
                      )}
                      <button className="btn-ghost-sm" onClick={() => setExpandedPlanId(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
