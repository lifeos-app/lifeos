/**
 * AI Meal Suggestions Component
 *
 * Shows 3-5 AI-generated meal ideas with nutritional info,
 * macro bars, "Add to Grocery List", and "Add to Schedule" integration.
 *
 * Supports `compact` mode for the quick-access widget in DietTab.
 *
 * Pro feature — free tier sees a basic macro summary instead.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, RefreshCw, ShoppingCart, Clock, ChevronDown, ChevronUp,
  Sunrise, Sun, Moon, Cookie, AlertTriangle, Zap, Check, Loader2,
  Lock, Calendar, CalendarPlus,
} from 'lucide-react';
import {
  generateMealSuggestions,
  addSuggestionToGroceryList,
  clearSuggestionsCache,
  type MealSuggestion,
  type MealSuggestionsResult,
} from '../../lib/llm/meal-suggestions';
import { createScheduleEvent } from '../../lib/schedule-events';
import { supabase } from '../../lib/supabase';
import { canAccess } from '../../lib/feature-gates';
import { useSubscription } from '../../hooks/useSubscription';
import { logger } from '../../utils/logger';

// ── Constants ──────────────────────────────────────────────────────────────────

const MEAL_TYPE_ICON: Record<string, React.ReactNode> = {
  breakfast: <Sunrise size={14} />,
  lunch: <Sun size={14} />,
  dinner: <Moon size={14} />,
  snack: <Cookie size={14} />,
};

const MEAL_TYPE_COLOR: Record<string, string> = {
  breakfast: '#F97316',
  lunch: '#39FF14',
  dinner: '#818CF8',
  snack: '#FACC15',
};

/** Default meal times (hours:minutes) */
const DEFAULT_MEAL_TIMES: Record<string, { hour: number; minute: number }> = {
  breakfast: { hour: 7, minute: 30 },
  lunch: { hour: 12, minute: 30 },
  snack: { hour: 15, minute: 0 },
  dinner: { hour: 18, minute: 30 },
};

