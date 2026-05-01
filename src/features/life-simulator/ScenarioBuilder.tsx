/**
 * ScenarioBuilder.tsx — Interactive scenario builder for the Predictive Life Simulator
 *
 * - Preset scenario cards with quick-fire options
 * - Custom scenario form with parameter sliders
 * - Duration selector (7/30/60/90 days)
 * - Domain focus checkboxes
 * - "Compare with another scenario" feature
 */

import { useState, useCallback } from 'react';
import {
  SCENARIO_TEMPLATES,
  type SimulationScenario,
} from './useSimulator';

// ── Icons (inline SVG for futuristic feel) ─────────────────────────

const Icons = {
  wakeEarly: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  cutSpending: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
    </svg>
  ),
  newHabit: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M2 12h20" />
    </svg>
  ),
  exercise: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a2 2 0 00-2-2h-1a2 2 0 00-2 2v8a2 2 0 002 2h1a2 2 0 002-2V8z" /><path d="M2 12h4l2-4 4 8 2-4h4" />
    </svg>
  ),
  custom: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
    </svg>
  ),
  compare: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
};

const TEMPLATE_ICONS: Record<string, JSX.Element> = {
  'wake-early': Icons.wakeEarly,
  'cut-spending': Icons.cutSpending,
  'new-habit-streak': Icons.newHabit,
  'increase-exercise': Icons.exercise,
  'deep-work-blocks': Icons.wakeEarly,
  'budget-tight': Icons.cutSpending,
  'sleep-optimize': Icons.wakeEarly,
  'goal-sprint': Icons.newHabit,
};

const DURATION_OPTIONS = [
  { value: 7, label: '7 days', sublabel: 'Quick test' },
  { value: 14, label: '14 days', sublabel: 'Two weeks' },
  { value: 30, label: '30 days', sublabel: 'Monthly' },
  { value: 60, label: '60 days', sublabel: 'Bimonthly' },
  { value: 90, label: '90 days', sublabel: 'Quarterly' },
];

const DOMAIN_OPTIONS = [
  { key: 'health', label: 'Health', color: '#22C55E' },
  { key: 'finances', label: 'Finances', color: '#FACC15' },
  { key: 'habits', label: 'Habits', color: '#A855F7' },
  { key: 'goals', label: 'Goals', color: '#3B82F6' },
  { key: 'energy', label: 'Energy', color: '#00D4FF' },
  { key: 'mood', label: 'Mood', color: '#EC4899' },
];

interface ScenarioBuilderProps {
  onRun: (scenario: SimulationScenario) => void;
  onCompare?: (scenario: SimulationScenario) => void;
  activeScenario: SimulationScenario | null;
  isRunning: boolean;
}

