/**
 * VoiceQuickActions — Quick voice shortcuts
 *
 * Preset one-tap voice shortcuts with microphone icons.
 * "Log Work" → starts listening for work log
 * "How Am I?" → reads out current stats
 * "What's Next?" → reads schedule
 * "Quick Journal" → starts voice-to-journal entry
 * Custom shortcuts users can define.
 */

import { useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  preset: string;  // Text to send to the intent engine
  color: string;
  category: 'log' | 'query' | 'action' | 'view';
}

interface VoiceQuickActionsProps {
  onTrigger: (text: string) => void;
  onSpeak: (text: string) => void;
  customActions?: QuickAction[];
  onAddCustom?: (action: QuickAction) => void;
}

// ─── Preset Actions ───────────────────────────────────────────────

const PRESET_ACTIONS: QuickAction[] = [
  {
    id: 'log-work',
    label: 'Log Work',
    description: 'Voice log work hours & location',
    icon: '💼',
    preset: 'log work',
    color: '#00D4FF',
    category: 'log',
  },
  {
    id: 'log-mood',
    label: 'How Am I?',
    description: 'Reads out your streak, mood, energy',
    icon: '📊',
    preset: "what's my mood",
    color: '#C084FC',
    category: 'query',
  },
  {
    id: 'whats-next',
    label: "What's Next?",
    description: 'Reads your upcoming schedule',
    icon: '📅',
    preset: "what's my schedule",
    color: '#39FF14',
    category: 'query',
  },
  {
    id: 'quick-journal',
    label: 'Quick Journal',
    description: 'Start a voice-to-journal entry',
    icon: '📝',
    preset: 'log journal',
    color: '#EC4899',
    category: 'log',
  },
  {
    id: 'log-expense',
    label: 'Log Expense',
    description: 'Voice log an expense quickly',
    icon: '💸',
    preset: 'log expense',
    color: '#FACC15',
    category: 'log',
  },
  {
    id: 'start-focus',
    label: 'Focus Block',
    description: 'Start a focus timer',
    icon: '🎯',
    preset: 'start focus block',
    color: '#F97316',
    category: 'action',
  },
  {
    id: 'log-habits',
    label: 'Log Habits',
    description: 'Check off today\'s habits',
    icon: '🔥',
    preset: 'log habits today',
    color: '#10B981',
    category: 'log',
  },
  {
    id: 'show-dashboard',
    label: 'Dashboard',
    description: 'Navigate to today\'s dashboard',
    icon: '🏠',
    preset: 'show dashboard',
    color: '#64748B',
    category: 'view',
  },
];

// ─── Component ────────────────────────────────────────────────────

export function VoiceQuickActions({ onTrigger, onSpeak, customActions = [], onAddCustom }: VoiceQuickActionsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionPreset, setNewActionPreset] = useState('');
  const [newActionIcon, setNewActionIcon] = useState('🎤');

  const allActions = [...PRESET_ACTIONS, ...customActions];

  const handleTrigger = useCallback((action: QuickAction) => {
    // For query actions, also speak the result
    if (action.category === 'query') {
      onTrigger(action.preset);
      // The result will be spoken by the voice command hook via TTS
    } else {
      onTrigger(action.preset);
    }
  }, [onTrigger]);

  const handleAddCustom = useCallback(() => {
    if (!newActionLabel.trim() || !newActionPreset.trim()) return;
    const colors = ['#00D4FF', '#C084FC', '#39FF14', '#FACC15', '#F97316', '#EC4899', '#10B981'];
    onAddCustom?.({
      id: `custom_${Date.now()}`,
      label: newActionLabel.trim(),
      description: `Custom: ${newActionPreset.trim()}`,
      icon: newActionIcon,
      preset: newActionPreset.trim(),
      color: colors[Math.floor(Math.random() * colors.length)],
      category: 'log' as const,
    });
    setNewActionLabel('');
    setNewActionPreset('');
    setNewActionIcon('🎤');
    setShowAddForm(false);
  }, [newActionLabel, newActionPreset, newActionIcon, onAddCustom]);

  return (
    <div className="flex flex-col" style={{ color: '#E2E8F0' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(30,58,91,0.3)' }}>
        <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#8BA4BE' }}>
          Quick Actions
        </h3>
        {onAddCustom && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{
              background: showAddForm ? 'rgba(0,212,255,0.15)' : 'transparent',
              color: showAddForm ? '#00D4FF' : '#64748B',
              border: `1px solid ${showAddForm ? 'rgba(0,212,255,0.3)' : 'rgba(30,58,91,0.3)'}`,
            }}
          >
            + Add
          </button>
        )}
      </div>

      {/* Add custom action form */}
      {showAddForm && (
        <div className="px-3 py-2.5 space-y-2" style={{ borderBottom: '1px solid rgba(30,58,91,0.3)', background: 'rgba(15,23,42,0.5)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newActionIcon}
              onChange={e => setNewActionIcon(e.target.value)}
              className="w-10 text-center text-sm rounded-md px-1 py-1.5"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,58,91,0.4)', color: '#E2E8F0' }}
              placeholder="🎤"
              maxLength={2}
            />
            <input
              type="text"
              value={newActionLabel}
              onChange={e => setNewActionLabel(e.target.value)}
              className="flex-1 text-sm rounded-md px-2 py-1.5"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,58,91,0.4)', color: '#E2E8F0' }}
              placeholder="Action name"
              maxLength={20}
            />
          </div>
          <input
            type="text"
            value={newActionPreset}
            onChange={e => setNewActionPreset(e.target.value)}
            className="w-full text-sm rounded-md px-2 py-1.5"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,58,91,0.4)', color: '#E2E8F0' }}
            placeholder='Voice command (e.g. "log mood good")'
            maxLength={100}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddCustom}
              disabled={!newActionLabel.trim() || !newActionPreset.trim()}
              className="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                color: '#070D1A',
                opacity: (!newActionLabel.trim() || !newActionPreset.trim()) ? 0.4 : 1,
              }}
            >
              Add Shortcut
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 text-xs py-1.5 rounded-md"
              style={{ background: 'rgba(30,58,91,0.3)', color: '#8BA4BE' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action grid */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {allActions.map(action => (
          <button
            key={action.id}
            onClick={() => handleTrigger(action)}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(15,23,42,0.4)',
              border: `1px solid rgba(30,58,91,0.3)`,
            }}
            title={action.description}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              style={{
                background: `${action.color}15`,
                border: `1px solid ${action.color}30`,
              }}
            >
              {action.icon}
            </div>
            <span className="text-[10px] font-medium text-center leading-tight" style={{ color: '#C8D6E5' }}>
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}