/**
 * WelcomeWizardSteps — Individual step rendering components
 *
 * V2 Steps: ProfileStep, LifeSnapshotStep, TopGoalsStep, DailyRhythmStep, SummaryStep
 * All receive wizard data + updateData via props so they stay stateless.
 */

import { type ReactNode } from 'react';
import {
  Zap, Target, Heart, TrendingUp, Sun, Clock,
  Sparkles, Check, GraduationCap, Briefcase, Shuffle,
  Paintbrush, Baby, Activity, DollarSign, Users, Leaf,
} from 'lucide-react';
import type { WizardData } from './useWelcomeWizard';
import { LIFE_AREAS } from './useWelcomeWizard';

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

const LIFE_AREA_ICONS: Record<string, ReactNode> = {
  health: <Activity size={18} />,
  career: <Briefcase size={18} />,
  finance: <DollarSign size={18} />,
  relationships: <Users size={18} />,
  growth: <TrendingUp size={18} />,
  wellbeing: <Leaf size={18} />,
};

interface DayTemplateOption {
  id: 'student' | '9-5' | 'shift' | 'freelancer' | 'parent';
  icon: ReactNode;
  title: string;
  description: string;
}

const DAY_TEMPLATES: DayTemplateOption[] = [
  { id: 'student', icon: <GraduationCap size={24} />, title: 'Student', description: 'Classes, study sessions, campus life' },
  { id: '9-5', icon: <Briefcase size={24} />, title: '9-5 Worker', description: 'Morning commute, office hours, evening wind-down' },
  { id: 'shift', icon: <Shuffle size={24} />, title: 'Shift Worker', description: 'Rotating shifts, irregular schedule' },
  { id: 'freelancer', icon: <Paintbrush size={24} />, title: 'Freelancer', description: 'Flexible hours, project-based work' },
  { id: 'parent', icon: <Baby size={24} />, title: 'Parent', description: 'School runs, family meals, kid activities' },
];

