/**
 * HabitWidgetPage.tsx — PWA Widget Page for Mobile Home Screen
 *
 * Ultra-minimal habit tracker page designed for iOS/Android "Add to Home Screen".
 * NO sidebar, NO navigation, NO chrome, NO AuthGuard.
 * Reads directly from localStorage (IndexedDB) via local-db.
 * Auto-refreshes every 30 seconds.
 *
 * URL: /widget/habits
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Check, Flame, Plus, Zap } from 'lucide-react';
import { localGetAll, localInsert, localDelete, localUpdate, getEffectiveUserId } from '../lib/local-db';
import { localDateStr, genId } from '../utils/date';
import { calculateStreak } from '../stores/useHabitsStore';
import { getWidgetData, getWidgetCategoryColor, loadWidgetConfig, type HabitsWidgetData } from '../lib/pwa-widget';
import type { Habit, HabitLog } from '../types/database';

// ── Dark Theme Constants ────────────────────────────────────────

const BG = '#0A1628';
const ACCENT = '#00E5FF';
const SURFACE = '#0F2240';
const TEXT = '#E2E8F0';
const TEXT_MUTED = '#7B8FA8';
const TEXT_DIM = '#4A5E76';
const SUCCESS = '#39FF14';
const DIVIDER = 'rgba(255,255,255,0.06)';

const styles = {
  root: {
    minHeight: '100dvh',
    background: BG,
    color: TEXT,
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    padding: '12px',
    maxWidth: '400px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    padding: '0 2px',
  },
  headerTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    margin: 0,
  },
  headerBadge: {
    fontSize: '11px',
    color: ACCENT,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  habitList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  habitRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 10px',
    borderRadius: '10px',
    background: SURFACE,
    gap: '10px',
    transition: 'background 0.15s ease',
    cursor: 'pointer',
  },
  checkBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s ease',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
  },
  checkBtnDone: {
    borderColor: SUCCESS,
    background: SUCCESS,
  },
  checkBtnPending: {
    borderColor: TEXT_DIM,
  },
  habitName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  habitNameDone: {
    textDecoration: 'line-through' as const,
    opacity: 0.6,
  },
  streakBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    color: TEXT_MUTED,
    flexShrink: 0,
  },
  categoryDot: {
    width: '4px',
    height: '24px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  statsLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '10px 4px 4px',
    fontSize: '12px',
    fontWeight: 500,
    color: TEXT_MUTED,
  },
  statsItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statsDot: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    background: TEXT_DIM,
  },
  footer: {
    textAlign: 'center' as const,
    padding: '8px 0 4px',
    fontSize: '10px',
    color: TEXT_DIM,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  quickAddBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    borderRadius: '10px',
    border: `1px dashed ${TEXT_DIM}`,
    background: 'transparent',
    color: TEXT_MUTED,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  xpFlash: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '24px',
    fontWeight: 800,
    color: ACCENT,
    pointerEvents: 'none' as const,
    zIndex: 9999,
    animation: 'xpFlashAnim 1.2s ease-out forwards',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 16px',
    color: TEXT_MUTED,
  },
  emptyIcon: {
    fontSize: '36px',
    marginBottom: '8px',
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: TEXT,
    marginBottom: '4px',
  },
  emptySub: {
    fontSize: '12px',
    color: TEXT_DIM,
  },
};

// ── XP Flash Animation ──────────────────────────────────────────

function addXPFlashStyle() {
  if (document.getElementById('widget-xp-flash-style')) return;
  const style = document.createElement('style');
  style.id = 'widget-xp-flash-style';
  style.textContent = `
    @keyframes xpFlashAnim {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.9; transform: translate(-50%, -70%) scale(1.3); }
      100% { opacity: 0; transform: translate(-50%, -100%) scale(0.8); }
    }
  `;
  document.head.appendChild(style);
}

// ── Component ───────────────────────────────────────────────────

export function HabitWidgetPage() {
  const [data, setData] = useState<HabitsWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [xpFlash, setXpFlash] = useState<number | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const addInputRef = useRef<HTMLInputElement>(null);

  const config = loadWidgetConfig();

  const refreshData = useCallback(async () => {
    try {
      const widgetData = await getWidgetData('habits');
      setData(widgetData);
    } catch (err) {
      console.error('[widget] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    addXPFlashStyle();
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 30_000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Toggle a habit's completion for today
  const toggleHabit = useCallback(async (habit: Habit) => {
    if (togglingIds.has(habit.id)) return;

    const todayStr = localDateStr(new Date());
    const dayLogs = (data?.logs || []).filter(l => l.habit_id === habit.id && l.date === todayStr);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    const isDone = total >= (habit.target_count || 1);

    setTogglingIds(prev => new Set(prev).add(habit.id));

    try {
      if (isDone) {
        // Undo — delete today's logs for this habit
        for (const log of dayLogs) {
          await localDelete('habit_logs', log.id);
        }
      } else {
        // Mark done
        await localInsert('habit_logs', {
          id: genId(),
          user_id: getEffectiveUserId(),
          habit_id: habit.id,
          date: todayStr,
          count: 1,
          created_at: new Date().toISOString(),
        });

        // Flash XP indicator (5 base XP per habit)
        setXpFlash(5);
        setTimeout(() => setXpFlash(null), 1200);
      }

      // Recalculate streak for this habit
      const allLogs = await localGetAll<HabitLog>('habit_logs');
      const { current, best } = calculateStreak(habit.id, allLogs);
      const prevBest = habit.streak_best || 0;
      await localUpdate('habits', habit.id, {
        streak_current: current,
        streak_best: Math.max(best, prevBest),
      }).catch(() => {});

      await refreshData();
    } catch (err) {
      console.error('[widget] Failed to toggle habit:', err);
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(habit.id);
        return next;
      });
    }
  }, [data, togglingIds, refreshData]);

  // Quick-add a new habit
  const handleAddHabit = useCallback(async () => {
    const title = newHabitTitle.trim();
    if (!title) return;

    try {
      await localInsert('habits', {
        id: genId(),
        user_id: getEffectiveUserId(),
        title,
        icon: 'circle-dot',
        frequency: 'daily',
        is_active: true,
        target_count: 1,
        streak_current: 0,
        streak_best: 0,
        is_deleted: false,
        created_at: new Date().toISOString(),
      });

      setNewHabitTitle('');
      setShowAddForm(false);
      await refreshData();
    } catch (err) {
      console.error('[widget] Failed to add habit:', err);
    }
  }, [newHabitTitle, refreshData]);

  // Check if a habit is done today
  const isHabitDone = (habit: Habit): boolean => {
    const todayStr = localDateStr(new Date());
    const dayLogs = (data?.logs || []).filter(l => l.habit_id === habit.id && l.date === todayStr);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    return total >= (habit.target_count || 1);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div style={styles.root}>
        <div style={{ ...styles.emptyState, padding: '48px 16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!data || data.habits.length === 0) {
    return (
      <div style={styles.root}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Today's Habits</h1>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✦</div>
          <div style={styles.emptyTitle}>No habits yet</div>
          <div style={styles.emptySub}>Add your first habit to get started</div>
        </div>
        <button
          style={styles.quickAddBtn}
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={16} /> Add Habit
        </button>
        {showAddForm && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
            <input
              ref={addInputRef}
              type="text"
              value={newHabitTitle}
              onChange={e => setNewHabitTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              placeholder="Habit name..."
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${TEXT_DIM}`,
                background: SURFACE,
                color: TEXT,
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddHabit}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: ACCENT,
                color: BG,
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  }

  const { habits, todayDone, todayTotal, bestStreak, totalXP } = data;
  const todayStr = localDateStr(new Date());

  return (
    <div style={styles.root}>
      {/* XP Flash overlay */}
      {xpFlash !== null && (
        <div style={styles.xpFlash}>
          <Zap size={18} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
          +{xpFlash} XP
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Today's Habits</h1>
        <div style={styles.headerBadge}>
          <Zap size={13} />
          <span>{totalXP} XP</span>
        </div>
      </div>

      {/* Habit list */}
      <div style={styles.habitList}>
        {habits
          .sort((a, b) => {
            // Done items go to bottom
            const aDone = isHabitDone(a) ? 1 : 0;
            const bDone = isHabitDone(b) ? 1 : 0;
            if (aDone !== bDone) return aDone - bDone;
            // Then by streak (highest first)
            return (b.streak_current || 0) - (a.streak_current || 0);
          })
          .map(habit => {
            const done = isHabitDone(habit);
            const catColor = getWidgetCategoryColor(habit.category);
            const isToggling = togglingIds.has(habit.id);
            const streak = habit.streak_current || 0;

            return (
              <div
                key={habit.id}
                style={styles.habitRow}
                onClick={() => toggleHabit(habit)}
              >
                {/* Category color bar */}
                <div style={{
                  ...styles.categoryDot,
                  background: catColor,
                  opacity: done ? 0.4 : 1,
                }} />

                {/* Check button */}
                <button
                  style={{
                    ...styles.checkBtn,
                    ...(done ? styles.checkBtnDone : styles.checkBtnPending),
                    opacity: isToggling ? 0.5 : 1,
                    minWidth: '28px',
                    minHeight: '28px',
                  }}
                  aria-label={done ? 'Mark as not done' : 'Mark as done'}
                >
                  {done && <Check size={15} color={BG} strokeWidth={3} />}
                </button>

                {/* Habit name */}
                <span style={{
                  ...styles.habitName,
                  ...(done ? styles.habitNameDone : {}),
                }}>
                  {habit.title}
                </span>

                {/* Streak badge */}
                {streak > 0 && (
                  <span style={{
                    ...styles.streakBadge,
                    color: streak >= 7 ? '#F97316' : TEXT_MUTED,
                    background: streak >= 7 ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',
                  }}>
                    <Flame size={11} />
                    {streak}
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {/* Quick add button */}
      {!showAddForm ? (
        <button
          style={styles.quickAddBtn}
          onClick={() => {
            setShowAddForm(true);
            setTimeout(() => addInputRef.current?.focus(), 50);
          }}
        >
          <Plus size={15} /> Quick Add
        </button>
      ) : (
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
          <input
            ref={addInputRef}
            type="text"
            value={newHabitTitle}
            onChange={e => setNewHabitTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddHabit();
              if (e.key === 'Escape') { setShowAddForm(false); setNewHabitTitle(''); }
            }}
            placeholder="New habit name..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1px solid ${TEXT_DIM}`,
              background: SURFACE,
              color: TEXT,
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddHabit}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: ACCENT,
              color: BG,
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewHabitTitle(''); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1px solid ${TEXT_DIM}`,
              background: 'transparent',
              color: TEXT_MUTED,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats line */}
      <div style={styles.statsLine}>
        <span style={styles.statsItem}>
          <Check size={12} color={SUCCESS} />
          {todayDone}/{todayTotal} done
        </span>
        <span style={styles.statsDot} />
        <span style={styles.statsItem}>
          <Flame size={12} color="#F97316" />
          {bestStreak} day streak
        </span>
        <span style={styles.statsDot} />
        <span style={styles.statsItem}>
          <Zap size={12} color={ACCENT} />
          {totalXP} XP
        </span>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        LifeOS · {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}