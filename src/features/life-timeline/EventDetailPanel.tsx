import type { TimelineEvent } from './useTimelineData';

const DOMAIN_COLORS: Record<string, string> = {
  habit: '#A855F7',
  health: '#22C55E',
  finance: '#FACC15',
  goal: '#3B82F6',
  achievement: '#F59E0B',
  journal: '#EC4899',
  social: '#F472B6',
  milestone: '#00D4FF',
};

const DOMAIN_ICONS: Record<string, string> = {
  habit: '🔥',
  health: '❤️',
  finance: '💰',
  goal: '🎯',
  achievement: '🏆',
  journal: '📝',
  social: '👥',
  milestone: '⭐',
};

const DOMAIN_LABELS: Record<string, string> = {
  habit: 'Habit',
  health: 'Health',
  finance: 'Finance',
  goal: 'Goal',
  achievement: 'Achievement',
  journal: 'Journal',
  social: 'Social',
  milestone: 'Milestone',
};

interface EventDetailPanelProps {
  event: TimelineEvent;
  relatedEvents: TimelineEvent[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSeeDay: (date: string) => void;
}

export default function EventDetailPanel({ event, relatedEvents, onClose, onNavigate, onSeeDay }: EventDetailPanelProps) {
  const color = DOMAIN_COLORS[event.domain] || '#8BA4BE';
  const icon = DOMAIN_ICONS[event.domain] || '📌';
  const domainLabel = DOMAIN_LABELS[event.domain] || event.domain;

  return (
    <div
      className="w-80 lg:w-96 flex-shrink-0 border-l overflow-y-auto"
      style={{
        background: 'rgba(10,22,40,0.98)',
        borderColor: 'rgba(30,58,91,0.5)',
        maxHeight: '100vh',
      }}
    >
      {/* ─── Header ─── */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{
          background: `${color}15`,
          borderBottom: `1px solid ${color}30`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigate.bind(null, 'prev')}
            className="p-1 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#8BA4BE' }}
            title="Previous event"
          >
            ◀
          </button>
          <button
            onClick={onNavigate.bind(null, 'next')}
            className="p-1 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#8BA4BE' }}
            title="Next event"
          >
            ▶
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-sm transition-colors hover:bg-white/5"
          style={{ color: '#8BA4BE' }}
        >
          ✕
        </button>
      </div>

      {/* ─── Main Event Info ─── */}
      <div className="p-5 space-y-4">
        {/* Icon + Type */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: `${color}20`, border: `1px solid ${color}40` }}
          >
            {icon}
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color }}>
              {domainLabel}
            </div>
            <div className="text-xs" style={{ color: '#5A7A9A' }}>
              {formatDate(event.date)}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold" style={{ color: '#E2E8F0' }}>
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed" style={{ color: '#8BA4BE' }}>
          {event.description}
        </p>

        {/* Importance badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#5A7A9A' }}>Importance</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className="w-5 h-5 rounded flex items-center justify-center text-xs"
                style={{
                  background: level <= event.importance ? color : 'rgba(30,58,91,0.3)',
                  color: level <= event.importance ? '#050E1A' : '#5A7A9A',
                }}
              >
                {level <= event.importance ? '★' : '☆'}
              </div>
            ))}
          </div>
        </div>

        {/* See this day button */}
        <button
          onClick={() => onSeeDay(event.date)}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}30`,
            color: color,
          }}
        >
          📅 See this day
        </button>

        {/* ─── Metadata ─── */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: 'rgba(30,58,91,0.2)', border: '1px solid rgba(30,58,91,0.3)' }}
          >
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: '#5A7A9A' }}>
              Details
            </div>
            {Object.entries(event.metadata).map(([key, value]) => {
              if (typeof value === 'object' && value !== null) return null;
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span style={{ color: '#8BA4BE' }}>{formatMetadataKey(key)}</span>
                  <span style={{ color: '#E2E8F0' }}>{String(value)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Related Events ─── */}
        {relatedEvents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: '#5A7A9A' }}>
              Related Events
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {relatedEvents.slice(0, 8).map((related) => {
                const rColor = DOMAIN_COLORS[related.domain] || '#8BA4BE';
                return (
                  <div
                    key={related.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 cursor-pointer"
                    style={{ borderLeft: `2px solid ${rColor}` }}
                  >
                    <span className="text-sm">{DOMAIN_ICONS[related.domain] || '📌'}</span>
                    <span className="flex-1 truncate" style={{ color: '#E2E8F0' }}>
                      {related.title}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#5A7A9A' }}>
                      {related.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}