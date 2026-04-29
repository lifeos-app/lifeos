/**
 * NotificationPrefsPanel — UI for per-category toggles, quiet hours, digest, sound
 *
 * Uses existing Settings CSS classes (.set-section, .set-section-header, etc.)
 * No emoji. Lucide React icons only. Dark theme palette.
 */
import { useState, type JSX } from 'react';
import {
  Bell, Target, Flame, Trophy, Users, Settings,
  Brain, Swords, Moon, Mail, RotateCcw, Volume2, VolumeX,
} from 'lucide-react';
import {
  NotificationCategory,
  CATEGORY_LABELS,
  type NotificationPreferences,
  type CategoryChannelPrefs,
  getPreferences,
  updatePreferences,
  resetToDefaults,
} from '../lib/notification-preferences';

// ── Icon mapping ──

const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  [NotificationCategory.HabitReminder]: Bell,
  [NotificationCategory.GoalProgress]: Target,
  [NotificationCategory.StreakWarning]: Flame,
  [NotificationCategory.Achievement]: Trophy,
  [NotificationCategory.Social]: Users,
  [NotificationCategory.System]: Settings,
  [NotificationCategory.AIInsight]: Brain,
  [NotificationCategory.Challenge]: Swords,
};

const CATEGORY_ORDER: NotificationCategory[] = [
  NotificationCategory.HabitReminder,
  NotificationCategory.GoalProgress,
  NotificationCategory.StreakWarning,
  NotificationCategory.Achievement,
  NotificationCategory.Social,
  NotificationCategory.System,
  NotificationCategory.AIInsight,
  NotificationCategory.Challenge,
];

// ── Toggle component ──

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={`set-toggle ${value ? 'on' : 'off'}`}
      onClick={() => onChange(!value)}
      aria-label={label}
      title={label}
    >
      <span className="set-toggle-dot" />
      <span className="set-toggle-label">{value ? 'On' : 'Off'}</span>
    </button>
  );
}

// ── Main component ──

export function NotificationPrefsPanel(): JSX.Element {
  const [prefs, setPrefs] = useState<NotificationPreferences>(getPreferences);

  // Category toggle handler
  const handleCategoryToggle = (category: NotificationCategory, channel: keyof CategoryChannelPrefs, value: boolean) => {
    const updated = updatePreferences({
      categories: {
        ...prefs.categories,
        [category]: {
          ...prefs.categories[category],
          [channel]: value,
        },
      },
    });
    setPrefs(updated);
  };

  // Quiet hours
  const handleQuietHoursToggle = (enabled: boolean) => {
    const updated = updatePreferences({
      quietHours: { ...prefs.quietHours, enabled },
    });
    setPrefs(updated);
  };

  const handleQuietHoursTime = (field: 'startTime' | 'endTime', value: string) => {
    const updated = updatePreferences({
      quietHours: { ...prefs.quietHours, [field]: value },
    });
    setPrefs(updated);
  };

  // Daily digest
  const handleDailyDigestToggle = (value: boolean) => {
    const updated = updatePreferences({ dailyDigest: value });
    setPrefs(updated);
  };

  // Sound
  const handleSoundToggle = (value: boolean) => {
    const updated = updatePreferences({ sound: value });
    setPrefs(updated);
  };

  // Reset
  const handleReset = () => {
    const defaults = resetToDefaults();
    setPrefs(defaults);
  };

  return (
    <>
      {/* ── Categories ── */}
      <section className="set-section">
        <div className="set-section-header">
          <Bell size={18} />
          <h2>Notification Categories</h2>
        </div>
        <p className="set-section-desc">Choose which types of notifications you want to receive.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {CATEGORY_ORDER.map(cat => {
            const Icon = CATEGORY_ICONS[cat];
            const catPrefs = prefs.categories[cat];
            return (
              <div
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(26,58,92,0.15)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <Icon size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </span>
                <Toggle
                  value={catPrefs.in_app}
                  onChange={v => handleCategoryToggle(cat, 'in_app', v)}
                  label={`${CATEGORY_LABELS[cat]} in-app`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Schedule ── */}
      <section className="set-section">
        <div className="set-section-header">
          <Moon size={18} />
          <h2>Schedule</h2>
        </div>
        <p className="set-section-desc">Set quiet hours and digest preferences.</p>

        {/* Quiet hours */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(26,58,92,0.15)',
            background: 'rgba(255,255,255,0.02)',
            marginBottom: 10,
          }}
        >
          <Moon size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
            Quiet Hours
          </span>
          <Toggle
            value={prefs.quietHours.enabled}
            onChange={handleQuietHoursToggle}
            label="Quiet hours"
          />
        </div>

        {prefs.quietHours.enabled && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(0,212,255,0.15)',
              background: 'rgba(0,212,255,0.04)',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>From</span>
            <input
              type="time"
              value={prefs.quietHours.startTime}
              onChange={e => handleQuietHoursTime('startTime', e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(26,58,92,0.3)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>to</span>
            <input
              type="time"
              value={prefs.quietHours.endTime}
              onChange={e => handleQuietHoursTime('endTime', e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(26,58,92,0.3)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Daily digest */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(26,58,92,0.15)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <Mail size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
            Daily Digest
          </span>
          <Toggle
            value={prefs.dailyDigest}
            onChange={handleDailyDigestToggle}
            label="Daily digest"
          />
        </div>
        {prefs.dailyDigest && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0 0', paddingLeft: 4 }}>
            Notifications will be rolled into a single daily summary instead of individual alerts.
          </p>
        )}
      </section>

      {/* ── Sound ── */}
      <section className="set-section">
        <div className="set-section-header">
          {prefs.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <h2>Sound</h2>
        </div>
        <p className="set-section-desc">Control notification sounds.</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(26,58,92,0.15)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {prefs.sound ? <Volume2 size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} /> : <VolumeX size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />}
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
            Notification Sound
          </span>
          <Toggle
            value={prefs.sound}
            onChange={handleSoundToggle}
            label="Notification sound"
          />
        </div>
      </section>

      {/* ── Reset ── */}
      <section className="set-section">
        <div className="set-section-header">
          <RotateCcw size={18} />
          <h2>Reset</h2>
        </div>
        <p className="set-section-desc">Restore all notification preferences to their default values.</p>
        <button className="set-redo-btn" onClick={handleReset}>
          <RotateCcw size={14} /> Reset to Defaults
        </button>
      </section>
    </>
  );
}