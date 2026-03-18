// ═══ EventDrawer Cards — NowCard, FreeCard, ApproachingCard, CompletedView ═══

import React from 'react';
import {
  Clock, Zap, Trophy,
  ChevronRight, ArrowRight,
} from 'lucide-react';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { getTraditionIcon } from '../../lib/prayer-times';
import { useFasting, formatFastingDuration } from '../../hooks/useFasting';
import { ProgressRing } from '../ui/ProgressRing';
import { formatTime, formatMinutes, getCategoryIcon } from './helpers';

// ═══ NOW Card (with clickable title) ═══
export function NowCard({
  event, timeRemaining, progress, completing, onComplete, onTitleTap,
}: {
  event: ScheduleEvent;
  timeRemaining: number | null;
  progress: number;
  completing: boolean;
  onComplete: () => void;
  onTitleTap: () => void;
}) {
  const color = event.color || '#00D4FF';
  const { nextPrayer, tradition } = usePrayerTimes();
  const { isFasting, currentFast, progress: fastProgress } = useFasting();

  // Show prayer nudge if next prayer is within 30 minutes, or clashes with current event
  const prayerNudge = (() => {
    if (!nextPrayer || !tradition) return null;
    const now = new Date();
    const diffMin = Math.round((nextPrayer.time.getTime() - now.getTime()) / 60000);
    const icon = getTraditionIcon(tradition);

    // Check if prayer time falls WITHIN the current event (clash)
    const eventEnd = new Date(event.end_time);
    const prayerDuringEvent = nextPrayer.time >= now && nextPrayer.time <= eventEnd;

    if (prayerDuringEvent && diffMin > 0 && diffMin <= 60) {
      return { icon, name: nextPrayer.name, minutes: diffMin, isClash: true };
    }
    if (diffMin <= 0 || diffMin > 30) return null;
    return { icon, name: nextPrayer.name, minutes: diffMin, isClash: false };
  })();

  return (
    <div className="ed-now-card" style={{ '--ec': color } as React.CSSProperties}>
      {/* Fasting badge */}
      {isFasting && currentFast && fastProgress && (
        <div className="ed-fasting-badge">
          🌙 Fasting · {formatFastingDuration(fastProgress.remaining)} remaining
        </div>
      )}

      <div className="ed-now-main">
        <div className="ed-now-ring">
          <ProgressRing value={progress} color={color} size={72} strokeWidth={5} />
          <div className="ed-now-ring-icon" style={{ color }}>
            {getCategoryIcon(event.category, event.event_type, event.title, 18)}
          </div>
        </div>

        <div className="ed-now-info">
          <button className="ed-now-title ed-now-title--clickable" onClick={onTitleTap}>
            {event.title}
            <ChevronRight size={12} className="ed-now-title-arrow" />
          </button>
          <p className="ed-now-time">
            {formatTime(new Date(event.start_time))} – {formatTime(new Date(event.end_time))}
          </p>
          {timeRemaining !== null && (
            <div className="ed-now-remaining">
              <Clock size={10} />
              <span>{formatMinutes(timeRemaining)} left</span>
            </div>
          )}
          <div className="ed-now-progress-row">
            <div className="ed-now-bar">
              <div
                className="ed-now-bar-fill"
                style={{ width: `${progress}%`, background: color }}
              />
            </div>
            <span className="ed-now-pct">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <button
        className="ed-complete-btn"
        onClick={onComplete}
        disabled={completing}
      >
        {completing ? (
          <span>Completing…</span>
        ) : (
          <>
            <Trophy size={13} />
            <span>Complete Event</span>
            <span className="ed-xp-badge">
              <Zap size={10} />+25 XP
            </span>
          </>
        )}
      </button>

      {prayerNudge && (
        <div className={`ed-prayer-nudge ${prayerNudge.isClash ? 'ed-prayer-nudge--clash' : ''}`}>
          <span>{prayerNudge.icon}</span>
          <span>
            {prayerNudge.isClash
              ? `⚡ ${prayerNudge.name} during this event — ${prayerNudge.minutes}m`
              : `${prayerNudge.name} in ${prayerNudge.minutes} minute${prayerNudge.minutes !== 1 ? 's' : ''}`
            }
          </span>
        </div>
      )}
    </div>
  );
}