export function ScenarioBuilder({
  onRun,
  onCompare,
  activeScenario,
  isRunning,
}: ScenarioBuilderProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [focusedDomains, setFocusedDomains] = useState<string[]>(['health', 'finances', 'habits', 'goals']);

  // Custom scenario state
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<SimulationScenario['type']>('custom');
  const [customTarget, setCustomTarget] = useState(50);
  const [customDescription, setCustomDescription] = useState('');

  const handleTemplateSelect = useCallback((template: SimulationScenario) => {
    setSelectedTemplate(template.id);
    setDuration(template.duration);
  }, []);

  const handleRun = useCallback(() => {
    let scenario: SimulationScenario;

    if (mode === 'preset' && selectedTemplate) {
      const template = SCENARIO_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) return;
      scenario = { ...template, duration };
    } else if (mode === 'custom') {
      scenario = {
        id: `custom-${Date.now()}`,
        name: customName || 'Custom Scenario',
        description: customDescription || `Simulate: ${customName || 'Custom scenario'}`,
        type: customType,
        parameters: { targetValue: customTarget },
        duration,
      };
    } else {
      return;
    }

    onRun(scenario);
  }, [mode, selectedTemplate, duration, customName, customType, customTarget, customDescription, onRun]);

  const handleCompare = useCallback(() => {
    let scenario: SimulationScenario;

    if (mode === 'preset' && selectedTemplate) {
      const template = SCENARIO_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) return;
      scenario = { ...template, duration };
    } else if (mode === 'custom') {
      scenario = {
        id: `compare-${Date.now()}`,
        name: customName || 'Comparison Scenario',
        description: customDescription || `Compare: ${customName}`,
        type: customType,
        parameters: { targetValue: customTarget },
        duration,
      };
    } else {
      return;
    }

    onCompare?.(scenario);
  }, [mode, selectedTemplate, duration, customName, customType, customTarget, customDescription, onCompare]);

  const toggleDomain = (key: string) => {
    setFocusedDomains(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ color: '#E2E8F0' }}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#00D4FF' }}>
          What If?
        </h2>
        <p className="text-xs" style={{ color: '#8BA4BE' }}>
          Select a scenario or build your own. See projected outcomes from your real data.
        </p>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="flex mx-4 mb-4 rounded-xl overflow-hidden" style={{ background: 'rgba(30,58,91,0.4)' }}>
        <button
          onClick={() => setMode('preset')}
          className="flex-1 py-2 text-sm font-medium transition-all"
          style={{
            background: mode === 'preset' ? 'rgba(0,212,255,0.15)' : 'transparent',
            color: mode === 'preset' ? '#00D4FF' : '#8BA4BE',
            borderBottom: mode === 'preset' ? '2px solid #00D4FF' : '2px solid transparent',
          }}
        >
          Presets
        </button>
        <button
          onClick={() => setMode('custom')}
          className="flex-1 py-2 text-sm font-medium transition-all"
          style={{
            background: mode === 'custom' ? 'rgba(0,212,255,0.15)' : 'transparent',
            color: mode === 'custom' ? '#00D4FF' : '#8BA4BE',
            borderBottom: mode === 'custom' ? '2px solid #00D4FF' : '2px solid transparent',
          }}
        >
          Custom
        </button>
      </div>

      {mode === 'preset' ? (
        /* ── Preset Scenarios ── */
        <div className="px-4 space-y-2">
          {SCENARIO_TEMPLATES.map(template => {
            const isSelected = selectedTemplate === template.id;
            const icon = TEMPLATE_ICONS[template.id] || Icons.custom;
            const typeColor = {
              'schedule_change': '#A855F7',
              'financial_change': '#FACC15',
              'habit_change': '#22C55E',
              'health_change': '#F43F5E',
              'custom': '#00D4FF',
            }[template.type] ?? '#00D4FF';

            return (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01]"
                style={{
                  background: isSelected ? `${typeColor}15` : 'rgba(30,58,91,0.3)',
                  border: isSelected ? `1px solid ${typeColor}` : '1px solid rgba(30,58,91,0.5)',
                  boxShadow: isSelected ? `0 0 20px ${typeColor}20` : 'none',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5" style={{ color: typeColor }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm" style={{ color: '#E2E8F0' }}>{template.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${typeColor}20`, color: typeColor }}>
                        {template.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: '#8BA4BE' }}>{template.description}</p>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: typeColor }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A1628" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Custom Scenario Form ── */
        <div className="px-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8BA4BE' }}>Scenario Name</label>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g., Wake at 5 AM daily"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: 'rgba(30,58,91,0.4)',
                border: '1px solid rgba(30,58,91,0.6)',
                color: '#E2E8F0',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8BA4BE' }}>Type</label>
            <div className="flex flex-wrap gap-2">
              {(['habit_change', 'schedule_change', 'financial_change', 'health_change', 'custom'] as const).map(type => {
                const typeColor = {
                  'schedule_change': '#A855F7',
                  'financial_change': '#FACC15',
                  'habit_change': '#22C55E',
                  'health_change': '#F43F5E',
                  'custom': '#00D4FF',
                }[type] ?? '#00D4FF';
                const isSelected = customType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setCustomType(type)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: isSelected ? `${typeColor}25` : 'rgba(30,58,91,0.3)',
                      border: isSelected ? `1px solid ${typeColor}` : '1px solid rgba(30,58,91,0.5)',
                      color: isSelected ? typeColor : '#8BA4BE',
                    }}
                  >
                    {type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8BA4BE' }}>
              Target Intensity: <span style={{ color: '#00D4FF' }}>{customTarget}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={customTarget}
              onChange={e => setCustomTarget(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: '#00D4FF' }}
            />
            <div className="flex justify-between text-xs" style={{ color: '#5A7A9A' }}>
              <span>Gentle</span>
              <span>Moderate</span>
              <span>Intensive</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8BA4BE' }}>Description (optional)</label>
            <textarea
              value={customDescription}
              onChange={e => setCustomDescription(e.target.value)}
              placeholder="Describe what you'd change..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: 'rgba(30,58,91,0.4)',
                border: '1px solid rgba(30,58,91,0.6)',
                color: '#E2E8F0',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Duration Selector ── */}
      <div className="px-4 mt-4">
        <label className="block text-xs font-medium mb-2" style={{ color: '#8BA4BE' }}>
          Simulation Duration
        </label>
        <div className="flex gap-1.5">
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              className="flex-1 py-2 rounded-lg text-center transition-all"
              style={{
                background: duration === opt.value ? 'rgba(0,212,255,0.15)' : 'rgba(30,58,91,0.3)',
                border: duration === opt.value ? '1px solid #00D4FF' : '1px solid rgba(30,58,91,0.5)',
                color: duration === opt.value ? '#00D4FF' : '#8BA4BE',
              }}
            >
              <div className="text-xs font-bold">{opt.label}</div>
              <div className="text-xs opacity-60">{opt.sublabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Domain Focus ── */}
      <div className="px-4 mt-4">
        <label className="block text-xs font-medium mb-2" style={{ color: '#8BA4BE' }}>
          Focus Domains
        </label>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map(opt => {
            const active = focusedDomains.includes(opt.key);
            return (
              <button
                key={opt.key}
                onClick={() => toggleDomain(opt.key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: active ? `${opt.color}20` : 'rgba(30,58,91,0.3)',
                  border: active ? `1px solid ${opt.color}` : '1px solid rgba(30,58,91,0.5)',
                  color: active ? opt.color : '#8BA4BE',
                }}
              >
                {active && '✓ '}{opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="px-4 mt-6 space-y-2 pb-4">
        <button
          onClick={handleRun}
          disabled={isRunning || (mode === 'preset' && !selectedTemplate)}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #00D4FF, #0A84FF)',
            color: '#0A1628',
            boxShadow: isRunning ? 'none' : '0 0 30px rgba(0,212,255,0.3)',
          }}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-t-transparent border-[#0A1628] rounded-full animate-spin" />
              Simulating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              Run Simulation
            </span>
          )}
        </button>

        {onCompare && (
          <button
            onClick={handleCompare}
            disabled={isRunning || (mode === 'preset' && !selectedTemplate)}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: 'rgba(30,58,91,0.6)',
              border: '1px solid rgba(30,58,91,0.8)',
              color: '#8BA4BE',
            }}
          >
            {Icons.compare}
            Compare with Another Scenario
          </button>
        )}
      </div>
    </div>
  );
}