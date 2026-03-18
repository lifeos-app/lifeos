/**
 * LiveActivityCard — Prominent live event card for the Event Drawer
 *
 * Shows at the top of the drawer when there's an active live session.
 * Displays: title, elapsed time, start time, metadata chips, STOP button.
 * Metadata quick-add: odometer, income, note.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Square, Clock, MapPin, DollarSign, Gauge,
  StickyNote, Plus, X, ChevronDown, ChevronUp,
  Activity, Dumbbell, BookOpen,
} from 'lucide-react';
import { useLiveActivityStore, type LiveEventMetadata, type LiveEvent } from '../stores/useLiveActivityStore';
import './LiveActivityCard.css';

// ─── Helpers ────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Metadata Chips ─────────────────────────────────

function MetadataChips({ metadata }: { metadata: LiveEventMetadata }) {
  const chips: Array<{ icon: React.ReactNode; label: string; color: string }> = [];

  if (metadata.odometer_start) {
    chips.push({
      icon: <Gauge size={10} />,
      label: `Odo start: ${Number(metadata.odometer_start).toLocaleString()}`,
      color: '#3B82F6',
    });
  }
  if (metadata.odometer_end) {
    chips.push({
      icon: <Gauge size={10} />,
      label: `Odo end: ${Number(metadata.odometer_end).toLocaleString()}`,
      color: '#3B82F6',
    });
  }
  if (metadata.odometer_start && metadata.odometer_end) {
    const km = (metadata.odometer_end as number) - (metadata.odometer_start as number);
    if (km > 0) {
      chips.push({
        icon: <MapPin size={10} />,
        label: `${km} km`,
        color: '#10B981',
      });
    }
  }
  if (metadata.expected_income) {
    chips.push({
      icon: <DollarSign size={10} />,
      label: `Expected: $${metadata.expected_income}`,
      color: '#F59E0B',
    });
  }
  if (metadata.actual_income) {
    chips.push({
      icon: <DollarSign size={10} />,
      label: `Actual: $${metadata.actual_income}`,
      color: '#10B981',
    });
  }
  if (metadata.mood) {
    chips.push({
      icon: <Activity size={10} />,
      label: `Mood: ${metadata.mood}`,
      color: '#A855F7',
    });
  }
  if (metadata.location) {
    chips.push({
      icon: <MapPin size={10} />,
      label: String(metadata.location),
      color: '#64748B',
    });
  }

  if (!chips.length) return null;

  return (
    <div className="lac-chips">
      {chips.map((chip, i) => (
        <span key={i} className="lac-chip" style={{ '--chip-color': chip.color } as React.CSSProperties}>
          {chip.icon}
          <span>{chip.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Notes Display ──────────────────────────────────

function NotesDisplay({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <div className="lac-notes">
      {notes.map((note, i) => (
        <div key={i} className="lac-note">
          <StickyNote size={10} />
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Add Modal ────────────────────────────────

type QuickAddType = 'odometer' | 'income' | 'note' | null;

function QuickAddPanel({
  type,
  onClose,
  onSubmit,
}: {
  type: QuickAddType;
  onClose: () => void;
  onSubmit: (key: string, value: unknown) => void;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim()) return;

    switch (type) {
      case 'odometer': {
        const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
        if (isNaN(num)) return;
        // Determine if it's start or end based on existing metadata
        const meta = useLiveActivityStore.getState().metadata;
        const key = meta.odometer_start ? 'odometer_end' : 'odometer_start';
        onSubmit(key, num);
        break;
      }
      case 'income': {
        const amt = parseFloat(value.replace(/[^0-9.]/g, ''));
        if (isNaN(amt)) return;
        onSubmit('expected_income', amt);
        break;
      }
      case 'note':
        onSubmit('notes', value.trim());
        break;
    }
    setValue('');
    onClose();
  };

  if (!type) return null;

  const labels: Record<string, { title: string; placeholder: string; inputType: string }> = {
    odometer: { title: 'Odometer Reading', placeholder: 'e.g. 226735', inputType: 'number' },
    income: { title: 'Expected Income', placeholder: 'e.g. 150', inputType: 'number' },
    note: { title: 'Add Note', placeholder: 'What happened?', inputType: 'text' },
  };

  const config = labels[type];

  return (
    <div className="lac-quick-add">
      <div className="lac-qa-header">
        <span className="lac-qa-title">{config.title}</span>
        <button className="lac-qa-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div className="lac-qa-body">
        <input
          className="lac-qa-input"
          type={config.inputType}
          placeholder={config.placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        <button className="lac-qa-submit" onClick={handleSubmit}>Add</button>
      </div>
    </div>
  );
}

// ─── Context-Aware Button Renderer ─────────────────

function detectCategory(event: LiveEvent | null): string {
  if (!event) return 'generic';
  const title = event.title.toLowerCase();
  const cat = (event.category || '').toLowerCase();
  
  // Work/Cleaning
  if (cat.includes('work') || cat.includes('clean') || title.includes('clean') || title.includes('security')) return 'work';
  
  // Driving
  if (title.includes('driv') || title.includes('commut') || cat === 'travel') return 'driving';
  
  // Health/Workout
  if (cat === 'health' || cat === 'workout' || title.includes('gym') || title.includes('workout') || title.includes('exercise') || title.includes('run')) return 'health';
  
  // Education/Reading
  if (cat === 'education' || cat === 'reading' || title.includes('read') || title.includes('study') || title.includes('book')) return 'education';
  
  return 'generic';
}

function renderContextButtons(
  event: LiveEvent | null,
  quickAddType: QuickAddType,
  setQuickAddType: (type: QuickAddType) => void
) {
  if (!event) return null;
  
  const category = detectCategory(event);
  const buttons = [];
  
  switch (category) {
    case 'work':
      // Work/cleaning: Odometer, Income, Note, Location
      buttons.push(
        <button key="odometer" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'odometer' ? null : 'odometer')} title="Add odometer">
          <Gauge size={13} /><span>Odometer</span>
        </button>,
        <button key="income" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'income' ? null : 'income')} title="Add income">
          <DollarSign size={13} /><span>Income</span>
        </button>,
        <button key="location" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <MapPin size={13} /><span>Location</span>
        </button>,
        <button key="note" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <StickyNote size={13} /><span>Note</span>
        </button>
      );
      break;
      
    case 'driving':
      // Driving: Odometer, Fuel Cost, Note
      buttons.push(
        <button key="odometer" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'odometer' ? null : 'odometer')} title="Add odometer">
          <Gauge size={13} /><span>Odometer</span>
        </button>,
        <button key="fuel" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'income' ? null : 'income')} title="Add fuel cost">
          <DollarSign size={13} /><span>Fuel Cost</span>
        </button>,
        <button key="note" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <StickyNote size={13} /><span>Note</span>
        </button>
      );
      break;
      
    case 'health':
      // Health/workout: Sets, Weight, Note
      buttons.push(
        <button key="sets" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Log sets">
          <Dumbbell size={13} /><span>Sets</span>
        </button>,
        <button key="weight" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Log weight">
          <Activity size={13} /><span>Weight</span>
        </button>,
        <button key="note" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <StickyNote size={13} /><span>Note</span>
        </button>
      );
      break;
      
    case 'education':
      // Education/reading: Pages, Note
      buttons.push(
        <button key="pages" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Log pages">
          <BookOpen size={13} /><span>Pages</span>
        </button>,
        <button key="note" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <StickyNote size={13} /><span>Note</span>
        </button>
      );
      break;
      
    default:
      // Generic: Note only
      buttons.push(
        <button key="note" className="lac-action-btn" onClick={() => setQuickAddType(quickAddType === 'note' ? null : 'note')} title="Add note">
          <StickyNote size={13} /><span>Note</span>
        </button>
      );
  }
  
  return buttons;
}

// ─── Main Component ─────────────────────────────────

export function LiveActivityCard() {
  const activeEvent = useLiveActivityStore(s => s.activeEvent);
  const elapsedSeconds = useLiveActivityStore(s => s.elapsedSeconds);
  const metadata = useLiveActivityStore(s => s.metadata);
  const stopActivity = useLiveActivityStore(s => s.stopActivity);
  const updateMetadata = useLiveActivityStore(s => s.updateMetadata);

  const [stopping, setStopping] = useState(false);
  const [quickAddType, setQuickAddType] = useState<QuickAddType>(null);
  const [expanded, setExpanded] = useState(true);

  // Pulse animation for the live dot
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1000);
    return () => clearInterval(id);
  }, []);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      await stopActivity();
    } finally {
      setStopping(false);
    }
  }, [stopActivity]);

  const handleQuickAdd = useCallback((key: string, value: unknown) => {
    updateMetadata(key, value);
  }, [updateMetadata]);

  if (!activeEvent) return null;

  return (
    <div className="lac-container">
      {/* Header bar */}
      <div className="lac-header" onClick={() => setExpanded(e => !e)}>
        <div className="lac-header-left">
          <span className={`lac-live-dot ${pulse ? 'lac-live-dot--on' : ''}`} />
          <span className="lac-live-badge">LIVE</span>
          <span className="lac-title">{activeEvent.title}</span>
        </div>
        <div className="lac-header-right">
          <span className="lac-elapsed">{formatElapsed(elapsedSeconds)}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="lac-body">
          {/* Time info */}
          <div className="lac-time-row">
            <Clock size={12} />
            <span>Started {formatTime(activeEvent.start_time)}</span>
          </div>

          {/* Metadata chips */}
          <MetadataChips metadata={metadata} />

          {/* Notes */}
          <NotesDisplay notes={metadata.notes} />

          {/* Quick-add buttons - context-aware based on event category */}
          <div className="lac-actions">
            {renderContextButtons(activeEvent, quickAddType, setQuickAddType)}
          </div>

          {/* Quick add panel */}
          <QuickAddPanel
            type={quickAddType}
            onClose={() => setQuickAddType(null)}
            onSubmit={handleQuickAdd}
          />

          {/* STOP button */}
          <button
            className="lac-stop-btn"
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? (
              <span>Stopping…</span>
            ) : (
              <>
                <Square size={14} fill="currentColor" />
                <span>STOP</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