const GOAL_PLACEHOLDERS = [
  'e.g. Get fit and exercise 3x/week',
  'e.g. Save $5000 emergency fund',
  'e.g. Learn a new skill or language',
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

// ─── Step 1: Life Snapshot (replaces ModulesStep) ───────────────

export function LifeSnapshotStep({ data, updateData }: StepProps) {
  const handleSliderChange = (key: string, value: number) => {
    updateData('lifeSnapshot', { ...data.lifeSnapshot, [key]: value });
  };

  // Build radar chart SVG
  const cx = 90, cy = 90, r = 70;
  const numAreas = LIFE_AREAS.length;
  const angleStep = (2 * Math.PI) / numAreas;
  const startAngle = -Math.PI / 2; // start from top

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep;
    const ratio = value / 10;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  };

  const radarPoints = LIFE_AREAS.map((area, i) => {
    const pt = getPoint(i, data.lifeSnapshot[area.key] ?? 5);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  const gridPoints = LIFE_AREAS.map((_, i) => {
    const pt = getPoint(i, 10);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  const axisLines = LIFE_AREAS.map((_, i) => {
    const endPt = getPoint(i, 10);
    return `M${cx},${cy} L${endPt.x},${endPt.y}`;
  }).join(' ');

  return (
    <div style={stepContentStyle}>
      <h1 style={titleStyle}>Life Snapshot</h1>
      <p style={subStyle}>Rate each area of your life right now</p>

      {/* Radar chart preview */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <svg width="180" height="180" viewBox="0 0 180 180" style={{ overflow: 'visible' }}>
          {/* Axis lines */}
          <path d={axisLines} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {/* Outer grid polygon */}
          <polygon points={gridPoints} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {/* Inner rings at 33% and 66% */}
          {[3.3, 6.6].map(ringVal => {
            const ringPts = LIFE_AREAS.map((_, i) => {
              const pt = getPoint(i, ringVal);
              return `${pt.x},${pt.y}`;
            }).join(' ');
            return <polygon key={ringVal} points={ringPts} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
          })}
          {/* Data polygon */}
          <polygon
            points={radarPoints}
            fill="rgba(0, 212, 255, 0.12)"
            stroke="#00D4FF"
            strokeWidth="2"
          />
          {/* Data points */}
          {LIFE_AREAS.map((area, i) => {
            const pt = getPoint(i, data.lifeSnapshot[area.key] ?? 5);
            return (
              <circle key={area.key} cx={pt.x} cy={pt.y} r="3.5" fill={area.color} stroke="#050E1A" strokeWidth="1.5" />
            );
          })}
          {/* Area labels */}
          {LIFE_AREAS.map((area, i) => {
            const labelR = r + 18;
            const angle = startAngle + i * angleStep;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);
            return (
              <text key={area.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fill={area.color} style={{ fontFamily: 'Poppins, sans-serif', fontSize: '9px', fontWeight: 600 }}>
                {area.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {LIFE_AREAS.map((area) => {
          const value = data.lifeSnapshot[area.key] ?? 5;
          const percentage = ((value - 1) / 9) * 100;
          return (
            <div key={area.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: `${area.color}15`,
                color: area.color,
                flexShrink: 0,
              }}>
                {LIFE_AREA_ICONS[area.key]}
              </span>
              <span style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: '#8BA4BE',
                width: '72px',
                flexShrink: 0,
              }}>
                {area.label}
              </span>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={value}
                  onChange={e => handleSliderChange(area.key, Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '6px',
                    appearance: 'none' as const,
                    WebkitAppearance: 'none' as const,
                    background: `linear-gradient(to right, ${area.color} 0%, ${area.color} ${percentage}%, rgba(255,255,255,0.08) ${percentage}%, rgba(255,255,255,0.08) 100%)`,
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
              <span style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: area.color,
                width: '24px',
                textAlign: 'center' as const,
                flexShrink: 0,
              }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Top 3 Goals (replaces HabitStep) ───────────────────

export function TopGoalsStep({ data, updateData, inputFocus, setInputFocus }: StepProps) {
  const updateGoal = (index: number, value: string) => {
    const newGoals = [...data.topGoals];
    newGoals[index] = value;
    updateData('topGoals', newGoals);
  };

  const goalIcons = [<Target size={18} color="#00D4FF" />, <Heart size={18} color="#8B5CF6" />, <Zap size={18} color="#39FF14" />];

  return (
    <div style={stepContentStyle}>
      <h1 style={titleStyle}>Top 3 Goals</h1>
      <p style={subStyle}>What do you most want to improve?</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0,
            }}>
              {goalIcons[i]}
            </span>
            <input
              type="text"
              placeholder={GOAL_PLACEHOLDERS[i]}
              value={data.topGoals[i] || ''}
              onChange={e => updateGoal(i, e.target.value)}
              onFocus={() => setInputFocus(prev => ({ ...prev, [`goal${i}`]: true }))}
              onBlur={() => setInputFocus(prev => ({ ...prev, [`goal${i}`]: false }))}
              style={{
                ...inputStyle,
                borderColor: inputFocus[`goal${i}`] ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                boxShadow: inputFocus[`goal${i}`] ? '0 0 0 3px rgba(0, 212, 255, 0.1)' : 'none',
                background: inputFocus[`goal${i}`] ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
              }}
              autoFocus={i === 0}
            />
          </div>
        ))}
      </div>

      <p style={{
        fontSize: '11px',
        color: 'rgba(139, 164, 190, 0.6)',
        textAlign: 'center',
        marginTop: '12px',
        fontFamily: 'Poppins, system-ui, sans-serif',
      }}>
        AI will enhance these into structured goals after setup
      </p>
    </div>
  );
}

// ─── Step 3: Daily Rhythm (replaces GoalStep) ───────────────────

export function DailyRhythmStep({ data, updateData }: StepProps) {
  const handleTemplateSelect = (templateId: 'student' | '9-5' | 'shift' | 'freelancer' | 'parent' | 'custom') => {
    updateData('dayTemplate', templateId);
  };

  return (
    <div style={stepContentStyle}>
      <h1 style={titleStyle}>Daily Rhythm</h1>
      <p style={subStyle}>When do you start your day?</p>

      <label style={labelStyle} htmlFor="wiz-waketime">Wake Time</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
      }}>
        <Sun size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
        <input
          id="wiz-waketime"
          type="time"
          value={data.wakeTime}
          onChange={e => updateData('wakeTime', e.target.value)}
          style={{
            ...inputStyle,
            colorScheme: 'dark',
            flex: 1,
          }}
        />
      </div>

      <p style={{ ...subStyle, marginBottom: '12px' }}>What does a typical day look like?</p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {DAY_TEMPLATES.map((template) => {
          const selected = data.dayTemplate === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: selected
                  ? '1.5px solid rgba(0, 212, 255, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: selected
                  ? 'rgba(0, 212, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative' as const,
                minWidth: '44px',
                minHeight: '44px',
              }}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: selected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: selected ? '#00D4FF' : '#8BA4BE',
                flexShrink: 0,
                transition: 'all 0.25s',
              }}>
                {template.icon}
              </span>
              <div style={{ textAlign: 'left' }}>
                <span style={{
                  fontFamily: 'Poppins, system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: selected ? '#fff' : '#8BA4BE',
                  display: 'block',
                  transition: 'color 0.25s',
                }}>
                  {template.title}
                </span>
                <span style={{
                  fontFamily: 'Poppins, system-ui, sans-serif',
                  fontSize: '10px',
                  color: '#8BA4BE',
                  opacity: 0.7,
                }}>
                  {template.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 4: Summary (updated for V2) ───────────────────────────

interface SummaryStepProps extends StepProps {
  submitting: boolean;
  error: string;
  onComplete: () => void;
}

export function SummaryStep({ data, updateData, submitting, error, onComplete }: SummaryStepProps) {
  // Build radar chart for summary
  const cx = 80, cy = 80, r = 62;
  const numAreas = LIFE_AREAS.length;
  const angleStep = (2 * Math.PI) / numAreas;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep;
    const ratio = value / 10;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  };

  const radarPoints = LIFE_AREAS.map((area, i) => {
    const pt = getPoint(i, data.lifeSnapshot[area.key] ?? 5);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  const gridPoints = LIFE_AREAS.map((_, i) => {
    const pt = getPoint(i, 10);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  const axisLines = LIFE_AREAS.map((_, i) => {
    const endPt = getPoint(i, 10);
    return `M${cx},${cy} L${endPt.x},${endPt.y}`;
  }).join(' ');

  // Day template display
  const dayTemplateLabel = data.dayTemplate === '9-5' ? '9-5 Worker'
    : data.dayTemplate === 'custom' ? 'Custom'
    : data.dayTemplate.charAt(0).toUpperCase() + data.dayTemplate.slice(1);

  // Format wake time for display
  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const validGoals = data.topGoals.filter(g => g.trim().length > 0);

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
      <p style={subStyle}>Here&apos;s your setup summary:</p>

      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '16px',
        margin: '16px 0',
        textAlign: 'left',
      }}>
        {/* Profile */}
        <div style={summaryRowStyle}>
          <span style={summaryIconStyle}><Zap size={16} color="#00D4FF" /></span>
          <span style={summaryTextStyle}>
            <strong style={{ color: '#fff' }}>{data.displayName || 'Commander'}</strong>
            <span style={{ color: '#8BA4BE', marginLeft: '6px' }}>· {data.timezone}</span>
          </span>
        </div>

        {/* Life Snapshot mini radar */}
        <div style={{ ...summaryRowStyle, justifyContent: 'center', padding: '8px 0' }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ overflow: 'visible' }}>
            <path d={axisLines} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <polygon points={gridPoints} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <polygon
              points={radarPoints}
              fill="rgba(0, 212, 255, 0.12)"
              stroke="#00D4FF"
              strokeWidth="2"
            />
            {LIFE_AREAS.map((area, i) => {
              const pt = getPoint(i, data.lifeSnapshot[area.key] ?? 5);
              return (
                <g key={area.key}>
                  <circle cx={pt.x} cy={pt.y} r="3" fill={area.color} stroke="#050E1A" strokeWidth="1.5" />
                  {/* Label abbreviated for summary */}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Top Goals */}
        {validGoals.length > 0 && (
          <div style={summaryRowStyle}>
            <span style={summaryIconStyle}><Target size={16} color="#8B5CF6" /></span>
            <span style={summaryTextStyle}>
              <strong style={{ color: '#fff' }}>Goals: </strong>
              {validGoals.join(', ')}
            </span>
          </div>
        )}

        {/* Daily Rhythm */}
        <div style={summaryRowStyle}>
          <span style={summaryIconStyle}><Clock size={16} color="#F59E0B" /></span>
          <span style={summaryTextStyle}>
            <strong style={{ color: '#fff' }}>Wake: {formatTime(data.wakeTime)}</strong>
            <span style={{ color: '#8BA4BE', marginLeft: '6px' }}>· {dayTemplateLabel}</span>
          </span>
        </div>
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
        Enter the Realm — RPG Onboarding
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