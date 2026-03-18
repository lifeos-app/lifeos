/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, UtensilsCrossed } from 'lucide-react';
import { DonutChart } from '../../components/charts';
import { supabase } from '../../lib/supabase';

const NutritionSystem = lazy(() => import('../../components/nutrition/NutritionSystem').then(m => ({ default: m.NutritionSystem })));
const AIMealSuggestions = lazy(() => import('../../components/nutrition/AIMealSuggestions').then(m => ({ default: m.AIMealSuggestions })));

interface MacroData {
  protein: number;
  carbs: number;
  fat: number;
  isEstimated: boolean;
}

export function DietTab({ meals, allMetrics: _allMetrics }: any) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = (meals || []).filter((m: any) => m.date === today);
  const totalCals = todayMeals.reduce((s: number, m: any) => s + (m.calories || 0), 0);

  const [macros, setMacros] = useState<MacroData>({ protein: 0, carbs: 0, fat: 0, isEstimated: true });
  const [showQuickAI, setShowQuickAI] = useState(false);

  // ── Fetch actual macros from nutrition_logs + meals table ──
  const fetchMacros = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    // 1) Try nutrition_logs first (from diet plan logging — has real macros)
    const { data: nlogs } = await supabase
      .from('nutrition_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', user.user.id)
      .eq('date', today)
      .eq('is_deleted', false);

    const logProtein = (nlogs || []).reduce((s: number, l: any) => s + (l.protein_g || 0), 0);
    const logCarbs = (nlogs || []).reduce((s: number, l: any) => s + (l.carbs_g || 0), 0);
    const logFat = (nlogs || []).reduce((s: number, l: any) => s + (l.fat_g || 0), 0);

    // 2) Also check meals table for macros (newly added columns)
    const mealProtein = todayMeals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0);
    const mealCarbs = todayMeals.reduce((s: number, m: any) => s + (m.carbs_g || 0), 0);
    const mealFat = todayMeals.reduce((s: number, m: any) => s + (m.fat_g || 0), 0);

    const totalProtein = logProtein + mealProtein;
    const totalCarbs = logCarbs + mealCarbs;
    const totalFat = logFat + mealFat;

    const hasRealMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

    if (hasRealMacros) {
      setMacros({ protein: Math.round(totalProtein), carbs: Math.round(totalCarbs), fat: Math.round(totalFat), isEstimated: false });
    } else if (totalCals > 0) {
      // Fall back to 30/40/30 estimation from calories
      setMacros({
        protein: Math.round(totalCals * 0.3 / 4),
        carbs: Math.round(totalCals * 0.4 / 4),
        fat: Math.round(totalCals * 0.3 / 9),
        isEstimated: true,
      });
    } else {
      setMacros({ protein: 0, carbs: 0, fat: 0, isEstimated: true });
    }
  }, [today, totalCals, todayMeals]);

  useEffect(() => { fetchMacros(); }, [fetchMacros]);

  const macroSegments = (macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) ? [
    { label: 'Protein', value: macros.protein, color: '#F97316' },
    { label: 'Carbs', value: macros.carbs, color: '#FACC15' },
    { label: 'Fat', value: macros.fat, color: '#38BDF8' },
  ] : [];

  const mealTimelineTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealTypeColors: Record<string, string> = {
    breakfast: '#F97316', lunch: '#39FF14', dinner: '#818CF8', snack: '#FACC15',
  };

  return (
    <div className="diet-tab h-fade-up">
      {macroSegments.length > 0 && (
        <>
          <div className="hv2-section-label">
            TODAY'S MACROS
            <span className={`hv2-macro-badge ${macros.isEstimated ? 'estimated' : 'logged'}`}>
              {macros.isEstimated ? '~ estimated' : '✓ logged'}
            </span>
          </div>
          <div className="glass-card hv2-macro-card">
            <div className="hv2-macro-inner">
              <DonutChart segments={macroSegments} size={120} strokeWidth={18} centerLabel="kcal" centerValue={`${totalCals}`} />
              <div className="hv2-macro-legend">
                {macroSegments.map((m: any) => (
                  <div key={m.label} className="hv2-macro-item">
                    <span className="hv2-legend-dot" style={{ background: m.color }} />
                    <span className="hv2-macro-label">{m.label}</span>
                    <span className="hv2-macro-val" style={{ color: m.color }}>{m.value}g</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Quick "What should I eat?" Card ── */}
      <div
        className={`diet-quick-ai glass-card ${showQuickAI ? 'expanded' : ''}`}
        onClick={() => !showQuickAI && setShowQuickAI(true)}
      >
        <div className="dqa-header">
          <span className="dqa-emoji"><UtensilsCrossed size={16} /></span>
          <div className="dqa-text">
            <span className="dqa-title">What should I eat?</span>
            <span className="dqa-sub">AI-powered meal suggestions</span>
          </div>
          <Sparkles size={16} className="dqa-sparkle" />
        </div>
        {showQuickAI && (
          <div className="dqa-content fade-in">
            <Suspense fallback={
              <div className="dqa-loading">
                <Loader2 size={20} className="spin" />
                <span>Generating suggestions…</span>
              </div>
            }>
              <AIMealSuggestions compact maxSuggestions={2} />
            </Suspense>
            <button className="btn-ghost-sm dqa-close" onClick={(e) => { e.stopPropagation(); setShowQuickAI(false); }}>
              Close
            </button>
          </div>
        )}
      </div>

      {todayMeals.length > 0 && (
        <>
          <div className="hv2-section-label">TODAY'S MEALS</div>
          <div className="glass-card hv2-meal-timeline">
            {mealTimelineTypes.map(type => {
              const typeMeals = todayMeals.filter((m: any) => m.meal_type === type);
              if (typeMeals.length === 0) return null;
              return (
                <div key={type} className="hv2-meal-group">
                  <div className="hv2-meal-type" style={{ color: mealTypeColors[type] }}>
                    <span className="hv2-meal-type-dot" style={{ background: mealTypeColors[type] }} />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </div>
                  {typeMeals.map((meal: any) => (
                    <div key={meal.id} className="hv2-meal-item">
                      <span className="hv2-meal-desc">{meal.description}</span>
                      {meal.calories && <span className="hv2-meal-cals" style={{ color: mealTypeColors[type] }}>{meal.calories} kcal</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="hv2-nutrition-wrapper">
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#8BA4BE' }}>Loading nutrition…</div>}>
          <NutritionSystem />
        </Suspense>
      </div>
    </div>
  );
}
