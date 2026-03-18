import { useState, useMemo } from 'react';
import {
  Heart, Clock, Check, ChevronLeft, ChevronRight,
  UtensilsCrossed, Flame, Zap, RefreshCw, Calendar,
  Sunrise, Sun, Moon, Cookie, List,
} from 'lucide-react';
import type { DietPlan, DietMeal, NutritionLog } from '../../hooks/useNutrition';

interface MealsTabProps {
  activePlan: DietPlan | null;
  meals: DietMeal[];
  logs: NutritionLog[];
  onLogMeal: (meal: DietMeal) => void;
  onToggleFavourite: (mealId: string) => void;
  onGoToDietPlan: () => void;
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TYPE_ICON: Record<string, React.ReactNode> = {
  breakfast: <Sunrise size={16} />,
  lunch: <Sun size={16} />,
  dinner: <Moon size={16} />,
  snack: <Cookie size={16} />,
};

type ViewMode = 'day' | 'week';

export function MealsTab({ activePlan, meals, logs, onLogMeal, onToggleFavourite, onGoToDietPlan }: MealsTabProps) {
  const today = new Date().getDay(); // 0=Sun
  const [selectedDay, setSelectedDay] = useState(today);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const todayStr = new Date().toISOString().split('T')[0];

  // All meals grouped by day for the week view
  const weekMeals = useMemo(() => {
    const grouped: Record<number, DietMeal[]> = {};
    for (let d = 0; d < 7; d++) {
      grouped[d] = meals
        .filter(m => m.day_of_week === d)
        .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
    }
    // Also include meals with null day_of_week (available every day)
    const globalMeals = meals.filter(m => m.day_of_week === null);
    if (globalMeals.length > 0) {
      for (let d = 0; d < 7; d++) {
        grouped[d] = [...grouped[d], ...globalMeals]
          .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
      }
    }
    return grouped;
  }, [meals]);

  // Filter meals for selected day
  const dayMeals = useMemo(() => {
    return weekMeals[selectedDay] || [];
  }, [weekMeals, selectedDay]);

  // Today's logs
  const todayLogs = logs.filter(l => l.date === todayStr);
  const todayCalories = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const todayProtein = todayLogs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const todayCarbs = todayLogs.reduce((s, l) => s + (l.carbs_g || 0), 0);
  const todayFat = todayLogs.reduce((s, l) => s + (l.fat_g || 0), 0);

  // Check if meal is already logged today
  const isMealLogged = (mealId: string) => todayLogs.some(l => l.meal_id === mealId);

  // Daily totals for selected day
  const dayTotalCal = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);

  // Total meals in plan
  const totalMealsInPlan = meals.length;
  const daysWithMeals = useMemo(() => {
    const days = new Set(meals.map(m => m.day_of_week).filter(d => d !== null));
    return days.size;
  }, [meals]);