function getMealTimeISO(mealType: string, dateOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dateOffset);
  const time = DEFAULT_MEAL_TIMES[mealType] || { hour: 12, minute: 0 };
  d.setHours(time.hour, time.minute, 0, 0);
  return d.toISOString();
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AIMealSuggestionsProps {
  /** Show compact mode (fewer suggestions, smaller cards) */
  compact?: boolean;
  /** Max number of suggestions to display */
  maxSuggestions?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AIMealSuggestions({ compact = false, maxSuggestions }: AIMealSuggestionsProps) {
  const { tier, upgrade } = useSubscription();
  const isPro = canAccess('health_analytics', tier);

  const [result, setResult] = useState<MealSuggestionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groceryAdded, setGroceryAdded] = useState<Set<string>>(new Set());
  const [addingGrocery, setAddingGrocery] = useState<string | null>(null);

  // Schedule state
  const [schedulePrompt, setSchedulePrompt] = useState<string | null>(null); // suggestion id being prompted
  const [scheduleTime, setScheduleTime] = useState<string>(''); // editable time string
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());
  const [schedulingWeek, setSchedulingWeek] = useState(false);
  const [weekScheduleCount, setWeekScheduleCount] = useState(0);

  const fetchSuggestions = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateMealSuggestions({ forceRefresh: force });
      setResult(data);
    } catch (err: any) {
      logger.error('[AIMealSuggestions]', err);
      setError(err.message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (isPro) {
      fetchSuggestions();
    }
  }, [fetchSuggestions, isPro]);

  const handleRefresh = () => {
    clearSuggestionsCache();
    fetchSuggestions(true);
  };

  const handleAddToGrocery = async (suggestion: MealSuggestion) => {
    setAddingGrocery(suggestion.id);
    try {
      const ok = await addSuggestionToGroceryList(suggestion);
      if (ok) {
        setGroceryAdded(prev => new Set(prev).add(suggestion.id));
      }
    } catch (err) {
      logger.error('[addToGrocery]', err);
    } finally {
      setAddingGrocery(null);
    }
  };

  // ── Schedule a single meal ──
  const handleSchedulePrompt = (suggestion: MealSuggestion) => {
    const time = DEFAULT_MEAL_TIMES[suggestion.meal_type] || { hour: 12, minute: 0 };
    setScheduleTime(formatTime(time.hour, time.minute));
    setSchedulePrompt(suggestion.id);
  };

  const handleScheduleConfirm = async (suggestion: MealSuggestion) => {
    setScheduling(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      // Parse the editable time
      const timeMatch = scheduleTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      let hour = DEFAULT_MEAL_TIMES[suggestion.meal_type]?.hour || 12;
      let minute = DEFAULT_MEAL_TIMES[suggestion.meal_type]?.minute || 0;

      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
        minute = parseInt(timeMatch[2]);
        const ampm = (timeMatch[3] || '').toUpperCase();
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
      }

      const startTime = new Date();
      startTime.setHours(hour, minute, 0, 0);

      // If time already passed today, schedule for tomorrow
      if (startTime.getTime() < Date.now()) {
        startTime.setDate(startTime.getDate() + 1);
      }

      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      await createScheduleEvent(supabase, {
        userId: userData.user.id,
        title: `🍽️ ${suggestion.name}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        eventType: 'meal',
        scheduleLayer: 'primary',
        source: 'webapp',
        description: `Calories: ${suggestion.calories} | P: ${suggestion.protein_g}g C: ${suggestion.carbs_g}g F: ${suggestion.fat_g}g | ${suggestion.description}`,
      });

      setScheduled(prev => new Set(prev).add(suggestion.id));
      setSchedulePrompt(null);

      // Dispatch refresh event
      window.dispatchEvent(new CustomEvent('lifeos-refresh'));
    } catch (err) {
      logger.error('[scheduleMeal]', err);
    } finally {
      setScheduling(false);
    }
  };

  // ── Schedule all suggestions for the week ──
  const handleScheduleWeek = async () => {
    if (!result?.suggestions?.length) return;
    setSchedulingWeek(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const userId = userData.user.id;

      let count = 0;
      // Spread suggestions across 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        for (const suggestion of result.suggestions) {
          const time = DEFAULT_MEAL_TIMES[suggestion.meal_type] || { hour: 12, minute: 0 };
          const startTime = new Date();
          startTime.setDate(startTime.getDate() + dayOffset);
          startTime.setHours(time.hour, time.minute, 0, 0);
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

          await createScheduleEvent(supabase, {
            userId,
            title: `🍽️ ${suggestion.name}`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            eventType: 'meal',
            scheduleLayer: 'primary',
            source: 'webapp',
            description: `Calories: ${suggestion.calories} | P: ${suggestion.protein_g}g C: ${suggestion.carbs_g}g F: ${suggestion.fat_g}g | ${suggestion.description}`,
          });
          count++;
        }
      }

      setWeekScheduleCount(count);
      window.dispatchEvent(new CustomEvent('lifeos-refresh'));
    } catch (err) {
      logger.error('[scheduleWeek]', err);
    } finally {
      setSchedulingWeek(false);
    }
  };

  // ── Free Tier Gate ──
  if (!isPro) {
    if (compact) return null; // Don't show gate in compact mode
    return (
      <div className="ai-meals-gate glass-card">
        <div className="ai-meals-gate-inner">
          <Lock size={28} style={{ color: '#FDCB6E', marginBottom: 8 }} />
          <h3>🥗 AI Meal Suggestions</h3>
          <p>Get personalized meal ideas based on your diet plan, recent meals, and health goals.</p>
          <button className="btn-glow" onClick={upgrade}>
            <Sparkles size={14} /> Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  // ── Loading State ──
  if (loading && !result) {
    return (
      <div className={`ai-meals-loading glass-card ${compact ? 'compact' : ''}`}>
        <div className="ai-meals-loading-inner">
          <Loader2 size={compact ? 20 : 28} className="spin" style={{ color: '#FDCB6E' }} />
          <h3>{compact ? 'Finding meals…' : 'Analyzing your nutrition…'}</h3>
          {!compact && <p>Checking 7-day intake, diet plan, and health metrics</p>}
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !result) {
    return (
      <div className="ai-meals-error glass-card">
        <AlertTriangle size={24} style={{ color: '#F59E0B' }} />
        <p>{error}</p>
        <button className="btn-ghost-sm" onClick={() => fetchSuggestions()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!result || !result.suggestions?.length) return null;

  // Limit displayed suggestions
  const displaySuggestions = maxSuggestions
    ? result.suggestions.slice(0, maxSuggestions)
    : result.suggestions;

  return (
    <div className={`ai-meals-section fade-in ${compact ? 'compact' : ''}`}>
      {/* Header */}
      {!compact && (
        <div className="ai-meals-header">
          <div className="ai-meals-header-left">
            <Sparkles size={16} style={{ color: '#FDCB6E' }} />
            <h3>AI Meal Suggestions</h3>
          </div>
          <div className="ai-meals-header-actions">
            {!schedulingWeek && weekScheduleCount === 0 && (
              <button
                className="btn-ghost-sm ai-meals-week-btn"
                onClick={handleScheduleWeek}
                title="Schedule all meals for the week"
              >
                <CalendarPlus size={13} /> Week Plan
              </button>
            )}
            {schedulingWeek && (
              <span className="ai-meals-scheduling">
                <Loader2 size={13} className="spin" /> Scheduling…
              </span>
            )}
            {weekScheduleCount > 0 && (
              <span className="ai-meals-week-done">
                <Check size={13} /> Created {weekScheduleCount} meal events
              </span>
            )}
            <button
              className="btn-ghost-sm ai-meals-refresh"
              onClick={handleRefresh}
              disabled={loading}
              title="Generate new suggestions"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              {loading ? 'Generating…' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {!compact && result.summary && (
        <div className="ai-meals-summary">
          <p>{result.summary}</p>
        </div>
      )}

      {/* Nutrient Gaps */}
      {!compact && result.nutrient_gaps && result.nutrient_gaps.length > 0 && (
        <div className="ai-meals-gaps">
          {result.nutrient_gaps.map((gap, i) => (
            <span key={i} className="ai-meals-gap-pill">
              <AlertTriangle size={11} /> {gap}
            </span>
          ))}
        </div>
      )}

      {/* Suggestion Cards */}
      <div className="ai-meals-list">
        {displaySuggestions.map(suggestion => {
          const isExpanded = !compact && expandedId === suggestion.id;
          const isGroceryAdded = groceryAdded.has(suggestion.id);
          const isAddingThis = addingGrocery === suggestion.id;
          const isScheduled = scheduled.has(suggestion.id);
          const isSchedulePromptOpen = schedulePrompt === suggestion.id;
          const mealColor = MEAL_TYPE_COLOR[suggestion.meal_type] || '#FDCB6E';
          const totalMacroG = (suggestion.protein_g || 0) + (suggestion.carbs_g || 0) + (suggestion.fat_g || 0);
          const proteinPct = totalMacroG > 0 ? ((suggestion.protein_g / totalMacroG) * 100) : 33;
          const carbsPct = totalMacroG > 0 ? ((suggestion.carbs_g / totalMacroG) * 100) : 34;
          const fatPct = totalMacroG > 0 ? ((suggestion.fat_g / totalMacroG) * 100) : 33;

          return (
            <div
              key={suggestion.id}
              className={`ai-meal-card glass-card ${isExpanded ? 'expanded' : ''} ${compact ? 'compact' : ''}`}
              style={{ '--meal-accent': mealColor } as any}
            >
              {/* Compact Header */}
              <div
                className="ai-meal-card-header"
                onClick={() => !compact && setExpandedId(isExpanded ? null : suggestion.id)}
              >
                <span className="ai-meal-emoji">{suggestion.emoji || '🍽️'}</span>
                <div className="ai-meal-info">
                  <div className="ai-meal-name-row">
                    <span className="ai-meal-name">{suggestion.name}</span>
                    <span className="ai-meal-type-badge" style={{ color: mealColor }}>
                      {MEAL_TYPE_ICON[suggestion.meal_type]} {suggestion.meal_type}
                    </span>
                  </div>
                  <div className="ai-meal-meta">
                    <span className="ai-meal-cal">🔥 {suggestion.calories} cal</span>
                    {suggestion.prep_time_min > 0 && (
                      <span className="ai-meal-prep">
                        <Clock size={11} /> {suggestion.prep_time_min}m
                      </span>
                    )}
                  </div>
                </div>
                {!compact && (
                  <span className="ai-meal-chevron">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                )}
              </div>

              {/* Macros Bar — always visible */}
              <div className="ai-meal-macros-bar">
                <div className="ai-meal-macros-track">
                  <div className="ai-meal-macro-seg protein" style={{ width: `${proteinPct}%` }} />
                  <div className="ai-meal-macro-seg carbs" style={{ width: `${carbsPct}%` }} />
                  <div className="ai-meal-macro-seg fat" style={{ width: `${fatPct}%` }} />
                </div>
                <div className="ai-meal-macros-labels">
                  <span style={{ color: '#39FF14' }}>P {suggestion.protein_g}g</span>
                  <span style={{ color: '#3B82F6' }}>C {suggestion.carbs_g}g</span>
                  <span style={{ color: '#F59E0B' }}>F {suggestion.fat_g}g</span>
                </div>
              </div>

              {/* Schedule Prompt (inline) */}
              {isSchedulePromptOpen && (
                <div className="ai-meal-schedule-prompt fade-in" onClick={e => e.stopPropagation()}>
                  <Calendar size={14} style={{ color: '#FDCB6E' }} />
                  <span className="amsp-label">Add to schedule at</span>
                  <input
                    type="text"
                    className="amsp-time-input"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    placeholder="7:30 AM"
                  />
                  <button
                    className="btn-glow-sm amsp-confirm"
                    onClick={() => handleScheduleConfirm(suggestion)}
                    disabled={scheduling}
                  >
                    {scheduling ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                    {scheduling ? '' : 'Add'}
                  </button>
                  <button
                    className="btn-ghost-sm amsp-cancel"
                    onClick={() => setSchedulePrompt(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Compact mode: quick schedule button */}
              {compact && !isScheduled && !isSchedulePromptOpen && (
                <div className="ai-meal-compact-actions">
                  <button
                    className="btn-ghost-sm ai-meal-schedule-btn"
                    onClick={(e) => { e.stopPropagation(); handleSchedulePrompt(suggestion); }}
                  >
                    <Calendar size={12} /> Schedule
                  </button>
                </div>
              )}
              {compact && isScheduled && (
                <div className="ai-meal-compact-actions">
                  <span className="ai-meal-scheduled-badge"><Check size={11} /> Scheduled</span>
                </div>
              )}

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="ai-meal-detail fade-in">
                  {/* Description */}
                  <p className="ai-meal-desc">{suggestion.description}</p>

                  {/* Reason */}
                  {suggestion.reason && (
                    <div className="ai-meal-reason">
                      <Zap size={12} style={{ color: '#FDCB6E' }} />
                      <span>{suggestion.reason}</span>
                    </div>
                  )}

                  {/* Ingredients */}
                  {suggestion.ingredients && suggestion.ingredients.length > 0 && (
                    <div className="ai-meal-ingredients">
                      <h4>Ingredients</h4>
                      <div className="ai-meal-ing-list">
                        {suggestion.ingredients.map((ing, i) => (
                          <div key={i} className="ai-meal-ing-item">
                            <span className="ai-meal-ing-dot" />
                            <span className="ai-meal-ing-name">{ing.name}</span>
                            <span className="ai-meal-ing-qty">{ing.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="ai-meal-actions">
                    {/* Add to Schedule */}
                    {!isScheduled && !isSchedulePromptOpen && (
                      <button
                        className="btn-ghost-sm ai-meal-schedule-btn"
                        onClick={(e) => { e.stopPropagation(); handleSchedulePrompt(suggestion); }}
                      >
                        <Calendar size={13} /> Add to Schedule
                      </button>
                    )}
                    {isScheduled && (
                      <span className="ai-meal-scheduled-badge">
                        <Check size={13} /> Scheduled
                      </span>
                    )}

                    {/* Add to Grocery */}
                    <button
                      className={`btn-ghost-sm ai-meal-grocery-btn ${isGroceryAdded ? 'added' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isGroceryAdded) handleAddToGrocery(suggestion);
                      }}
                      disabled={isGroceryAdded || isAddingThis}
                    >
                      {isAddingThis ? (
                        <><Loader2 size={13} className="spin" /> Adding…</>
                      ) : isGroceryAdded ? (
                        <><Check size={13} /> Added to Grocery List</>
                      ) : (
                        <><ShoppingCart size={13} /> Add to Grocery List</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Timestamp */}
      {!compact && result.generated_at && (
        <div className="ai-meals-timestamp">
          Generated {new Date(result.generated_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
      )}
    </div>
  );
}
