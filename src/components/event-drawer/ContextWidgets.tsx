// ═══ EventDrawer — ContextTab, FastingContextWidget, JunctionContextWidget ═══

import {
  Calendar,
  ChevronRight, ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';
import { useJunction, useJunctionWisdom, useJunctionCalendar } from '../../hooks/useJunction';
import { useFasting, formatFastingDuration } from '../../hooks/useFasting';
import type { WeeklyStats } from './hooks';
import { formatMinutes, getTimeOfDayLabel, getContextMessage, resolveEventCategory } from './helpers';

// ═══ CONTEXT Tab ═══
export function ContextTab({ event, weeklyStats }: {
  event: ScheduleEvent;
  weeklyStats: WeeklyStats;
}) {
  const timeLabel = getTimeOfDayLabel();
  const message = getContextMessage(timeLabel, event.event_type || event.category, event.title);
  const category = resolveEventCategory(event);

  // Category colors
  const catColors: Record<string, string> = {
    work: '#F97316',
    education: '#3B82F6',
    health: '#39FF14',
    personal: '#A855F7',
  };

  const totalMinutes = Object.values(weeklyStats.categoryDistribution).reduce((s, v) => s + v, 0);
  const catEntries = ['work', 'education', 'health', 'personal'].map(cat => ({
    cat,
    minutes: weeklyStats.categoryDistribution[cat] || 0,
    pct: totalMinutes > 0 ? ((weeklyStats.categoryDistribution[cat] || 0) / totalMinutes) * 100 : 0,
    color: catColors[cat] || '#64748B',
  }));

  // Current event contribution
  const catMinutes = weeklyStats.categoryDistribution[category] || 0;
  const catPct = totalMinutes > 0 ? (catMinutes / totalMinutes) * 100 : 0;

  return (
    <div className="ed-context-tab">
      {/* Time of Day */}
      <div className="ed-ctx-time-block">
        <div className="ed-ctx-time-label">{timeLabel}</div>
        <p className="ed-ctx-message">{message}</p>
      </div>

      {/* Weekly Distribution */}
      <div className="ed-ctx-section">
        <div className="ed-ctx-section-label">Weekly Time Distribution</div>
        <div className="ed-ctx-dist-bar">
          {catEntries.map(e => (
            e.pct > 0 ? (
              <div
                key={e.cat}
                className="ed-ctx-dist-segment"
                style={{ width: `${Math.max(e.pct, 3)}%`, background: e.color }}
                title={`${e.cat}: ${formatMinutes(Math.round(e.minutes))}`}
              />
            ) : null
          ))}
        </div>
        <div className="ed-ctx-dist-legend">
          {catEntries.map(e => (
            <div key={e.cat} className="ed-ctx-dist-item">
              <span className="ed-ctx-dist-dot" style={{ background: e.color }} />
              <span className="ed-ctx-dist-cat">{e.cat}</span>
              <span className="ed-ctx-dist-val">{formatMinutes(Math.round(e.minutes))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* This Event Contributes To */}
      <div className="ed-ctx-section">
        <div className="ed-ctx-contributes">
          <span className="ed-ctx-contributes-label">This event contributes to:</span>
          <div className="ed-ctx-contributes-row">
            <span className="ed-ctx-contributes-cat" style={{ color: catColors[category] || '#64748B' }}>
              {category}
            </span>
            <div className="ed-ctx-mini-bar">
              <div
                className="ed-ctx-mini-bar-fill"
                style={{ width: `${Math.min(catPct, 100)}%`, background: catColors[category] || '#64748B' }}
              />
            </div>
            <span className="ed-ctx-mini-pct">{Math.round(catPct)}%</span>
          </div>
        </div>
      </div>

      {/* Fasting Widget */}
      <FastingContextWidget />

      {/* Junction Integration */}
      <JunctionContextWidget />
    </div>
  );
}

// ═══ Fasting Context Widget ═══
export function FastingContextWidget() {
  const { currentFast, isFasting, progress, encouragement, fastingLabel } = useFasting();

  if (!currentFast) return null;

  return (
    <div className="ed-ctx-section" style={{
      border: '1px solid rgba(245, 158, 11, 0.15)',
      background: 'rgba(245, 158, 11, 0.04)',
      borderRadius: 12,
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🌙</span>
        <span style={{
          color: '#F59E0B',
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.5px',
        }}>
          {fastingLabel}
        </span>
      </div>

      {/* Progress bar */}
      {progress && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'rgba(245, 158, 11, 0.7)',
            marginBottom: 4,
          }}>
            <span>{formatFastingDuration(progress.elapsed)} elapsed</span>
            <span>{formatFastingDuration(progress.remaining)} remaining</span>
          </div>
          <div style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(245, 158, 11, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress.percent}%`,
              background: isFasting
                ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                : 'rgba(245, 158, 11, 0.3)',
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: 10,
            color: 'rgba(245, 158, 11, 0.5)',
            marginTop: 4,
          }}>
            {Math.round(progress.percent)}%
          </div>
        </div>
      )}

      {/* Encouragement */}
      {encouragement && (
        <p style={{
          fontSize: 11,
          color: 'rgba(245, 158, 11, 0.8)',
          fontStyle: 'italic',
          margin: '0 0 8px 0',
          lineHeight: 1.5,
        }}>
          "{encouragement}"
        </p>
      )}

      {/* Rules reminder */}
      <p style={{
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.4)',
        margin: 0,
        lineHeight: 1.4,
      }}>
        {currentFast.rules}
      </p>
    </div>
  );
}

// ═══ Junction Context Widget (for Context Tab) ═══
export function JunctionContextWidget() {
  const navigate = useNavigate();
  const { userJunction, tradition, xpProgress, isEquipped, loading } = useJunction();
  const { wisdom } = useJunctionWisdom(isEquipped ? userJunction?.tradition_id : undefined);
  const { entries: calendarEntries } = useJunctionCalendar(isEquipped ? userJunction?.tradition_id : undefined);

  if (loading) return null;

  if (!isEquipped) {
    return (
      <div className="ed-ctx-junction">
        <button
          className="jnc-mini-equip-link"
          onClick={() => navigate('/character?tab=junction')}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Sparkles size={14} />
          Choose your path — Equip a tradition
          <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="ed-ctx-junction" style={{ border: '1px solid rgba(168,85,247,0.15)', background: 'rgba(168,85,247,0.04)', borderRadius: 12, padding: 14 }}>
      <div className="ed-ctx-junction-header" style={{ marginBottom: 10 }}>
        <Sparkles size={14} style={{ color: '#A855F7' }} />
        <span style={{ color: '#A855F7', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Junction</span>
      </div>

      {/* Mini Figure */}
      {xpProgress.currentFigure && (
        <div className="jnc-mini-figure">
          <div className="jnc-mini-avatar">{xpProgress.currentFigure.icon}</div>
          <div className="jnc-mini-info">
            <div className="jnc-mini-name">{tradition?.icon} {tradition?.name}</div>
            <div className="jnc-mini-title">{xpProgress.currentFigure.name} — {xpProgress.currentFigure.title}</div>
          </div>
        </div>
      )}

      {/* Mini XP bar */}
      <div className="jnc-mini-xp">
        <div className="jnc-mini-xp-fill" style={{ width: `${xpProgress.progressPercent}%` }} />
      </div>

      {/* Wisdom */}
      {wisdom && (
        <div className="jnc-mini-wisdom">
          "{wisdom.text}"
          {wisdom.source && <span style={{ color: '#D4AF37', display: 'block', marginTop: 4, fontSize: 10 }}>— {wisdom.source}</span>}
        </div>
      )}

      {/* Calendar */}
      {calendarEntries.length > 0 && (
        <div className="jnc-mini-cal">
          <Calendar size={11} />
          {calendarEntries.map(e => e.name).join(', ')}
        </div>
      )}

      {/* Switch / Manage Junction */}
      <button
        className="jnc-mini-switch-btn"
        onClick={() => navigate('/character?tab=junction')}
      >
        <ArrowLeftRight size={12} />
        Switch or manage Junction
      </button>
    </div>
  );
}
