/**
 * LifePulseModal — Timed popup for mood/energy/water check-ins.
 *
 * Appears as a full-screen modal overlay. Once dismissed (or logged),
 * it won't reappear until the next check-in window.
 *
 * Check-in windows: every 4 hours starting from 6 AM
 *   → 06:00, 10:00, 14:00, 18:00, 22:00
 *
 * Persistence: localStorage key per window, e.g.
 *   lifeos_pulse_dismissed_2026-03-15_10
 * so each window is independently tracked.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Minus, Plus, Droplets, Frown, Meh, Smile } from 'lucide-react';
import { useHealthMetrics } from '../hooks/useHealthMetrics';
import { useGamificationContext } from '../lib/gamification/context';
import { useUserStore } from '../stores/useUserStore';
import { showToast } from './Toast';
import './LifePulseModal.css';

// ── Config ──
const CHECKIN_HOURS = [6, 10, 14, 18, 22]; // 6am, 10am, 2pm, 6pm, 10pm
const CHECK_INTERVAL_MS = 60_000; // Re-check every 60s whether a new window opened

const today = () => new Date().toISOString().split('T')[0];

/** Which check-in window are we in right now? Returns the hour (6,10,14,18,22) or null if outside all. */
function getCurrentWindow(): number | null {
  const now = new Date();
  const hour = now.getHours();

  // Find the most recent window that has started
  let currentWindow: number | null = null;
  for (const h of CHECKIN_HOURS) {
    if (hour >= h) currentWindow = h;
  }
  return currentWindow;
}

/** localStorage key for a specific check-in window (user-scoped) */
function windowKey(userId: string, windowHour: number): string {
  return `lifeos_pulse_dismissed_${userId}_${today()}_${windowHour}`;
}

/** Check if a specific window has been dismissed today */
function isWindowDismissed(userId: string, windowHour: number): boolean {
  try {
    return localStorage.getItem(windowKey(userId, windowHour)) !== null;
  } catch {
    return false;
  }
}

/** Mark a window as dismissed */
function dismissWindow(userId: string, windowHour: number): void {
  try {
    localStorage.setItem(windowKey(userId, windowHour), Date.now().toString());
  } catch { /* Safari private mode */ }
}

const MOOD_OPTIONS = [
  { icon: Frown, label: 'Awful', value: 1, color: '#F43F5E' },
  { icon: Frown, label: 'Bad', value: 2, color: '#F97316' },
  { icon: Meh, label: 'Okay', value: 3, color: '#EAB308' },
  { icon: Smile, label: 'Good', value: 4, color: '#39FF14' },
  { icon: Smile, label: 'Great', value: 5, color: '#00D4FF' },
];

const ENERGY_OPTIONS = [
  { value: 1, color: '#F43F5E' },
  { value: 2, color: '#F97316' },
  { value: 3, color: '#EAB308' },
  { value: 4, color: '#39FF14' },
  { value: 5, color: '#00D4FF' },
];

function getTimeLabel(hour: number): string {
  if (hour === 6) return 'Morning';
  if (hour === 10) return 'Mid-Morning';
  if (hour === 14) return 'Afternoon';
  if (hour === 18) return 'Evening';
  if (hour === 22) return 'Night';
  return 'Check-in';
}