// ═══ Free Card ═══
export function FreeCard({
  freeUntil, nextEvent, suggestions, onSuggestionTap,
}: {
  freeUntil: Date | null;
  nextEvent: ScheduleEvent | null;
  suggestions: Array<{ id: string; icon: string; label: string; detail?: string; actionTarget?: string }>;
  onSuggestionTap: (target?: string) => void;
}) {
  const { nextPrayer, tradition } = usePrayerTimes();

  const prayerNudge = (() => {
    if (!nextPrayer || !tradition) return null;
    const now = new Date();
    const diffMin = Math.round((nextPrayer.time.getTime() - now.getTime()) / 60000);
    if (diffMin <= 0 || diffMin > 30) return null;
    const icon = getTraditionIcon(tradition);
    return { icon, name: nextPrayer.name, minutes: diffMin };
  })();

  return (
    <div className="ed-free-card">
      <div className="ed-free-top">
        <span className="ed-free-emoji"><Zap size={26} /></span>
        <div>
          <div className="ed-free-title">
            {freeUntil ? `Free until ${formatTime(freeUntil)}` : 'Free time'}
          </div>
          {nextEvent ? (
            <div className="ed-free-next">
              Next: <strong>{nextEvent.title}</strong> @ {formatTime(new Date(nextEvent.start_time))}
            </div>
          ) : (
            <div className="ed-free-next">No more events today</div>
          )}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="ed-free-suggestions">
          {suggestions.slice(0, 2).map(s => (
            <button
              key={s.id}
              className="ed-suggestion-pill"
              onClick={() => onSuggestionTap(s.actionTarget)}
            >
              <span>{s.icon}</span>
              <span className="ed-pill-label">{s.label}</span>
              <ArrowRight size={11} />
            </button>
          ))}
        </div>
      )}
      {prayerNudge && (
        <div className="ed-prayer-nudge">
          <span>{prayerNudge.icon}</span>
          <span>{prayerNudge.name} in {prayerNudge.minutes} minute{prayerNudge.minutes !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

// ═══ Approaching Card ═══
export function ApproachingCard({
  event, minutesToNext, suggestions, onSuggestionTap,
}: {
  event: ScheduleEvent;
  minutesToNext: number | null;
  suggestions: Array<{ id: string; icon: string; label: string; detail?: string; actionTarget?: string }>;
  onSuggestionTap: (target?: string) => void;
}) {
  const color = event.color || '#FACC15';

  return (
    <div className="ed-approaching-card" style={{ '--ec': color } as React.CSSProperties}>
      <div className="ed-approaching-inner">
        <div className="ed-approaching-badge">Starting soon</div>
        <div className="ed-approaching-count" style={{ color }}>
          {minutesToNext !== null ? `${minutesToNext}m` : ''}
        </div>
        <div className="ed-approaching-title">{event.title}</div>
        <div className="ed-approaching-time">
          {formatTime(new Date(event.start_time))} – {formatTime(new Date(event.end_time))}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="ed-free-suggestions">
          {suggestions.slice(0, 2).map(s => (
            <button
              key={s.id}
              className="ed-suggestion-pill"
              onClick={() => onSuggestionTap(s.actionTarget)}
            >
              <span>{s.icon}</span>
              <span className="ed-pill-label">{s.label}</span>
              <ArrowRight size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ Completed View ═══
export function CompletedView() {
  return (
    <div className="ed-completed">
      <div className="ed-completed-icon"><Trophy size={44} /></div>
      <div className="ed-completed-title">Event Complete!</div>
      <div className="ed-completed-xp">
        <Zap size={11} /> +25 XP earned
      </div>
    </div>
  );
}
