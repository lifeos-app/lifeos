/**
 * VoiceCommandHistory — Chronological list of voice commands
 *
 * Shows transcript, parsed intent, action taken, and success/failure.
 * Tap to re-run a command. Filter by type. Clear history.
 */

import { useState, useCallback } from 'react';
import type { VoiceCommandHistoryEntry } from './useVoiceCommand';

// ─── Types ───────────────────────────────────────────────────────

type FilterType = 'all' | 'log' | 'show' | 'query' | 'action';

interface VoiceCommandHistoryProps {
  history: VoiceCommandHistoryEntry[];
  onRerun: (entry: VoiceCommandHistoryEntry) => void;
  onClear: () => void;
}

// ─── Intent → category map ────────────────────────────────────────

function getIntentCategory(intent: string | null): FilterType {
  if (!intent) return 'all';
  if (intent.startsWith('log_') || intent === 'log_generic') return 'log';
  if (intent.startsWith('show_') || intent === 'navigate') return 'show';
  if (intent.startsWith('query_') || intent === 'info') return 'query';
  return 'action';
}

function getIntentIcon(intent: string | null): string {
  if (!intent) return '❓';
  const icons: Record<string, string> = {
    log_work: '💼',
    log_habit: '🔥',
    log_expense: '💸',
    log_income: '💰',
    log_mood: '😊',
    log_health: '❤️',
    log_workout: '🏋️',
    log_meal: '🍽️',
    log_sleep: '😴',
    log_journal: '📝',
    log_generic: '📋',
    show_view: '👀',
    query_status: '📊',
    start_activity: '▶️',
    set_reminder: '⏰',
    expense: '💸',
    task: '✅',
    habit_log: '🔥',
    health_log: '❤️',
    info: '💬',
  };
  return icons[intent] || '🎤';
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ────────────────────────────────────────────────────

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'log', label: 'Logs' },
  { id: 'show', label: 'Views' },
  { id: 'query', label: 'Queries' },
  { id: 'action', label: 'Actions' },
];

export function VoiceCommandHistory({ history, onRerun, onClear }: VoiceCommandHistoryProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered = filter === 'all'
    ? history
    : history.filter(e => getIntentCategory(e.intent) === filter);

  const handleRerun = useCallback((entry: VoiceCommandHistoryEntry) => {
    onRerun(entry);
  }, [onRerun]);

  const handleClear = useCallback(() => {
    if (showClearConfirm) {
      onClear();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  }, [onClear, showClearConfirm]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="text-4xl mb-3 opacity-30">🎙️</div>
        <p className="text-sm text-center" style={{ color: '#8BA4BE' }}>
          No voice commands yet
        </p>
        <p className="text-xs text-center mt-1" style={{ color: '#475569' }}>
          Tap the mic and speak to start
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ color: '#E2E8F0' }}>
      {/* Filter tabs + Clear */}
      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(30,58,91,0.3)' }}>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background: filter === tab.id ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: filter === tab.id ? '#00D4FF' : '#8BA4BE',
                border: `1px solid ${filter === tab.id ? 'rgba(0,212,255,0.3)' : 'transparent'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleClear}
          className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0"
          style={{
            background: showClearConfirm ? 'rgba(239,68,68,0.15)' : 'transparent',
            color: showClearConfirm ? '#EF4444' : '#64748B',
            border: `1px solid ${showClearConfirm ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
          }}
        >
          {showClearConfirm ? 'Confirm?' : 'Clear'}
        </button>
      </div>

      {/* Command list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="space-y-1 p-3">
          {filtered.map(entry => {
            const category = getIntentCategory(entry.intent);
            const icon = getIntentIcon(entry.intent);
            const isSuccess = entry.status === 'success';
            const isError = entry.status === 'error';

            return (
              <button
                key={entry.id}
                onClick={() => handleRerun(entry)}
                className="w-full text-left p-3 rounded-lg transition-all duration-200 hover:brightness-110"
                style={{
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(30,58,91,0.3)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#E2E8F0' }}>
                      "{entry.transcript}"
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#8BA4BE' }}>
                      {entry.actionDescription || entry.confirmation}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px]" style={{ color: '#475569' }}>
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: isSuccess ? '#10B981' : isError ? '#EF4444' : '#FACC15',
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 ml-7">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: 'rgba(0,212,255,0.1)',
                      color: '#00D4FF',
                    }}
                  >
                    {category}
                  </span>
                  {entry.intent && entry.intent !== 'log_generic' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: 'rgba(139,92,246,0.1)',
                        color: '#C084FC',
                      }}
                    >
                      {entry.intent}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}