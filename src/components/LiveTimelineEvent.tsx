/**
 * LiveTimelineEvent — Growing live event box for the scheduler timeline.
 *
 * Renders a pulsing, animated event block that grows as time passes.
 * Shows: LIVE dot, title, elapsed time, metadata chips.
 * Designed to be positioned absolutely within the timeline grid.
 */

import { useMemo } from 'react';
import { MapPin, DollarSign, Gauge } from 'lucide-react';
import type { LiveEvent, LiveEventMetadata } from '../stores/useLiveActivityStore';
import './LiveTimelineEvent.css';

// ─── Helpers ────────────────────────────────────────

function formatElapsedCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatTimeShort(iso: string, use24h: boolean): string {
  const d = new Date(iso);
  if (use24h) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

// ─── Mini Metadata Chips ────────────────────────────

function LiveChips({ metadata, compact }: { metadata: LiveEventMetadata; compact: boolean }) {
  const chips: Array<{ icon: React.ReactNode; label: string }> = [];

  if (metadata.location) {
    chips.push({ icon: <MapPin size={9} />, label: String(metadata.location) });
  }
  if (metadata.expected_income) {
    chips.push({ icon: <DollarSign size={9} />, label: `$${metadata.expected_income}` });
  }
  if (metadata.odometer_start && !metadata.odometer_end) {
    chips.push({ icon: <Gauge size={9} />, label: `Odo: ${Number(metadata.odometer_start).toLocaleString()}` });
  }
  if (metadata.odometer_start && metadata.odometer_end) {
    const km = (metadata.odometer_end as number) - (metadata.odometer_start as number);
    if (km > 0) chips.push({ icon: <MapPin size={9} />, label: `${km}km` });
  }

  if (!chips.length) return null;

  // In compact mode, show max 2 chips
  const visible = compact ? chips.slice(0, 2) : chips;

  return (
    <div className="lte-chips">
      {visible.map((chip, i) => (
        <span key={i} className="lte-chip">
          {chip.icon}
          <span>{chip.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────

interface LiveTimelineEventProps {
  event: LiveEvent;
  elapsedSeconds: number;
  metadata: LiveEventMetadata;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  use24h: boolean;
  dimmed?: boolean;   // true when shown as side-by-side with overlap
  onClick: () => void;
}

export function LiveTimelineEvent({
  event,
  elapsedSeconds,
  metadata,
  topPx,
  heightPx,
  leftPct,
  widthPct,
  use24h,
  dimmed,
  onClick,
}: LiveTimelineEventProps) {
  const height = Math.max(heightPx, 44);
  const isCompact = height < 90;
  const isTiny = height < 48;

  // Determine accent color: cyan for work/cleaning, amber for driving/general
  const category = metadata.category || event.category || 'general';
  const isAmber = ['driving', 'transport', 'errand'].includes(category);
  const accentClass = isAmber ? 'lte--amber' : 'lte--cyan';

  return (
    <div
      className={`lte-container ${accentClass} ${dimmed ? 'lte--dimmed' : ''}`}
      style={{
        top: topPx,
        height,
        left: `${leftPct}%`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Pulsing border glow (via CSS pseudo-element) */}
      <div className="lte-glow" />

      {/* Content */}
      <div className="lte-content">
        {/* Top row: LIVE dot + title */}
        <div className="lte-top-row">
          <span className="lte-live-dot" />
          {!isTiny && <span className="lte-live-label">LIVE</span>}
          <span className="lte-title">{event.title}</span>
        </div>

        {/* Elapsed time */}
        {!isTiny && (
          <div className="lte-elapsed">
            ⏱ {formatElapsedCompact(elapsedSeconds)}
            <span className="lte-start-time">
              {' · '}{formatTimeShort(event.start_time, use24h)}
            </span>
          </div>
        )}

        {/* Metadata chips — only if enough space */}
        {!isCompact && <LiveChips metadata={metadata} compact={height < 100} />}
      </div>

      {/* Growing edge indicator */}
      <div className="lte-growing-edge" />
    </div>
  );
}
