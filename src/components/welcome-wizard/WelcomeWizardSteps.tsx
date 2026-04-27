/**
 * WelcomeWizardSteps — Individual step rendering components
 *
 * Steps: ProfileStep, ModulesStep, HabitStep, GoalStep, SummaryStep
 * All receive wizard data + updateData via props so they stay stateless.
 */

import { type ReactNode } from 'react';
import {
  Zap, Target, Heart, DollarSign, Calendar, BookOpen,
  Sparkles, Check,
} from 'lucide-react';
import type { WizardData } from './useWelcomeWizard';

// ─── Constants ──────────────────────────────────────────────────

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

interface ModuleOption {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
}

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

// ─── Shared Styles ───────────────────────────────────────────────

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

// ─── Step Components ────────────────────────────────────────────

type UpdateDataFn = <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;

interface StepProps {
  data: WizardData;
  updateData: UpdateDataFn;
  inputFocus: Record<string, boolean>;
  setInputFocus: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function ProfileStep({ data, updateData, inputFocus, setInputFocus }: StepProps) {
  return (
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
}

export function ModulesStep({ data, updateData }: StepProps) {
  return (
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
}

export function HabitStep({ data, updateData, inputFocus, setInputFocus }: StepProps) {
  return (
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
}

export function GoalStep({ data, updateData, inputFocus, setInputFocus }: StepProps) {
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
}

interface SummaryStepProps extends StepProps {
  submitting: boolean;
  error: string;
  onComplete: () => void;
}

export function SummaryStep({ data, updateData, submitting, error, onComplete }: SummaryStepProps) {
  // Re-use MODULES for display
  const moduleTitles = [
    { id: 'habits', title: 'Habits' },
    { id: 'goals', title: 'Goals' },
    { id: 'health', title: 'Health' },
    { id: 'finances', title: 'Finances' },
    { id: 'schedule', title: 'Schedule' },
    { id: 'journal', title: 'Journal' },
  ];

  return (
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
                  moduleTitles.find(mod => mod.id === m)?.title || m
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
        onClick={onComplete}
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
          if (!submitting) onComplete();
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
}

// ─── Shared button style (used in SummaryStep & WelcomeWizardUI) ───

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

export { btnStyle };