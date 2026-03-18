// LifeOS Social — Profile Setup (Public Profile Editor)

import { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import { getPublicProfile, updatePublicProfile } from '../../lib/social/profiles';
import { ALL_GOAL_CATEGORIES, GOAL_CATEGORY_LABELS } from '../../lib/social/types';
import { CategoryIcon } from './CategoryIcon';
import type { PublicProfile, GoalCategory } from '../../lib/social/types';
import { useUserStore } from '../../stores/useUserStore';
import './social.css';

interface ProfileSetupProps {
  userId: string;
  onSaved?: () => void;
}

interface ToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, sub, checked, onChange }: ToggleRowProps) {
  return (
    <div className="profile-setup__toggle-row">
      <div>
        <div className="profile-setup__toggle-label">{label}</div>
        {sub && <div className="profile-setup__toggle-sub">{sub}</div>}
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

const DEFAULT_PROFILE: Partial<PublicProfile> = {
  display_name: '',
  bio: '',
  featured_goal: '',
  goal_categories: [],
  looking_for_partner: false,
  show_goals: false,
  show_habits: false,
  show_stats: true,
  show_streak: true,
  show_level: true,
};

export function ProfileSetup({ userId, onSaved }: ProfileSetupProps) {
  const appProfile = useUserStore(s => s.profile);
  const [form, setForm] = useState<Partial<PublicProfile>>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load existing profile
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const existing = await getPublicProfile(userId);
      if (existing) {
        setForm(existing);
      } else {
        // Pre-fill from app profile
        setForm({
          ...DEFAULT_PROFILE,
          display_name: appProfile?.display_name ?? '',
        });
      }
      setLoading(false);
    };
    void load();
  }, [userId, appProfile?.display_name]);

  const set = <K extends keyof PublicProfile>(key: K, value: PublicProfile[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (cat: GoalCategory) => {
    const current = form.goal_categories ?? [];
    const next = current.includes(cat)
      ? current.filter(c => c !== cat)
      : [...current, cat];
    set('goal_categories', next);
  };

  const handleSave = async () => {
    if (!form.display_name?.trim()) {
      setError('Display name is required');
      return;
    }
    setError('');
    setSaving(true);

    const result = await updatePublicProfile(userId, {
      display_name: form.display_name.trim(),
      bio: form.bio ?? null,
      featured_goal: form.featured_goal ?? null,
      goal_categories: form.goal_categories ?? [],
      looking_for_partner: form.looking_for_partner ?? false,
      show_goals: form.show_goals ?? false,
      show_habits: form.show_habits ?? false,
      show_stats: form.show_stats ?? true,
      show_streak: form.show_streak ?? true,
      show_level: form.show_level ?? true,
    });

    setSaving(false);

    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } else {
      setError('Failed to save profile. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={24} style={{ color: '#00D4FF', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="profile-setup">
      {/* Basic Info */}
      <div className="profile-setup__section">
        <div className="profile-setup__section-title">Basic Info</div>

        <div className="profile-setup__field">
          <label className="profile-setup__label">Display Name *</label>
          <input
            className="profile-setup__input"
            type="text"
            placeholder="Your public name"
            value={form.display_name ?? ''}
            onChange={e => set('display_name', e.target.value)}
            maxLength={50}
          />
        </div>

        <div className="profile-setup__field">
          <label className="profile-setup__label">Bio</label>
          <textarea
            className="profile-setup__textarea"
            placeholder="Tell your partners what you're about…"
            value={form.bio ?? ''}
            onChange={e => set('bio', e.target.value)}
            maxLength={200}
            rows={3}
          />
        </div>

        <div className="profile-setup__field">
          <label className="profile-setup__label">Featured Mission</label>
          <input
            className="profile-setup__input"
            type="text"
            placeholder="e.g. Building a cleaning business, Running my first marathon"
            value={form.featured_goal ?? ''}
            onChange={e => set('featured_goal', e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      {/* Goal Categories */}
      <div className="profile-setup__section">
        <div className="profile-setup__section-title">Goal Categories</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
          Select your focus areas. This helps us match you with compatible partners.
        </div>
        <div className="profile-setup__cats">
          {ALL_GOAL_CATEGORIES.map(cat => {
            const meta = GOAL_CATEGORY_LABELS[cat as GoalCategory];
            const selected = (form.goal_categories ?? []).includes(cat);
            return (
              <button
                key={cat}
                type="button"
                className={`profile-setup__cat-pill ${selected ? 'selected' : ''}`}
                onClick={() => toggleCategory(cat as GoalCategory)}
              >
                <CategoryIcon name={meta.icon} size={14} color={meta.color} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Partner Matching */}
      <div className="profile-setup__section">
        <div className="profile-setup__section-title">Accountability Partner</div>
        <ToggleRow
          label="Looking for an accountability partner"
          sub="Show up in partner matching results"
          checked={form.looking_for_partner ?? false}
          onChange={v => set('looking_for_partner', v)}
        />
      </div>

      {/* Privacy Controls */}
      <div className="profile-setup__section">
        <div className="profile-setup__section-title">Privacy</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
          Control what others can see on your public profile.
        </div>
        <ToggleRow
          label="Show Level &amp; XP"
          checked={form.show_level ?? true}
          onChange={v => set('show_level', v)}
        />
        <ToggleRow
          label="Show Streak"
          checked={form.show_streak ?? true}
          onChange={v => set('show_streak', v)}
        />
        <ToggleRow
          label="Show Stats"
          sub="Radar chart of your 6 life stats"
          checked={form.show_stats ?? true}
          onChange={v => set('show_stats', v)}
        />
        <ToggleRow
          label="Show Goals"
          sub="Let partners see your active goals"
          checked={form.show_goals ?? false}
          onChange={v => set('show_goals', v)}
        />
        <ToggleRow
          label="Show Habits"
          sub="Let partners see your habits"
          checked={form.show_habits ?? false}
          onChange={v => set('show_habits', v)}
        />
      </div>

      {error && (
        <div style={{
          background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 8, padding: '10px 14px', color: '#F43F5E', fontSize: 13, marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      <button
        className="profile-setup__save-btn"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? (
          <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />Saving…</>
        ) : saved ? (
          <><Check size={16} style={{ marginRight: 8 }} />Saved!</>
        ) : (
          'Save Public Profile'
        )}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ProfileSetup;
