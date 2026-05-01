import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTimelineData } from './useTimelineData';
import type { TimelineZoom } from './useTimelineData';
import TimelineFilters from './TimelineFilters';
import EventDetailPanel from './EventDetailPanel';
import LifeChapters from './LifeChapters';
import type { TimelineEvent } from './useTimelineData';

// ─── Domain color mapping ───

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

const DOMAIN_BG: Record<string, string> = {
  habit: 'rgba(168,85,247,0.15)',
  health: 'rgba(34,197,94,0.15)',
  finance: 'rgba(250,204,21,0.15)',
  goal: 'rgba(59,130,246,0.15)',
  achievement: 'rgba(245,158,11,0.15)',
  journal: 'rgba(236,72,153,0.15)',
  social: 'rgba(244,114,182,0.15)',
  milestone: 'rgba(0,212,255,0.15)',
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

const ZOOM_LEVELS: { key: TimelineZoom; label: string; icon: string }[] = [
  { key: 'day', label: 'Day', icon: '📅' },
  { key: 'week', label: 'Week', icon: '📆' },
  { key: 'month', label: 'Month', icon: '🗓️' },
  { key: 'year', label: 'Year', icon: '📊' },
];

export function LifeTimeline() {
  const {
    filteredEvents,
    groupedEvents,
    chapters,
    filters,
    setFilters,
    zoom,
    setZoom,
    loading,
    getRelatedEvents,
  } = useTimelineData();

  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showChapters, setShowChapters] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [prevEventCount, setPrevEventCount] = useState(0);

  // ─── Animate newly visible events ───

  useEffect(() => {
    if (filteredEvents.length !== prevEventCount) {
      const newIds = filteredEvents.slice(0, Math.max(0, filteredEvents.length - prevEventCount)).map(e => e.id);
      if (newIds.length > 0 && newIds.length < 50) {
        setAnimatedIds(new Set(newIds));
        const timer = setTimeout(() => setAnimatedIds(new Set()), 600);
        return () => clearTimeout(timer);
      }
      setPrevEventCount(filteredEvents.length);
    }
  }, [filteredEvents.length]);

  // ─── Scroll to today ───

  const scrollToToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayEl = document.getElementById(`timeline-date-${today}`);
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // ─── Navigate to prev/next event ───

  const navigateEvent = useCallback((direction: 'prev' | 'next') => {
    if (!selectedEvent) return;
    const idx = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (idx === -1) return;
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < filteredEvents.length) {
      setSelectedEvent(filteredEvents[nextIdx]);
    }
  }, [selectedEvent, filteredEvents]);

  // ─── Today indicator ───

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ─── Stats summary ───

  const stats = useMemo(() => {
    const domainCounts: Record<string, number> = {};
    for (const e of filteredEvents) {
      domainCounts[e.domain] = (domainCounts[e.domain] || 0) + 1;
    }
    const dateRange = filteredEvents.length >= 2
      ? `${filteredEvents[filteredEvents.length - 1]?.date} — ${filteredEvents[0]?.date}`
      : '';
    return {
      total: filteredEvents.length,
      domainCounts,
      dateRange,
    };
  }, [filteredEvents]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050E1A' }}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-[#8BA4BE] text-lg">Loading your life timeline...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#050E1A', color: '#E2E8F0' }}>
      {/* ─── Filter Sidebar ─── */}
      <TimelineFilters
        filters={filters}
        onChange={setFilters}
        domainCounts={stats.domainCounts}
        show={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
      />

      {/* ─── Main Timeline Area ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ─── Header Bar ─── */}
        <div
          className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 border-b"
          style={{
            background: 'rgba(15,45,74,0.85)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(30,58,91,0.5)',
          }}
        >
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{
              background: showFilters ? 'rgba(0,212,255,0.2)' : 'rgba(30,58,91,0.8)',
              border: `1px solid ${showFilters ? '#00D4FF' : 'rgba(30,58,91,0.8)'}`,
              color: showFilters ? '#00D4FF' : '#8BA4BE',
            }}
          >
            <span>_filters</span>
            <span className="text-xs opacity-70">({stats.total})</span>
          </button>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold" style={{ color: '#00D4FF' }}>
              ⏳ Life Timeline
            </h1>
            <p className="text-xs" style={{ color: '#5A7A9A' }}>
              {stats.total} events · {Object.keys(stats.domainCounts).length} domains
            </p>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ background: 'rgba(30,58,91,0.6)' }}>
            {ZOOM_LEVELS.map((z) => (
              <button
                key={z.key}
                onClick={() => setZoom(z.key)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: zoom === z.key ? 'rgba(0,212,255,0.25)' : 'transparent',
                  color: zoom === z.key ? '#00D4FF' : '#8BA4BE',
                  borderBottom: zoom === z.key ? '2px solid #00D4FF' : '2px solid transparent',
                }}
                title={z.label}
              >
                {z.icon}
              </button>
            ))}
          </div>

          {/* Today button */}
          <button
            onClick={scrollToToday}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{
              background: 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00D4FF',
            }}
          >
            Today
          </button>

          {/* Chapters toggle */}
          <button
            onClick={() => setShowChapters(!showChapters)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: showChapters ? 'rgba(168,85,247,0.2)' : 'rgba(30,58,91,0.6)',
              border: `1px solid ${showChapters ? 'rgba(168,85,247,0.4)' : 'rgba(30,58,91,0.6)'}`,
              color: showChapters ? '#A855F7' : '#8BA4BE',
            }}
          >
            📖 Chapters
          </button>
        </div>

        {/* ─── Timeline Content ─── */}
        <div className="flex-1 overflow-y-auto" ref={timelineRef} style={{ maxHeight: 'calc(100vh - 64px)' }}>
          {filteredEvents.length === 0 ? (
            <EmptyState onClearFilters={() => setFilters({
              domains: { habit: true, health: true, finance: true, goal: true, achievement: true, journal: true, social: true, milestone: true },
              importanceThreshold: 1,
              dateRange: 'all',
              searchQuery: '',
            })} />
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 relative">
              {/* ─── Timeline Line (vertical) ─── */}
              <div
                className="absolute left-6 md:left-8 top-0 bottom-0 w-0.5"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,212,255,0.3), rgba(168,85,247,0.3), transparent)' }}
              />

              {/* ─── Chapters section ─── */}
              {showChapters && chapters.length > 0 && (
                <LifeChapters
                  chapters={chapters}
                  onChapterClick={(chapter) => {
                    // Scroll to chapter start
                    const el = document.getElementById(`timeline-date-${chapter.startDate}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
              )}

              {/* ─── Event Groups ─── */}
              {groupedEvents.map((group) => (
                <div key={group.key} id={`timeline-date-${group.key}`} className="mb-8">
                  {/* ─── Date Header ─── */}
                  <div className="relative flex items-center gap-3 mb-4 ml-12 md:ml-16">
                    <div
                      className="absolute -left-[calc(2rem+0.125rem)] md:-left-[calc(2rem+0.5rem+0.125rem)] w-3 h-3 rounded-full border-2 z-10"
                      style={{
                        borderColor: '#00D4FF',
                        background: group.events[0]?.date === today ? '#00D4FF' : '#050E1A',
                        boxShadow: group.events[0]?.date === today ? '0 0 12px #00D4FF' : 'none',
                      }}
                    />
                    <h2 className="text-sm font-bold tracking-wide uppercase" style={{ color: '#5A7A9A' }}>
                      {group.label}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(30,58,91,0.6)', color: '#8BA4BE' }}>
                      {group.events.length}
                    </span>
                  </div>

                  {/* ─── Events in this group ─── */}
                  <div className="space-y-2 ml-12 md:ml-16">
                    {group.events.map((event) => {
                      const isNew = animatedIds.has(event.id);
                      const isSelected = selectedEvent?.id === event.id;

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`
                            relative group cursor-pointer rounded-xl px-4 py-3 transition-all duration-200
                            hover:scale-[1.01] hover:shadow-lg
                            ${isNew ? 'animate-[slideIn_0.5s_ease-out]' : ''}
                          `}
                          style={{
                            background: isSelected
                              ? `${DOMAIN_COLORS[event.domain]}20`
                              : DOMAIN_BG[event.domain] || 'rgba(30,58,91,0.3)',
                            border: isSelected
                              ? `1px solid ${DOMAIN_COLORS[event.domain]}`
                              : '1px solid rgba(30,58,91,0.4)',
                            borderLeft: `3px solid ${DOMAIN_COLORS[event.domain]}`,
                            transform: isNew ? 'translateX(0)' : undefined,
                          }}
                        >
                          {/* Connector dot */}
                          <div
                            className="absolute -left-[calc(2rem+0.125rem)] md:-left-[calc(2rem+0.5rem-1.5rem)] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10"
                            style={{ background: DOMAIN_COLORS[event.domain] }}
                          />

                          {/* Event content */}
                          <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0" title={event.domain}>
                              {DOMAIN_ICONS[event.domain] || '📌'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm truncate" style={{ color: '#E2E8F0' }}>
                                  {event.title}
                                </span>
                                {event.importance >= 4 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{
                                    background: event.importance >= 5 ? 'rgba(255,215,0,0.2)' : 'rgba(0,212,255,0.2)',
                                    color: event.importance >= 5 ? '#FFD700' : '#00D4FF',
                                  }}>
                                    {event.importance >= 5 ? '⭐ MAJOR' : '🔥 NOTABLE'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs truncate" style={{ color: '#8BA4BE' }}>
                                {event.description}
                              </p>
                            </div>
                            <div className="text-xs flex-shrink-0" style={{ color: '#5A7A9A' }}>
                              {event.date === today ? 'Today' : event.date.slice(5)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ─── Today indicator ─── */}
              {filteredEvents.some(e => e.date <= today) && (
                <div className="relative flex items-center gap-3 ml-12 md:ml-16 py-2">
                  <div
                    className="absolute -left-[calc(2rem+0.125rem)] md:-left-[calc(2rem+0.5rem+0.125rem)] w-4 h-4 rounded-full z-10 pulse"
                    style={{
                      background: '#00D4FF',
                      boxShadow: '0 0 20px #00D4FF, 0 0 40px rgba(0,212,255,0.3)',
                    }}
                  />
                  <span className="text-sm font-bold" style={{ color: '#00D4FF' }}>
                    ─── TODAY ───
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Event Detail Panel ─── */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          relatedEvents={getRelatedEvents(selectedEvent, filteredEvents)}
          onClose={() => setSelectedEvent(null)}
          onNavigate={navigateEvent}
          onSeeDay={(date) => {
            setZoom('day');
            // Scroll to that date after zoom change
            setTimeout(() => {
              const el = document.getElementById(`timeline-date-${date}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
        />
      )}

      {/* ─── Animations CSS ─── */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ─── Empty State ───

function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm mx-auto px-6">
        <div className="text-6xl mb-6">🏜️</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#E2E8F0' }}>No Events Found</h2>
        <p className="text-sm mb-6" style={{ color: '#8BA4BE' }}>
          Your timeline is empty with the current filters. Try adjusting your filters or check back after logging more data.
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
          style={{
            background: 'rgba(0,212,255,0.15)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00D4FF',
          }}
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
}

export default LifeTimeline;