  if (!activePlan) {
    return (
      <div className="meals-tab-empty fade-in">
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <UtensilsCrossed size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>No Active Diet Plan</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Choose a diet plan to see your weekly meal schedule.
          </p>
          <button className="btn-glow" onClick={onGoToDietPlan}>
            <Zap size={14} /> Choose Diet Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meals-tab fade-in">
      {/* Daily Progress Summary */}
      <div className="meals-daily-summary glass-card">
        <div className="mds-top">
          <div className="mds-cal-ring">
            <svg width={80} height={80}>
              <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
              <circle cx={40} cy={40} r={34} fill="none" stroke="#FDCB6E" strokeWidth={6}
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={2 * Math.PI * 34 * (1 - Math.min(todayCalories / (activePlan.daily_calories || 2000), 1))}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div className="mds-cal-center">
              <span className="mds-cal-num">{todayCalories}</span>
              <span className="mds-cal-label">/ {activePlan.daily_calories}</span>
            </div>
          </div>
          <div className="mds-macros">
            <div className="mds-macro">
              <span className="mds-macro-val" style={{ color: '#39FF14' }}>{Math.round(todayProtein)}g</span>
              <span className="mds-macro-label">Protein</span>
              <div className="mds-macro-bar"><div style={{ width: `${Math.min(todayProtein / (activePlan.daily_calories * activePlan.macros.protein / 400), 1) * 100}%`, background: '#39FF14' }} /></div>
            </div>
            <div className="mds-macro">
              <span className="mds-macro-val" style={{ color: '#3B82F6' }}>{Math.round(todayCarbs)}g</span>
              <span className="mds-macro-label">Carbs</span>
              <div className="mds-macro-bar"><div style={{ width: `${Math.min(todayCarbs / (activePlan.daily_calories * activePlan.macros.carbs / 400), 1) * 100}%`, background: '#3B82F6' }} /></div>
            </div>
            <div className="mds-macro">
              <span className="mds-macro-val" style={{ color: '#F59E0B' }}>{Math.round(todayFat)}g</span>
              <span className="mds-macro-label">Fat</span>
              <div className="mds-macro-bar"><div style={{ width: `${Math.min(todayFat / (activePlan.daily_calories * activePlan.macros.fat / 900), 1) * 100}%`, background: '#F59E0B' }} /></div>
            </div>
          </div>
        </div>
        {todayLogs.length > 0 && (
          <div className="mds-logged">
            <Check size={12} /> {todayLogs.length} meal{todayLogs.length !== 1 ? 's' : ''} logged today
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="meals-view-toggle">
        <button
          className={`mvt-btn ${viewMode === 'day' ? 'active' : ''}`}
          onClick={() => setViewMode('day')}
        >
          <Calendar size={13} /> Day View
        </button>
        <button
          className={`mvt-btn ${viewMode === 'week' ? 'active' : ''}`}
          onClick={() => setViewMode('week')}
        >
          <List size={13} /> Week View
        </button>
        {totalMealsInPlan > 0 && (
          <span className="mvt-info">{totalMealsInPlan} meals · {daysWithMeals} days</span>
        )}
      </div>

      {/* ═══ DAY VIEW ═══ */}
      {viewMode === 'day' && (
        <>
          {/* Day Selector */}
          <div className="meals-day-selector">
            <button className="mds-arrow" onClick={() => setSelectedDay((selectedDay + 6) % 7)}>
              <ChevronLeft size={16} />
            </button>
            <div className="mds-days">
              {DAY_NAMES_SHORT.map((name, i) => {
                const dayMealCount = weekMeals[i]?.length || 0;
                return (
                  <button
                    key={i}
                    className={`mds-day ${selectedDay === i ? 'active' : ''} ${i === today ? 'today' : ''}`}
                    onClick={() => setSelectedDay(i)}
                  >
                    <span className="mds-day-name">{name}</span>
                    {dayMealCount > 0 && <span className="mds-day-dot" />}
                  </button>
                );
              })}
            </div>
            <button className="mds-arrow" onClick={() => setSelectedDay((selectedDay + 1) % 7)}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day Label */}
          <div className="meals-day-header">
            <h3>{DAY_NAMES_SHORT[selectedDay]}{selectedDay === today ? ' (Today)' : ''}</h3>
            <span className="mdh-cal">{dayTotalCal} cal planned</span>
          </div>

          {/* Meal Cards */}
          <div className="meals-list">
            {renderMealsByType(dayMeals, expandedMeal, setExpandedMeal, isMealLogged, onLogMeal, onToggleFavourite, selectedDay === today)}

            {dayMeals.length === 0 && (
              <div className="glass-card" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                <RefreshCw size={24} style={{ marginBottom: 8 }} />
                <p>No meals planned for {DAY_NAMES_SHORT[selectedDay]}</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>Meals are assigned to specific days in your diet plan.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ WEEK VIEW ═══ */}
      {viewMode === 'week' && (
        <div className="meals-week-view">
          {DAY_NAMES_SHORT.map((dayName, dayIdx) => {
            const dMeals = weekMeals[dayIdx] || [];
            const dayCals = dMeals.reduce((s, m) => s + (m.calories || 0), 0);
            const isToday = dayIdx === today;

            if (dMeals.length === 0) return null;

            return (
              <div key={dayIdx} className={`mwv-day-card glass-card ${isToday ? 'is-today' : ''}`}>
                <div className="mwv-day-header">
                  <span className="mwv-day-name">{dayName}{isToday ? ' (Today)' : ''}</span>
                  <span className="mwv-day-cal">{dayCals} cal</span>
                  <button className="mwv-expand-btn" onClick={() => { setSelectedDay(dayIdx); setViewMode('day'); }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="mwv-meals">
                  {MEAL_TYPE_ORDER.map(mealType => {
                    const typeMeals = dMeals.filter(m => m.meal_type === mealType);
                    if (typeMeals.length === 0) return null;
                    return (
                      <div key={mealType} className="mwv-meal-type">
                        <span className="mwv-mt-icon">{MEAL_TYPE_ICON[mealType]}</span>
                        <div className="mwv-mt-meals">
                          {typeMeals.map(meal => (
                            <div key={meal.id} className="mwv-meal-chip">
                              <span className="mwv-meal-name">{meal.name}</span>
                              <span className="mwv-meal-cal">{meal.calories} cal</span>
                              {isToday && (
                                <button
                                  className={`mwv-log-btn ${isMealLogged(meal.id) ? 'done' : ''}`}
                                  onClick={() => !isMealLogged(meal.id) && onLogMeal(meal)}
                                  disabled={isMealLogged(meal.id)}
                                >
                                  {isMealLogged(meal.id) ? <Check size={11} /> : <Zap size={11} />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {meals.length === 0 && (
            <div className="glass-card" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
              <UtensilsCrossed size={24} style={{ marginBottom: 8 }} />
              <p>No meals in this plan yet</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>Your diet plan has no meals assigned. Try deactivating and choosing a different plan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Extracted helper to render meals by type (shared between views)
function renderMealsByType(
  dayMeals: DietMeal[],
  expandedMeal: string | null,
  setExpandedMeal: (id: string | null) => void,
  isMealLogged: (id: string) => boolean,
  onLogMeal: (meal: DietMeal) => void,
  onToggleFavourite: (id: string) => void,
  isToday: boolean,
) {
  return MEAL_TYPE_ORDER.map(mealType => {
    const typeMeals = dayMeals.filter(m => m.meal_type === mealType);
    if (typeMeals.length === 0) return null;

    return (
      <div key={mealType} className="meal-type-section">
        <div className="mts-header">
          <span className="mts-icon">{MEAL_TYPE_ICON[mealType] ?? <UtensilsCrossed size={16} />}</span>
          <span className="mts-label">{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</span>
        </div>

        {typeMeals.map(meal => {
          const isExpanded = expandedMeal === meal.id;
          const logged = isMealLogged(meal.id);

          return (
            <div
              key={meal.id}
              className={`meal-card-full ${isExpanded ? 'expanded' : ''} ${logged ? 'logged' : ''}`}
              onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
            >
              <div className="mcf-top">
                <span className="mcf-type-icon">{MEAL_TYPE_ICON[meal.meal_type] ?? <UtensilsCrossed size={24} />}</span>
                <div className="mcf-info">
                  <span className="mcf-name">{meal.name}</span>
                  <div className="mcf-meta">
                    <span><Flame size={11} /> {meal.calories} cal</span>
                    {meal.prep_time_min > 0 && <span><Clock size={11} /> {meal.prep_time_min}m</span>}
                  </div>
                </div>
                <div className="mcf-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`mcf-fav ${meal.is_favourite ? 'active' : ''}`}
                    onClick={() => onToggleFavourite(meal.id)}
                  >
                    <Heart size={14} fill={meal.is_favourite ? '#F43F5E' : 'none'} />
                  </button>
                  {isToday && (
                    <button
                      className={`mcf-log-btn ${logged ? 'done' : ''}`}
                      onClick={() => !logged && onLogMeal(meal)}
                      disabled={logged}
                    >
                      {logged ? <Check size={14} /> : <Zap size={14} />}
                      {logged ? 'Logged' : 'Log'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="mcf-detail fade-in" onClick={e => e.stopPropagation()}>
                  {/* Macros */}
                  <div className="mcf-macros-row">
                    <div className="mcf-macro" style={{ '--mc': '#39FF14' } as any}>
                      <span className="mcf-macro-val">{meal.protein_g}g</span>
                      <span className="mcf-macro-label">Protein</span>
                    </div>
                    <div className="mcf-macro" style={{ '--mc': '#3B82F6' } as any}>
                      <span className="mcf-macro-val">{meal.carbs_g}g</span>
                      <span className="mcf-macro-label">Carbs</span>
                    </div>
                    <div className="mcf-macro" style={{ '--mc': '#F59E0B' } as any}>
                      <span className="mcf-macro-val">{meal.fat_g}g</span>
                      <span className="mcf-macro-label">Fat</span>
                    </div>
                    <div className="mcf-macro" style={{ '--mc': '#F43F5E' } as any}>
                      <span className="mcf-macro-val">{meal.calories}</span>
                      <span className="mcf-macro-label">Calories</span>
                    </div>
                  </div>

                  {/* Ingredients */}
                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <div className="mcf-ingredients">
                      <h4>Ingredients</h4>
                      <div className="mcf-ing-list">
                        {meal.ingredients.map((ing, i) => (
                          <div key={i} className="mcf-ing-item">
                            <span className="mcf-ing-dot" />
                            <span className="mcf-ing-name">{ing.name}</span>
                            <span className="mcf-ing-qty">{ing.quantity} {ing.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {meal.instructions && (
                    <div className="mcf-instructions">
                      <h4>How to Prepare</h4>
                      <p>{meal.instructions}</p>
                    </div>
                  )}

                  {/* Log button in expanded view */}
                  {isToday && !logged && (
                    <button className="btn-glow mcf-log-expanded" onClick={() => onLogMeal(meal)}>
                      <Zap size={14} /> Log This Meal (+10 XP)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  });
}
