/**
 * BotActivityLog — Telegram Bot Activity Log
 *
 * Shows recent Telegram interactions with timestamp, user,
 * command, response, success/failure indicators. Supports
 * filtering by command type and tap to see full exchange.
 */

import { useState, useMemo } from 'react';
import { useTelegramStore, type TelegramActivityEntry } from '../../stores/telegramStore';

type FilterType = 'all' | 'success' | 'error' | string;

export function BotActivityLog() {
  const activityLog = useTelegramStore((s) => s.activityLog);
  const clearActivityLog = useTelegramStore((s) => s.clearActivityLog);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Derived command types for filter dropdown
  const commandTypes = useMemo(() => {
    const types = new Set(activityLog.map((e) => e.command));
    return Array.from(types).sort();
  }, [activityLog]);

  // Filtered & searched log
  const filtered = useMemo(() => {
    let entries = [...activityLog];

    if (filter === 'success') {
      entries = entries.filter((e) => e.status === 'success');
    } else if (filter === 'error') {
      entries = entries.filter((e) => e.status === 'error');
    } else if (filter !== 'all') {
      entries = entries.filter((e) => e.command === filter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.input.toLowerCase().includes(q) ||
          e.response.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          e.command.toLowerCase().includes(q),
      );
    }

    return entries;
  }, [activityLog, filter, searchQuery]);

  const successCount = activityLog.filter((e) => e.status === 'success').length;
  const errorCount = activityLog.filter((e) => e.status === 'error').length;

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; entries: TelegramActivityEntry[] }[] = [];
    let currentDay = '';

    for (const entry of filtered) {
      const day = new Date(entry.timestamp).toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      if (day !== currentDay) {
        currentDay = day;
        groups.push({ date: day, entries: [] });
      }

      groups[groups.length - 1].entries.push(entry);
    }

    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Successful</p>
        </div>
        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{errorCount}</p>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Errors</p>
        </div>
        <div className="flex-1 bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-[#0088cc]">{activityLog.length}</p>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search activity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#0088cc]/50"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-[#0088cc]/50"
        >
          <option value="all">All</option>
          <option value="success">✅ Success</option>
          <option value="error">❌ Errors</option>
          {commandTypes.map((cmd) => (
            <option key={cmd} value={cmd}>
              {cmd}
            </option>
          ))}
        </select>
        <button
          onClick={clearActivityLog}
          className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Activity List */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Interactions will appear here once the bot is active</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.date}>
              <p className="text-xs text-zinc-500 font-medium mb-2 px-1">{group.date}</p>
              <div className="space-y-1">
                {group.entries.map((entry) => (
                  <ActivityEntry
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedId === entry.id}
                    onToggle={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityEntry({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: TelegramActivityEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusIcon = entry.status === 'success' ? '✅' : entry.status === 'error' ? '❌' : '⏳';
  const statusColor =
    entry.status === 'success'
      ? 'text-emerald-400'
      : entry.status === 'error'
        ? 'text-red-400'
        : 'text-amber-400';

  const commandIcon = getCommandIcon(entry.command);

  return (
    <button
      onClick={onToggle}
      className="w-full text-left bg-black/40 border border-white/5 rounded-lg p-3 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{statusIcon}</span>
        <span className="text-sm">{commandIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-xs text-[#0088cc] font-mono">{entry.command}</code>
            <span className="text-xs text-zinc-500">
              by {entry.username}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate">
            {entry.input.substring(0, 60)}
            {entry.input.length > 60 ? '...' : ''}
          </p>
        </div>
        <span className="text-[10px] text-zinc-500 shrink-0">{time}</span>
        <span className="text-[10px] text-zinc-600 shrink-0">{entry.durationMs}ms</span>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Input</p>
            <div className="bg-[#1a1a2e] rounded px-2 py-1.5">
              <code className="text-xs text-white break-all">{entry.input}</code>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Response</p>
            <div className="bg-[#1a1a2e] rounded px-2 py-1.5">
              <code className={`text-xs break-all ${statusColor}`}>{entry.response}</code>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] text-zinc-500">
            <span>ID: {entry.id}</span>
            <span>User ID: {entry.userId}</span>
            <span>Duration: {entry.durationMs}ms</span>
            <span className={statusColor}>Status: {entry.status}</span>
          </div>
        </div>
      )}
    </button>
  );
}

function getCommandIcon(command: string): string {
  const icons: Record<string, string> = {
    start: '👋',
    log: '📝',
    habit: '🔥',
    mood: '😊',
    health: '💪',
    expense: '💸',
    income: '💰',
    balance: '📊',
    schedule: '📅',
    goals: '🎯',
    streak: '🔥',
    brief: '🌅',
    stats: '📈',
    journal: '📖',
    help: '❓',
    natural_language: '💬',
  };
  return icons[command] || '🤖';
}