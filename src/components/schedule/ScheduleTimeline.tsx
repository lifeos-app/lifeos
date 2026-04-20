/**
 * ScheduleTimeline — Hourly timeline for the day view
 *
 * Renders: hour rows, now indicator, drop indicator, multi-column layer
 * headers/dividers, event/task/habit blocks, sacred overlay, and live event block.
 */
import { type RefObject } from 'react';
import { Plus, Circle, CheckCircle2, Flame, Trash2, Play } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { LiveTimelineEvent } from '../LiveTimelineEvent';
import {
  fmtHourLabel, timeStr, WAKE_END,
  type ScheduleEvent, type LayerFilter,
} from './utils';
import { localDateStr } from '../../utils/date';

interface ScheduleTimelineProps {
  hours: number[];
  hourH: number;
  use24h: boolean;
  showAllHours: boolean;
  effectiveStart: number;
  isTodaySel: boolean;
  filteredEvents: ScheduleEvent[];
  evBlocks: any[];
  taskBlocks: any[];
  habitBlocks: any[];
  allBlocks: any[];
  adjustedAllBlocks: any[];
  isMultiCol: boolean;
  layerColumns: any[] | null;
  dragHandlers: {
    dragId: string | null;
    dragGhostTop: number | null;
    dropHour: number | null;
    touchDragId: string | null;
    touchDragTopPx: number | null;
    touchDragActive: React.MutableRefObject<boolean>;
    touchDragJustEnded: React.MutableRefObject<boolean>;
    resizeId: string | null;
    resizeH: number | null;
    swipeId: string | null;
    swipeX: number;
    handleDragStart: (e: React.DragEvent, eventId: string) => void;
    handleDragEnd: () => void;
    handleTimelineDragOver: (e: React.DragEvent) => void;
    handleTimelineDrop: (e: React.DragEvent) => void;
    handleResizeStart: (e: React.PointerEvent, eventId: string, currentHeight: number) => void;
    handleResizeMove: (e: React.PointerEvent) => void;
    handleResizeEnd: (e: React.PointerEvent) => void;
    handleSwipeStart: (e: React.TouchEvent, eventId: string) => void;
    handleSwipeMove: (e: React.TouchEvent) => void;
    handleSwipeEnd: () => void;
    handleEventTouchStart: (ev: ScheduleEvent) => void;
    handleEventTouchEnd: () => void;
  };
  sacredBlocks: Array<{ id: string; startMin: number; endMin: number; category: string; icon: string; name: string }>;
  sacredLayout: { leftPct: number; widthPct: number };
  glowIntensity: number;
  overlayOpacity: number;
  spiritualLevel: number;
  junctionEquipped: boolean;
  liveActiveEvent: import('../../stores/useLiveActivityStore').LiveEvent | null;
  liveElapsedSeconds: number;
  liveMetadata: import('../../stores/useLiveActivityStore').LiveEventMetadata;
  liveBlock: { startMin: number; endMin: number; elapsedMin: number } | null;
  liveLayout: { leftPct: number; widthPct: number } | null;
  timelineRef: RefObject<HTMLDivElement | null>;
  startOverlay: (ev: any) => void;
  openAddAtHour: (hour: number) => void;
  setDetailTaskId: (id: string | null) => void;
  setDetailEvent: (ev: any) => void;
  toggleHabit: (id: string) => void;
}

