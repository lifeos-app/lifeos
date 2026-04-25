/**
 * SettingsPreferences — Theme, notifications, week start, and quick actions
 */
import { useState, useEffect, type JSX } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import {
  Palette, Sun, Moon, Bell, BellOff, CalendarDays, RotateCcw,
  Loader2, Check, AlertTriangle, Zap,
} from 'lucide-react';
import { ThemeSelector } from '../../components/settings/ThemeSelector';

type ThemeMode = 'dark' | 'light';
type WeekStart = 'monday' | 'sunday';

const PREFS_KEY = 'lifeos_preferences';

interface Prefs {
  theme: ThemeMode;
  notifications: boolean;
  weekStart: WeekStart;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { theme: 'dark', notifications: true, weekStart: 'monday' };
}

function savePrefs(prefs: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyTheme(theme: ThemeMode) {
  if (theme === 'light') {
    document.body.classList.add('lifeos-light');
  } else {
    document.body.classList.remove('lifeos-light');
  }
}

export function SettingsPreferences(): JSX.Element {
  const user = useUserStore(s => s.user);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Apply theme on mount and changes
  useEffect(() => { applyTheme(prefs.theme); }, [prefs.theme]);

  const updatePref = async (key: keyof Prefs, value: ThemeMode | boolean | WeekStart) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    savePrefs(updated);

    // Also persist to user_profiles.preferences so it syncs across devices
    if (user?.id) {
      try {
        const { data } = await supabase.from('user_profiles').select('preferences').eq('user_id', user.id).maybeSingle();
        const existing = (data?.preferences as Record<string, unknown>) || {};
        await supabase.from('user_profiles').update({
          preferences: { ...existing, theme: updated.theme, notifications: updated.notifications, weekStart: updated.weekStart },
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
      } catch { /* non-critical */ }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetOnboarding = async () => {
    if (!user?.id) return;
    setResetting(true);
    try {
      await supabase.from('user_profiles').update({
        onboarding_complete: false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      window.location.href = '/app/';
    } catch {
      setResetting(false);
    }
  };

  return (
    <section className="set-section">
      <div className="set-section-header">
        <Palette size={18} />
        <h2>Preferences</h2>
        {saved && <span className="set-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Saved</span>}
      </div>

      {/* Visual Theme — 6 color themes */}
      <ThemeSelector />

      {/* Dark/Light Mode Toggle */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
          Mode
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => updatePref('theme', 'dark')}
            className={`set-btn ${prefs.theme === 'dark' ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '12px 16px', ...(prefs.theme === 'dark' ? { background: 'rgba(0,212,255,0.08)', borderColor: 'rgba(0,212,255,0.3)', color: 'var(--cyan)' } : {}) }}
          >
            <Moon size={16} />
            <span>Dark</span>
            {prefs.theme === 'dark' && <Check size={12} />}
          </button>
          <button
            onClick={() => updatePref('theme', 'light')}
            className={`set-btn ${prefs.theme === 'light' ? 'active' : ''}`}
            style={{ flex: 1, justifySelf: 'center', padding: '12px 16px', ...(prefs.theme === 'light' ? { background: 'rgba(250,204,21,0.08)', borderColor: 'rgba(250,204,21,0.3)', color: '#FACC15' } : {}) }}
          >
            <Sun size={16} />
            <span>Light</span>
            {prefs.theme === 'light' && <Check size={12} />}
          </button>
        </div>
      </div>

      {/* Notifications Toggle */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
          Notifications
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`set-toggle ${prefs.notifications ? 'on' : 'off'}`}
            onClick={() => updatePref('notifications', !prefs.notifications)}
          >
            <span className="set-toggle-dot" />
            <span className="set-toggle-label">{prefs.notifications ? 'On' : 'Off'}</span>
          </button>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {prefs.notifications ? <Bell size={14} style={{ color: 'var(--cyan)' }} /> : <BellOff size={14} />}
            {prefs.notifications ? 'Notifications on' : 'Notifications off'}
          </span>
        </div>
      </div>

      {/* Week Starts On */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
          <CalendarDays size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Week Starts On
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['monday', 'sunday'] as WeekStart[]).map(day => (
            <button
              key={day}
              className={`set-btn ${prefs.weekStart === day ? 'active' : ''}`}
              onClick={() => updatePref('weekStart', day)}
              style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize', ...(prefs.weekStart === day ? { background: 'rgba(0,212,255,0.08)', borderColor: 'rgba(0,212,255,0.3)', color: 'var(--cyan)' } : {}) }}
            >
              {day}
              {prefs.weekStart === day && <Check size={12} />}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Zap size={12} />
          Quick Actions
        </label>
        {!showResetConfirm ? (
          <button className="set-redo-btn" onClick={() => setShowResetConfirm(true)} style={{ fontSize: 12 }}>
            <RotateCcw size={14} /> Reset Onboarding
          </button>
        ) : (
          <div className="set-redo-confirm">
            <p className="set-redo-warning">
              <AlertTriangle size={16} /> This will set onboarding_complete=false and redirect you to the onboarding quest. Existing data is preserved.
            </p>
            <div className="set-redo-actions">
              <button className="set-redo-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="set-redo-confirm-btn" onClick={handleResetOnboarding} disabled={resetting}>
                {resetting ? <><Loader2 size={14} className="spin" /> Resetting...</> : 'Yes, reset'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}