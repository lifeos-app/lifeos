/**
 * WelcomeWizard — 5-Step Onboarding for LifeOS
 *
 * Guided onboarding experience shown to new users after signup.
 * Collects profile info, module preferences, first habit & goal,
 * then marks onboarding_complete=true.
 *
 * Design: Dark theme matching Login.tsx — gradient mesh background,
 * glassmorphic card, cyan #00D4FF accents, Poppins font.
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/data-access';
import { useUserStore } from '../stores/useUserStore';
import type { UserProfile } from '../stores/useUserStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore, type GoalNode } from '../stores/useGoalsStore';
import {
  Zap, Target, Heart, DollarSign, Calendar, BookOpen,
  Sparkles, ChevronRight, ChevronLeft, Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface WelcomeWizardProps {
  userId: string;
  onComplete: () => void;
  onSkip?: () => void;
}

interface ModuleOption {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
}

interface WizardData {
  displayName: string;
  timezone: string;
  selectedModules: string[];
  habitTitle: string;
  habitFrequency: 'daily' | 'weekly' | 'monthly';
  habitCategory: string;
  habitIcon: string;
  goalTitle: string;
  goalDescription: string;
  goalTargetDate: string;
  goalIcon: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const HERMETIC_QUOTES: Record<number, { quote: string; principle: string }> = {
  1: { quote: 'The All is Mind', principle: 'Mentalism' },
  2: { quote: 'As above, so below', principle: 'Correspondence' },
  3: { quote: 'Nothing rests; everything moves', principle: 'Vibration' },
  4: { quote: 'Every cause has its effect', principle: 'Cause & Effect' },
};

const TIMEZONES = [
  'Australia/Melbourne',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Pacific/Honolulu',
];

const MODULES: ModuleOption[] = [
  { id: 'habits', icon: <Zap size={24} />, title: 'Habits', description: 'Build consistent daily routines' },
  { id: 'goals', icon: <Target size={24} />, title: 'Goals', description: 'Track and achieve your objectives' },
  { id: 'health', icon: <Heart size={24} />, title: 'Health', description: 'Monitor wellness and vitals' },
  { id: 'finances', icon: <DollarSign size={24} />, title: 'Finances', description: 'Manage income, expenses & budgets' },
  { id: 'schedule', icon: <Calendar size={24} />, title: 'Schedule', description: 'Plan your time with precision' },
  { id: 'journal', icon: <BookOpen size={24} />, title: 'Journal', description: 'Reflect, write, and grow' },
];

const HABIT_QUICK_ADDS = [
  { label: '🧘 Morning Meditation', title: 'Morning Meditation', icon: '🧘', category: 'mindfulness' },
  { label: '💪 Exercise', title: 'Exercise', icon: '💪', category: 'fitness' },
  { label: '📖 Read 30 min', title: 'Read 30 min', icon: '📖', category: 'learning' },
];

const GOAL_QUICK_ADDS = [
  { label: '🏋️ Get fit', title: 'Get fit', icon: '🏋️', description: 'Build a consistent fitness routine and improve physical health' },
  { label: '💰 Save $1000', title: 'Save $1000', icon: '💰', description: 'Build an emergency fund or savings buffer' },
  { label: '📚 Read 12 books', title: 'Read 12 books', icon: '📚', description: 'Read one book per month for a year' },
];

const HABIT_CATEGORIES = [
  { value: '', label: 'Select category' },
  { value: 'mindfulness', label: '🧘 Mindfulness' },
  { value: 'fitness', label: '💪 Fitness' },
  { value: 'learning', label: '📖 Learning' },
  { value: 'productivity', label: '⚡ Productivity' },
  { value: 'health', label: '❤️ Health' },
  { value: 'social', label: '🤝 Social' },
  { value: 'creativity', label: '🎨 Creativity' },
  { value: 'finance', label: '💵 Finance' },
  { value: 'other', label: '✨ Other' },
];

const GOAL_COLORS = ['#00D4FF', '#8B5CF6', '#39FF14', '#F43F5E', '#F59E0B', '#10B981'];

// ─── Sub-Components ───────────────────────────────────────────────────

function HermeticTransition({ step, visible }: { step: number; visible: boolean }) {
  const data = HERMETIC_QUOTES[step];
  if (!data) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(5, 14, 26, 0.92)',
      }}
    >
      <div style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '22px',
        fontWeight: 600,
        color: '#00D4FF',
        letterSpacing: '2px',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
      }}>
        &ldquo;{data.quote}&rdquo;
      </div>
      <div style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: 400,
        color: '#8BA4BE',
        marginTop: '8px',
        letterSpacing: '3px',
        textTransform: 'uppercase' as const,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s',
      }}>
        — {data.principle}
      </div>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '28px',
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i < current ? '32px' : '8px',
            height: '4px',
            borderRadius: '2px',
            background: i < current
              ? 'linear-gradient(90deg, #00D4FF, #0EA5E9)'
              : i === current
                ? 'rgba(0, 212, 255, 0.5)'
                : 'rgba(255, 255, 255, 0.1)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
      <span style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '12px',
        color: '#8BA4BE',
        marginLeft: '8px',
        fontWeight: 500,
      }}>
        {current + 1}/{total}
      </span>
    </div>
  );
}

// Shared input styles
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#fff',
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '14px',
  outline: 'none',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  minHeight: '48px',
  boxSizing: 'border-box' as const,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238BA4BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  paddingRight: '40px',
};

const btnStyle = (disabled = false): React.CSSProperties => ({
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  background: disabled
    ? 'rgba(0, 212, 255, 0.2)'
    : 'linear-gradient(135deg, #00D4FF 0%, #0EA5E9 100%)',
  color: disabled ? 'rgba(10, 14, 26, 0.5)' : '#0A0E1A',
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontWeight: 600,
  fontSize: '14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.25s',
  minHeight: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  position: 'relative' as const,
  overflow: 'hidden' as const,
});

const skipStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '12px',
  color: '#8BA4BE',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  opacity: 0.6,
  transition: 'opacity 0.15s',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(139, 164, 190, 0.3)',
  textUnderlineOffset: '3px',
};

// ─── Main Component ──────────────────────────────────────────────────

export function WelcomeWizard({ userId, onComplete, onSkip }: WelcomeWizardProps) {
  const profile = useUserStore(s => s.profile);
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [hermeticVisible, setHermeticVisible] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [data, setData] = useState<WizardData>({
    displayName: profile?.display_name || '',
    timezone: profile?.timezone || 'Australia/Melbourne',
    selectedModules: [],
    habitTitle: '',
    habitFrequency: 'daily',
    habitCategory: '',
    habitIcon: '⚡',
    goalTitle: '',
    goalDescription: '',
    goalTargetDate: '',
    goalIcon: '🎯',
  });

  // Focus management for inputs
  const [inputFocus, setInputFocus] = useState<Record<string, boolean>>({});

  const updateData = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Transition logic with Hermetic quotes ──
  const goToStep = useCallback((nextStep: number, direction: 'left' | 'right' = 'left') => {
    if (transitioning) return;
    setSlideDir(direction);
    setTransitioning(true);
    setError('');

    // Show Hermetic quote for forward transitions (1→2, 2→3, 3→4, 4→5)
    if (direction === 'left' && nextStep > 0 && nextStep <= 4) {
      setHermeticVisible(true);
      setTimeout(() => {
        setHermeticVisible(false);
        setTimeout(() => {
          setStep(nextStep);
          setTransitioning(false);
        }, 300);
      }, 1800);
    } else {
      // Back transitions or step 5 — no quote
      setTimeout(() => {
        setStep(nextStep);
        setTransitioning(false);
      }, 300);
    }
  }, [transitioning]);

  // ── Skip handler ──
  const handleSkip = useCallback(async () => {
    try {
      await supabase
        .from('user_profiles')
        .update({ onboarding_complete: true })
        .eq('user_id', userId);
    } catch {
      // Best effort — don't block skip
    }
    onSkip?.();
  }, [userId, onSkip]);

  // ── Final completion ──
  const handleComplete = useCallback(async () => {
    setSubmitting(true);
    setError('');

    try {
      // 1. Update profile: onboarding_complete, display_name, preferences.selected_modules
      const existingPrefs = (profile?.preferences || {}) as Record<string, unknown>;
      const profilePayload: Partial<UserProfile> & Record<string, unknown> = {
        onboarding_complete: true,
        display_name: data.displayName.trim() || null,
        preferences: {
          ...existingPrefs,
          selected_modules: data.selectedModules,
          timezone: data.timezone,
        },
      };

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update(profilePayload)
        .eq('user_id', userId);

      if (profileErr) {
        console.warn('[WelcomeWizard] Profile update error:', profileErr);
      }

      // 2. Create first habit (if user filled it in)
      if (data.habitTitle.trim()) {
        const habitCreated = await useHabitsStore.getState().createHabit(userId, {
          title: data.habitTitle.trim(),
          frequency: data.habitFrequency,
          category: data.habitCategory || undefined,
          icon: data.habitIcon,
          is_active: true,
          is_deleted: false,
          source: 'manual',
          user_id: userId,
        });
        if (!habitCreated) {
          console.warn('[WelcomeWizard] Failed to create first habit');
        }
      }

      // 3. Create first goal (if user filled it in)
      if (data.goalTitle.trim()) {
        const randomColor = GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)];
        const goalId = await useGoalsStore.getState().createGoal({
          title: data.goalTitle.trim(),
          description: data.goalDescription.trim() || undefined,
          status: 'active',
          domain: data.selectedModules[0] || 'goals',
          target_date: data.goalTargetDate || null,
          icon: data.goalIcon,
          color: randomColor,
          sort_order: 0,
          priority: 'medium',
          is_deleted: false,
          source: 'manual',
          user_id: userId,
        } as Partial<GoalNode>);
        if (!goalId) {
          console.warn('[WelcomeWizard] Failed to create first goal');
        }
      }

      // 4. Refresh profile in store
      await useUserStore.getState().fetchProfile();

      // 5. Callback
      onComplete();
    } catch (err) {
      console.error('[WelcomeWizard] Completion error:', err);
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [userId, data, profile, onComplete]);

  // ── Validation ──
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return data.displayName.trim().length > 0;
      case 1: return data.selectedModules.length >= 2;
      case 2: return data.habitTitle.trim().length > 0;
      case 3: return data.goalTitle.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  // ── Render Steps ──

  const renderStep0 = () => (
    <div style={stepContentStyle}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <Zap size={28} color="#00D4FF" style={{ filter: 'drop-shadow(0 0 12px rgba(0, 212, 255, 0.5))' }} />
          <span style={brandStyle}>LifeOS</span>
        </span>
        <h1 style={titleStyle}>Welcome, Commander</h1>
        <p style={subStyle}>Let&apos;s set up your life operating system</p>
      </div>

      <label style={labelStyle} htmlFor="wiz-displayname">Display Name</label>
      <input
        id="wiz-displayname"
        type="text"
        placeholder="How should we call you?"
        value={data.displayName}
        onChange={e => updateData('displayName', e.target.value)}
        onFocus={() => setInputFocus(prev => ({ ...prev, name: true }))}
        onBlur={() => setInputFocus(prev => ({ ...prev, name: false }))}
        style={{
          ...inputStyle,
          borderColor: inputFocus.name ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
          boxShadow: inputFocus.name ? '0 0 0 3px rgba(0, 212, 255, 0.1), 0 0 20px rgba(0, 212, 255, 0.08)' : 'none',
          background: inputFocus.name ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
        }}
        autoFocus
      />

      <label style={{ ...labelStyle, marginTop: '16px' }} htmlFor="wiz-timezone">Timezone</label>
      <select
        id="wiz-timezone"
        value={data.timezone}
        onChange={e => updateData('timezone', e.target.value)}
        style={selectStyle}
      >
        {TIMEZONES.map(tz => (
          <option key={tz} value={tz} style={{ background: '#111827', color: '#fff' }}>
            {tz}
          </option>
        ))}
      </select>
    </div>
  );

  const renderStep1 = () => (
    <div style={stepContentStyle}>
      <h1 style={titleStyle}>Your Focus</h1>
      <p style={subStyle}>Select at least 2 modules to power your LifeOS</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginTop: '20px',
        width: '100%',
      }}>
        {MODULES.map(mod => {
          const selected = data.selectedModules.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => {
                const modules = selected
                  ? data.selectedModules.filter(m => m !== mod.id)
                  : [...data.selectedModules, mod.id];
                updateData('selectedModules', modules);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '20px 12px',
                borderRadius: '14px',
                border: selected
                  ? '1.5px solid rgba(0, 212, 255, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: selected
                  ? 'rgba(0, 212, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: selected ? 'scale(1.02)' : 'scale(1)',
                boxShadow: selected
                  ? '0 0 24px rgba(0, 212, 255, 0.12), 0 0 8px rgba(0, 212, 255, 0.08)'
                  : 'none',
                position: 'relative' as const,
              }}
              type="button"
            >
              {selected && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#00D4FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'wizardCheckPop 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                  <Check size={12} color="#0A0E1A" strokeWidth={3} />
                </div>
              )}
              <span style={{
                color: selected ? '#00D4FF' : '#8BA4BE',
                transition: 'color 0.25s',
                display: 'flex',
              }}>
                {mod.icon}
              </span>
              <span style={{
                fontFamily: 'Poppins, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                color: selected ? '#fff' : '#8BA4BE',
                transition: 'color 0.25s',
              }}>
                {mod.title}
              </span>
              <span style={{
                fontFamily: 'Poppins, system-ui, sans-serif',
                fontSize: '10px',
                color: '#8BA4BE',
                textAlign: 'center',
                lineHeight: 1.3,
                opacity: 0.7,
              }}>
                {mod.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={stepContentStyle}>
      <h1 style={titleStyle}>First Habit</h1>
      <p style={subStyle}>Start building momentum with one daily practice</p>

      {/* Quick-add buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {HABIT_QUICK_ADDS.map(ha => (
          <button
            key={ha.title}
            type="button"
            onClick={() => {
              updateData('habitTitle', ha.title);
              updateData('habitCategory', ha.category);
              updateData('habitIcon', ha.icon);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: data.habitTitle === ha.title
                ? '1px solid rgba(0, 212, 255, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              background: data.habitTitle === ha.title
                ? 'rgba(0, 212, 255, 0.1)'
                : 'rgba(255, 255, 255, 0.03)',
              color: data.habitTitle === ha.title ? '#00D4FF' : '#8BA4BE',
              fontFamily: 'Poppins, system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {ha.label}
          </button>
        ))}
      </div>

      <label style={labelStyle} htmlFor="wiz-habit-title">Habit Title</label>
      <input
        id="wiz-habit-title"
        type="text"
        placeholder="e.g. Morning walk, Journal, Meditate..."
        value={data.habitTitle}
        onChange={e => updateData('habitTitle', e.target.value)}
        onFocus={() => setInputFocus(prev => ({ ...prev, habit: true }))}
        onBlur={() => setInputFocus(prev => ({ ...prev, habit: false }))}
        style={{
          ...inputStyle,
          borderColor: inputFocus.habit ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
          boxShadow: inputFocus.habit ? '0 0 0 3px rgba(0, 212, 255, 0.1)' : 'none',
          background: inputFocus.habit ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
        }}
        autoFocus
      />

      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="wiz-habit-freq">Frequency</label>
          <select
            id="wiz-habit-freq"
            value={data.habitFrequency}
            onChange={e => updateData('habitFrequency', e.target.value as WizardData['habitFrequency'])}
            style={selectStyle}
          >
            <option value="daily" style={{ background: '#111827', color: '#fff' }}>Daily</option>
            <option value="weekly" style={{ background: '#111827', color: '#fff' }}>Weekly</option>
            <option value="monthly" style={{ background: '#111827', color: '#fff' }}>Monthly</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="wiz-habit-cat">Category</label>
          <select
            id="wiz-habit-cat"
            value={data.habitCategory}
            onChange={e => updateData('habitCategory', e.target.value)}
            style={selectStyle}
          >
            {HABIT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value} style={{ background: '#111827', color: '#fff' }}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    // Default target date: 90 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 90);

    return (
      <div style={stepContentStyle}>
        <h1 style={titleStyle}>First Goal</h1>
        <p style={subStyle}>Set a direction — every journey needs a destination</p>

        {/* Quick-add buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {GOAL_QUICK_ADDS.map(ga => (
            <button
              key={ga.title}
              type="button"
              onClick={() => {
                updateData('goalTitle', ga.title);
                updateData('goalDescription', ga.description);
                updateData('goalIcon', ga.icon);
                if (!data.goalTargetDate) {
                  updateData('goalTargetDate', defaultDate.toISOString().split('T')[0]);
                }
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: data.goalTitle === ga.title
                  ? '1px solid rgba(0, 212, 255, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: data.goalTitle === ga.title
                  ? 'rgba(0, 212, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                color: data.goalTitle === ga.title ? '#00D4FF' : '#8BA4BE',
                fontFamily: 'Poppins, system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {ga.label}
            </button>
          ))}
        </div>

        <label style={labelStyle} htmlFor="wiz-goal-title">Goal Title</label>
        <input
          id="wiz-goal-title"
          type="text"
          placeholder="e.g. Run a marathon, Learn piano..."
          value={data.goalTitle}
          onChange={e => updateData('goalTitle', e.target.value)}
          onFocus={() => setInputFocus(prev => ({ ...prev, goal: true }))}
          onBlur={() => setInputFocus(prev => ({ ...prev, goal: false }))}
          style={{
            ...inputStyle,
            borderColor: inputFocus.goal ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
            boxShadow: inputFocus.goal ? '0 0 0 3px rgba(0, 212, 255, 0.1)' : 'none',
            background: inputFocus.goal ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
          }}
          autoFocus
        />

        <label style={{ ...labelStyle, marginTop: '16px' }} htmlFor="wiz-goal-desc">Description (optional)</label>
        <textarea
          id="wiz-goal-desc"
          placeholder="What does success look like?"
          value={data.goalDescription}
          onChange={e => updateData('goalDescription', e.target.value)}
          rows={2}
          style={{
            ...inputStyle,
            resize: 'vertical' as const,
            minHeight: '72px',
          }}
        />

        <label style={{ ...labelStyle, marginTop: '16px' }} htmlFor="wiz-goal-date">Target Date</label>
        <input
          id="wiz-goal-date"
          type="date"
          value={data.goalTargetDate}
          onChange={e => updateData('goalTargetDate', e.target.value)}
          style={{
            ...inputStyle,
            colorScheme: 'dark',
          }}
        />
      </div>
    );
  };

  const renderStep4 = () => (
    <div style={{ ...stepContentStyle, textAlign: 'center' as const }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 212, 255, 0.05))',
        border: '1.5px solid rgba(0, 212, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        animation: 'wizardPulse 2s ease-in-out infinite',
      }}>
        <Sparkles size={32} color="#00D4FF" />
      </div>

      <h1 style={{ ...titleStyle, fontSize: '24px' }}>Your LifeOS is Ready!</h1>
      <p style={subStyle}>Here&apos;s what we&apos;ve set up for you:</p>

      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '20px',
        margin: '20px 0',
        textAlign: 'left',
      }}>
        {/* Profile summary */}
        <div style={summaryRowStyle}>
          <span style={summaryIconStyle}>👤</span>
          <span style={summaryTextStyle}>
            <strong style={{ color: '#fff' }}>{data.displayName || 'Commander'}</strong>
            <span style={{ color: '#8BA4BE', marginLeft: '6px' }}>· {data.timezone}</span>
          </span>
        </div>

        {/* Modules */}
        <div style={summaryRowStyle}>
          <span style={summaryIconStyle}>⚡</span>
          <span style={summaryTextStyle}>
            {data.selectedModules.length > 0
              ? data.selectedModules.map(m =>
                  MODULES.find(mod => mod.id === m)?.title || m
                ).join(', ')
              : 'No modules selected'}
          </span>
        </div>

        {/* Habit */}
        {data.habitTitle && (
          <div style={summaryRowStyle}>
            <span style={summaryIconStyle}>{data.habitIcon}</span>
            <span style={summaryTextStyle}>
              <strong style={{ color: '#fff' }}>{data.habitTitle}</strong>
              <span style={{ color: '#8BA4BE', marginLeft: '6px' }}>· {data.habitFrequency}</span>
            </span>
          </div>
        )}

        {/* Goal */}
        {data.goalTitle && (
          <div style={summaryRowStyle}>
            <span style={summaryIconStyle}>{data.goalIcon}</span>
            <span style={summaryTextStyle}>
              <strong style={{ color: '#fff' }}>{data.goalTitle}</strong>
              {data.goalTargetDate && (
                <span style={{ color: '#8BA4BE', marginLeft: '6px' }}>· by {data.goalTargetDate}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          color: '#F43F5E',
          fontSize: '12px',
          padding: '8px 12px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleComplete}
        disabled={submitting}
        style={btnStyle(submitting)}
      >
        {submitting ? 'Setting up...' : (
          <>
            <Sparkles size={18} />
            Launch Dashboard
          </>
        )}
      </button>

      <a
        href="/character"
        onClick={(e) => {
          // Let the default navigation happen after completing
          if (!submitting) handleComplete();
          e.preventDefault();
        }}
        style={{
          display: 'inline-block',
          marginTop: '16px',
          fontFamily: 'Poppins, system-ui, sans-serif',
          fontSize: '13px',
          color: '#8B5CF6',
          textDecoration: 'none',
          opacity: 0.8,
          transition: 'opacity 0.2s',
        }}
      >
        ✨ Enter the Realm — RPG Onboarding
      </a>
    </div>
  );

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  // ── Main Render ──

  return (
    <div className="login-page" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      {/* Animated gradient mesh background — reuse Login.css classes */}
      <div className="login-mesh" aria-hidden="true">
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
      </div>

      {/* Star particles */}
      <div className="login-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="login-star" />
        ))}
      </div>

      {/* Hermetic transition overlay */}
      <HermeticTransition step={step + 1} visible={hermeticVisible} />

      {/* Main wizard card */}
      <div
        className="login-card"
        style={{
          maxWidth: step === 1 ? '540px' : '420px', // Wider for module grid
          transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Step Indicator */}
        {step < 4 && <StepIndicator current={step} total={TOTAL_STEPS} />}

        {/* Step Content with slide animation */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: step === 1 ? '340px' : step === 4 ? '380px' : 'auto',
        }}>
          <div style={{
            transition: transitioning
              ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s'
              : 'none',
            transform: transitioning
              ? `translateX(${slideDir === 'left' ? '-20px' : '20px'})`
              : 'translateX(0)',
            opacity: transitioning ? 0 : 1,
          }}>
            {stepRenderers[step]()}
          </div>
        </div>

        {/* Navigation buttons (hidden on step 5) */}
        {step < 4 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '24px',
          }}>
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              disabled={!canProceed() || transitioning}
              style={btnStyle(!canProceed() || transitioning)}
            >
              {step === 3 ? 'Finish Setup' : 'Continue'}
              <ChevronRight size={18} />
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={() => goToStep(step - 1, 'right')}
                disabled={transitioning}
                style={{
                  ...btnStyle(),
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#8BA4BE',
                }}
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleSkip}
              style={skipStyle}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      {/* Bottom tagline */}
      <span className="login-tagline">The operating system for your entire life</span>

      {/* Inline keyframes for wizard-specific animations */}
      <style>{`
        @keyframes wizardCheckPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wizardPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(0, 212, 255, 0.15); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.3); }
        }
        @keyframes wizardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Reusable Style Objects ──────────────────────────────────────────

const stepContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  animation: 'wizardFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
};

const brandStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '22px',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #00D4FF 0%, #00FFFF 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '3px',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '18px',
  fontWeight: 700,
  marginBottom: '6px',
  textAlign: 'center',
  color: '#fff',
};

const subStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#8BA4BE',
  marginBottom: '16px',
  textAlign: 'center',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '12px',
  fontWeight: 600,
  color: '#8BA4BE',
  marginBottom: '6px',
  display: 'block',
  letterSpacing: '0.5px',
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  fontSize: '13px',
};

const summaryIconStyle: React.CSSProperties = {
  fontSize: '16px',
  width: '24px',
  textAlign: 'center',
  flexShrink: 0,
};

const summaryTextStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '13px',
  color: '#8BA4BE',
};

export default WelcomeWizard;