export function ScheduleTimeline({
  hours,
  hourH,
  use24h,
  showAllHours,
  effectiveStart,
  isTodaySel,
  filteredEvents,
  evBlocks,
  taskBlocks,
  habitBlocks,
  allBlocks,
  adjustedAllBlocks,
  isMultiCol,
  layerColumns,
  dragHandlers,
  sacredBlocks,
  sacredLayout,
  glowIntensity,
  overlayOpacity,
  spiritualLevel,
  junctionEquipped,
  liveActiveEvent,
  liveElapsedSeconds,
  liveMetadata,
  liveBlock,
  liveLayout,
  timelineRef,
  startOverlay,
  openAddAtHour,
  setDetailTaskId,
  setDetailEvent,
  toggleHabit,
}: ScheduleTimelineProps) {
  const nowDate = new Date();
  const nowMin = isTodaySel ? nowDate.getHours() * 60 + nowDate.getMinutes() : -1;
  const firstHour = showAllHours ? 0 : effectiveStart;

  const {
    dragId, dragGhostTop, dropHour,
    touchDragId, touchDragTopPx, touchDragActive, touchDragJustEnded,
    resizeId, resizeH, swipeId, swipeX,
    handleDragStart, handleDragEnd,
    handleTimelineDragOver, handleTimelineDrop,
    handleResizeStart, handleResizeMove, handleResizeEnd,
    handleSwipeStart, handleSwipeMove, handleSwipeEnd,
    handleEventTouchStart, handleEventTouchEnd,
  } = dragHandlers;

  return (
    <div
      className={`sched-timeline ${dragId ? 'dragging' : ''} ${isMultiCol && layerColumns && layerColumns.length > 1 ? 'sched-timeline--multi-col' : ''}`}
      ref={timelineRef}
      style={{ position: 'relative', minHeight: hours.length * hourH }}
      onDragOver={handleTimelineDragOver}
      onDrop={handleTimelineDrop}
      onDragLeave={() => { /* handled via setDragGhostTop/setDropHour */ }}
    >
      {/* Hour rows */}
      {hours.map((h, idx) => {
        const label = fmtHourLabel(h, use24h);
        const top = idx * hourH;
        const isPast = isTodaySel && nowDate.getHours() > h;
        const isDropTarget = dropHour === h;
        return (
          <div key={h} className={`stl-hour ${isPast ? 'past' : ''} ${isDropTarget ? 'drop-target' : ''}`} style={{ top, height: hourH }}>
            <span className="stl-label">{label}</span>
            <div className="stl-line" />
            <button className="stl-add" onClick={() => openAddAtHour(h)} title="Add event" aria-label="Add event"><Plus size={12} /></button>
          </div>
        );
      })}

      {/* Now indicator */}
      {nowMin >= 0 && (() => {
        const nowOffset = ((nowMin / 60) - firstHour) * hourH;
        if (nowOffset < 0 || nowOffset > hours.length * hourH) return null;
        return (
          <div className="stl-now" style={{ top: nowOffset }}>
            <div className="stl-now-dot" />
            <div className="stl-now-line" />
          </div>
        );
      })()}

      {/* Drop indicator line */}
      {dragGhostTop !== null && (
        <div className="stl-drop-indicator" style={{ top: dragGhostTop }} />
      )}

      {/* Multi-column layer headers + dividers (desktop only) */}
      {isMultiCol && layerColumns && layerColumns.length > 1 && (() => {
        const nCols = layerColumns.length;
        const colWidthPct = 86 / nCols;
        return (
          <>
            {layerColumns.map((col: any, i: number) => {
              const colLeft = 10 + i * colWidthPct;
              return (
                <div key={`hdr-${col.layer}`} className="sched-col-header" style={{ position: 'absolute', top: -28, left: `${colLeft}%`, width: `${colWidthPct}%`, zIndex: 15 }}>
                  <span>{col.icon}</span> {col.label}
                </div>
              );
            })}
            {layerColumns.slice(1).map((col: any, i: number) => {
              const divLeft = 10 + (i + 1) * colWidthPct;
              return (
                <div key={`div-${col.layer}`} className="sched-col-divider" style={{ position: 'absolute', top: 0, bottom: 0, left: `${divLeft}%`, width: 1, background: 'rgba(255,255,255,0.06)', zIndex: 4 }} />
              );
            })}
          </>
        );
      })()}

      {/* Event, Task, and Habit blocks */}
      {adjustedAllBlocks.map((item: any) => {
        // Skip if hidden by live event (rendered separately)
        if (item._hiddenByLive) return null;

        const topPx = ((item.startMin / 60) - firstHour) * hourH;
        const rawHeight = ((item.endMin - item.startMin) / 60) * hourH;
        const isResizing = item._type === 'event' && resizeId === item.id;
        const isSwiping = item._type === 'event' && swipeId === item.id;
        const height = Math.max(isResizing && resizeH !== null ? resizeH : rawHeight, 40);

        // Multi-column: position blocks within their layer's column
        let leftPct: number;
        let widthPct: number;
        if (isMultiCol && layerColumns && layerColumns.length > 1) {
          const itemLayer = item._type === 'event' ? (item.schedule_layer || 'primary') : 'primary';
          const colIdx = layerColumns.findIndex((c: any) => c.layer === itemLayer);
          const nCols = layerColumns.length;
          const colWidthPct = 86 / nCols;
          const colLeft = 10 + (colIdx >= 0 ? colIdx : 0) * colWidthPct;
          leftPct = colLeft + (item.col / item.totalCols) * colWidthPct;
          widthPct = (1 / item.totalCols) * colWidthPct;
        } else {
          leftPct = 10 + (item.col / item.totalCols) * 86;
          widthPct = (1 / item.totalCols) * 86;
        }
        const durationMin = item.endMin - item.startMin;
        const isShort = durationMin <= 15 || height < 46;
        const isDragging = item._type === 'event' && dragId === item.id;
        const isTouchDragging = item._type === 'event' && touchDragId === item.id && touchDragActive.current;
        const isDimmedByLive = item._dimmable;
        const isGoogleEvent = item._type === 'event' && item.source === 'google';
        const evLayer = item._type === 'event' ? (item.schedule_layer || 'primary') : 'primary';
        const isSacred = evLayer === 'sacred';
        const isOps = evLayer === 'operations';
        const isTask = item._type === 'task';
        const isHabit = item._type === 'habit';

        if (!showAllHours && (item.startMin / 60 < effectiveStart || item.startMin / 60 >= WAKE_END)) return null;

        // Render tasks
        if (isTask) {
          return (
            <div
              key={`task-${item.id}`}
              data-task-id={item.id}
              className="stl-event stl-event--task"
              style={{
                top: topPx,
                height,
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 4px)`,
                '--ev-color': item.priority === 'urgent' ? '#F43F5E' : item.priority === 'high' ? '#F97316' : '#00D4FF',
                borderLeft: `3px solid var(--ev-color)`,
                background: 'rgba(0,212,255,0.08)',
              } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                setDetailTaskId(item.id);
              }}
            >
              <span className="stl-ev-title">
                <Circle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {item.title}
              </span>
              {!isShort && <span className="stl-ev-time" style={{ fontSize: 10, opacity: 0.6 }}>Due today</span>}
            </div>
          );
        }

        // Render habits
        if (isHabit) {
          return (
            <div
              key={`habit-${item.id}`}
              className={`stl-event stl-event--habit ${item._isDone ? 'stl-event--habit-done' : ''}`}
              style={{
                top: topPx,
                height,
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 4px)`,
                '--ev-color': item._isDone ? '#39FF14' : '#F97316',
                borderLeft: `3px solid var(--ev-color)`,
                background: item._isDone ? 'rgba(57,255,20,0.08)' : 'rgba(249,115,22,0.08)',
              } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                toggleHabit(item.id);
              }}
            >
              <span className="stl-ev-title">
                {item._isDone ? <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <Flame size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                <EmojiIcon emoji={item.icon || '💪'} size={14} fallbackAsText /> {item.title}
              </span>
              {!isShort && <span className="stl-ev-time" style={{ fontSize: 10, opacity: 0.6 }}>{item._isDone ? 'Completed' : 'Daily habit'}</span>}
            </div>
          );
        }

        // Render events
        const ev = item;
        return (
          <div
            key={ev.id}
            data-event-id={ev.id}
            className={`stl-event ${ev.status === 'completed' ? 'stl-event--completed' : ''} ${isDragging ? 'is-dragging' : ''} ${isTouchDragging ? 'is-touch-dragging' : ''} ${isResizing ? 'is-resizing' : ''} ${isSwiping ? 'is-swiping' : ''} ${isDimmedByLive ? 'is-live-overlap' : ''} ${isSacred ? 'stl-event--sacred' : ''} ${isOps ? 'stl-event--ops' : ''} ${isGoogleEvent ? 'stl-event--google' : ''} ${ev._continuesFromBefore ? 'stl-event--cont-top' : ''} ${ev._continuesAfter ? 'stl-event--cont-bottom' : ''}`}
            draggable={!isGoogleEvent && ev.status !== 'completed'}
            onDragStart={(e) => handleDragStart(e, ev.id)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => {
              handleEventTouchStart(ev);
              handleSwipeStart(e, ev.id);
            }}
            onTouchMove={(e) => {
              handleEventTouchEnd();
              handleSwipeMove(e);
            }}
            onTouchEnd={() => {
              handleEventTouchEnd();
              handleSwipeEnd();
            }}
            style={{
              top: isTouchDragging && touchDragTopPx !== null ? touchDragTopPx : topPx,
              height,
              left: `${leftPct}%`,
              width: `calc(${widthPct}% - 4px)`,
              '--ev-color': ev.color || '#64748B',
              transform: isSwiping && !isTouchDragging ? `translateX(${swipeX}px)` : undefined,
              transition: isSwiping && swipeX === 0 ? 'transform 0.2s ease-out' : undefined,
              zIndex: isTouchDragging ? 100 : undefined,
              opacity: isTouchDragging ? 0.85 : undefined,
              boxShadow: isTouchDragging ? '0 4px 20px rgba(0,0,0,0.3)' : undefined,
            } as React.CSSProperties}
            onClick={(e) => {
              if (!isDragging && !isResizing && !isSwiping && !isTouchDragging && !touchDragJustEnded.current) {
                setDetailEvent(ev);
              }
              e.stopPropagation();
            }}
          >
            {ev._continuesFromBefore && <span className="stl-ev-cont">{'<-'} continues from {localDateStr(new Date(ev.start_time))}</span>}
            <span className="stl-ev-title">{isGoogleEvent ? '📅 ' : ''}{ev.title}</span>
            {!isShort && <span className="stl-ev-time">{timeStr(ev.start_time, use24h)} – {timeStr(ev.end_time, use24h)}</span>}
            {!isShort && ev._continuesAfter && <span className="stl-ev-cont">continues to {localDateStr(new Date(ev.end_time))} →</span>}
            {!isShort && !isGoogleEvent && (() => {
              const evStart = new Date(ev.start_time).getTime();
              const evEnd = new Date(ev.end_time).getTime();
              const nowMs = Date.now();
              const isFocusable = nowMs >= evStart - 15 * 60 * 1000 && nowMs < evEnd;
              return (
                <button
                  className={`stl-ev-play ${isFocusable ? 'stl-ev-play--focus' : ''}`}
                  onClick={(e) => { e.stopPropagation(); startOverlay({ ...ev, description: ev.description ?? undefined, color: ev.color ?? undefined, day_type: ev.day_type ?? undefined }); }}
                  title={isFocusable ? 'Start Focus Mode' : 'Start Event Overlay'}
                >
                  <Play size={10} />
                  {isFocusable && <span className="stl-ev-play-label">Focus</span>}
                </button>
              );
            })()}
            <div
              className="stl-resize-handle"
              onPointerDown={(e) => handleResizeStart(e, ev.id, height)}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onClick={(e) => e.stopPropagation()}
            />
            {isSwiping && swipeX < -20 && (
              <div className="stl-delete-reveal">
                <Trash2 size={16} />
              </div>
            )}
          </div>
        );
      })}

      {/* Sacred Schedule Overlay — spiritual practice blocks */}
      {junctionEquipped && sacredBlocks.length > 0 && sacredBlocks.map((sb: any) => {
        const topPx = ((sb.startMin / 60) - firstHour) * hourH;
        const heightPx = Math.max(((sb.endMin - sb.startMin) / 60) * hourH, 20);
        if (!showAllHours && (sb.startMin / 60 < effectiveStart || sb.startMin / 60 >= WAKE_END)) return null;
        const isFasting = sb.category === 'fasting';
        const isHighLevel = spiritualLevel > 0.5;
        // Note: spiritualLevel is not in scope here, so we pass it down
        // Actually we need it — we use junctionEquipped as a proxy
        return (
          <div
            key={sb.id}
            className={`stl-sacred-block stl-sacred-glow ${isFasting ? 'stl-sacred-fasting' : ''} ${isHighLevel ? 'stl-sacred-visible' : ''}`}
            style={{
              top: topPx,
              height: heightPx,
              left: `${sacredLayout.leftPct}%`,
              width: `${sacredLayout.widthPct}%`,
              '--sacred-opacity': overlayOpacity,
              '--sacred-glow': glowIntensity,
            } as React.CSSProperties}
            title={`${sb.icon} ${sb.name}`}
          >
            <span className="stl-sacred-label">
              <span className="stl-sacred-icon">{sb.icon}</span>
              {sb.name}
            </span>
          </div>
        );
      })}

      {/* Live Event Block — grows from start time to current time */}
      {liveActiveEvent && liveBlock && liveLayout && (() => {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const clampedEndMin = Math.min(liveBlock.endMin, nowMinutes + 1);
        const topPx = Math.max(0, ((liveBlock.startMin / 60) - firstHour) * hourH);
        const bottomPx = ((clampedEndMin / 60) - firstHour) * hourH;
        const heightPx = Math.max(bottomPx - topPx, 48);

        return (
          <>
            <LiveTimelineEvent
              event={liveActiveEvent}
              elapsedSeconds={liveElapsedSeconds}
              metadata={liveMetadata}
              topPx={topPx}
              heightPx={heightPx}
              leftPct={liveLayout.leftPct}
              widthPct={liveLayout.widthPct}
              use24h={use24h}
              onClick={() => {
                setDetailEvent({
                  id: liveActiveEvent.id,
                  title: liveActiveEvent.title,
                  start_time: liveActiveEvent.start_time,
                  end_time: liveActiveEvent.end_time || new Date().toISOString(),
                  color: liveActiveEvent.color,
                  location: liveActiveEvent.location,
                  status: liveActiveEvent.status,
                  is_live: true,
                  metadata: liveActiveEvent.metadata,
                });
              }}
            />
          </>
        );
      })()}
    </div>
  );
}