export function LifePulseModal() {
  const user = useUserStore(s => s.user);
  const { data, upsertToday } = useHealthMetrics();
  const { awardXP } = useGamificationContext();
  const xpRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const [activeWindow, setActiveWindow] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [water, setWater] = useState<number>(0);
  const [closing, setClosing] = useState(false);

  // Sync from existing today's data
  const todayMetrics = useMemo(() => data.find(m => m.date === today()), [data]);
  const initialized = useRef(false);
  if (!initialized.current && todayMetrics) {
    initialized.current = true;
    if (todayMetrics.mood_score) setMood(todayMetrics.mood_score);
    if (todayMetrics.energy_score) setEnergy(todayMetrics.energy_score);
    if (todayMetrics.water_glasses) setWater(todayMetrics.water_glasses);
  }

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    const todayDate = new Date(today() + 'T00:00:00');
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      const entry = sorted.find(m => m.date === expectedStr);
      if (entry && (entry.mood_score || entry.energy_score || entry.water_glasses)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [data]);

  // Check for new windows periodically
  useEffect(() => {
    if (!user) return;

    const check = () => {
      const win = getCurrentWindow();
      if (win !== null && !isWindowDismissed(user.id, win)) {
        setActiveWindow(win);
        setVisible(true);
      }
    };

    check(); // Check immediately
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  const animateClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 300);
  }, []);

  const handleDismiss = useCallback(() => {
    if (activeWindow !== null && user) {
      dismissWindow(user.id, activeWindow);
    }
    // Reset for next window
    setMood(null);
    setEnergy(null);
    setWater(0);
    initialized.current = false;
    xpRef.current = false;
    animateClose();
  }, [activeWindow, animateClose, user]);

  const save = useCallback(async (updates: Record<string, unknown>) => {
    await upsertToday(updates as any);
    if (!xpRef.current) {
      awardXP('health_log', { description: 'Life Pulse check-in' });
      xpRef.current = true;
    }
    showToast('Logged!', '✓', '#39FF14');
  }, [upsertToday, awardXP]);

  const handleMood = useCallback((val: number) => {
    setMood(val);
    save({ mood_score: val });
  }, [save]);

  const handleEnergy = useCallback((val: number) => {
    setEnergy(val);
    save({ energy_score: val });
  }, [save]);

  const handleWater = useCallback((delta: number) => {
    const next = Math.max(0, water + delta);
    setWater(next);
    save({ water_glasses: next });
  }, [save, water]);

  const handleDone = useCallback(() => {
    if (activeWindow !== null && user) {
      dismissWindow(user.id, activeWindow);
    }
    animateClose();
  }, [activeWindow, animateClose, user]);

  if (!visible || !user) return null;

  const timeLabel = activeWindow !== null ? getTimeLabel(activeWindow) : 'Check-in';

  return (
    <div className={`lp-modal-overlay ${closing ? 'lp-closing' : ''}`} onClick={handleDismiss}>
      <div className={`lp-modal ${closing ? 'lp-modal-closing' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="lp-close" onClick={handleDismiss} aria-label="Dismiss">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="lp-header">
          <div className="lp-title">Life Pulse</div>
          <div className="lp-subtitle">{timeLabel} Check-in</div>
          {streak > 1 && <div className="lp-streak">🔥 {streak} day streak</div>}
        </div>

        {/* Mood */}
        <div className="lp-section">
          <div className="lp-label">How are you feeling?</div>
          <div className="lp-row">
            {MOOD_OPTIONS.map(m => {
              const Icon = m.icon;
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  className={`lp-btn ${active ? 'lp-btn-active' : ''}`}
                  onClick={() => handleMood(m.value)}
                  style={{
                    borderColor: active ? m.color : undefined,
                    background: active ? m.color + '18' : undefined,
                  }}
                  aria-label={m.label}
                >
                  <Icon size={22} color={active ? m.color : 'var(--text-muted)'} />
                  <span className="lp-btn-label" style={{ color: active ? m.color : undefined }}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Energy */}
        <div className="lp-section">
          <div className="lp-label">Energy level?</div>
          <div className="lp-row">
            {ENERGY_OPTIONS.map(e => {
              const active = energy === e.value;
              return (
                <button
                  key={e.value}
                  className={`lp-btn ${active ? 'lp-btn-active' : ''}`}
                  onClick={() => handleEnergy(e.value)}
                  style={{
                    borderColor: active ? e.color : undefined,
                    background: active ? e.color + '18' : undefined,
                    color: active ? e.color : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                  aria-label={`Energy ${e.value}`}
                >
                  {e.value}
                </button>
              );
            })}
          </div>
        </div>

        {/* Water */}
        <div className="lp-section">
          <div className="lp-label">Glasses of water</div>
          <div className="lp-water-row">
            <button className="lp-water-btn" onClick={() => handleWater(-1)} aria-label="Decrease water">
              <Minus size={18} />
            </button>
            <div className="lp-water-count">
              <Droplets size={18} color="#00D4FF" />
              <span>{water}</span>
            </div>
            <button className="lp-water-btn" onClick={() => handleWater(1)} aria-label="Increase water">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Done button */}
        <button className="lp-done" onClick={handleDone}>
          Done
        </button>
      </div>
    </div>
  );
}
