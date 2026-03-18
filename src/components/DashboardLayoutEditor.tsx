// LifeOS — Dashboard Layout Editor
// Slide-out panel for reordering (drag-and-drop) and toggling dashboard widgets

import { useState, useRef, useCallback } from 'react';
import {
  Eye, EyeOff, RotateCcw, X, GripVertical,
  BarChart3, TrendingUp, CheckCircle2, Clock, Flame,
  Heart, Sparkles, AlertTriangle, DollarSign, BookOpen, Target
} from 'lucide-react';
import type { WidgetConfig } from '../hooks/useDashboardLayout';
import './DashboardLayoutEditor.css';

// Map widget IDs to Lucide icons (matching dashboard card headers)
const WIDGET_ICONS: Record<string, typeof BarChart3> = {
  'stats': BarChart3,
  'insights': TrendingUp,
  'tasks': CheckCircle2,
  'day-summary': Clock,
  'habits': Flame,
  'health': Heart,
  'suggestions': Sparkles,
  'fin-alerts': AlertTriangle,
  'finances': DollarSign,
  'journal': BookOpen,
  'goals': Target,
};

const WIDGET_COLORS: Record<string, string> = {
  'stats': '#00D4FF',
  'insights': '#A855F7',
  'tasks': '#39FF14',
  'day-summary': '#00D4FF',
  'habits': '#F97316',
  'health': '#F43F5E',
  'suggestions': '#FACC15',
  'fin-alerts': '#F43F5E',
  'finances': '#FACC15',
  'journal': '#EC4899',
  'goals': '#39FF14',
};

interface Props {
  widgets: WidgetConfig[];
  open: boolean;
  onClose: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function DashboardLayoutEditor({ widgets, open, onClose, onToggle, onReset, onReorder }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragRef.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image so we see the CSS placeholder
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, 20, 20);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = dragRef.current;
    if (fromIdx !== null && fromIdx !== toIdx && onReorder) {
      onReorder(fromIdx, toIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  }, [onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  }, []);

  if (!open) return null;

  return (
    <div className="dle-overlay" onClick={onClose}>
      <div className="dle-panel" onClick={e => e.stopPropagation()}>
        <div className="dle-header">
          <h3>Customise Dashboard</h3>
          <button className="dle-close" onClick={onClose} aria-label="Close layout editor"><X size={18} /></button>
        </div>
        <p className="dle-hint">Drag to reorder widgets. Toggle visibility with the eye icon.</p>

        <div className="dle-list">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              className={`dle-item ${!w.visible ? 'hidden-widget' : ''} ${dragIdx === i ? 'dragging' : ''} ${overIdx === i && dragIdx !== i ? 'drop-target' : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={e => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
            >
              <span className="dle-drag-handle" title="Drag to reorder">
                <GripVertical size={14} />
              </span>
              <span className="dle-item-icon" style={{ color: WIDGET_COLORS[w.id] || '#8BA4BE' }}>
                {WIDGET_ICONS[w.id] ? (() => { const Icon = WIDGET_ICONS[w.id]; return <Icon size={16} />; })() : w.icon}
              </span>
              <span className="dle-item-label">{w.label}</span>
              <div className="dle-item-actions">
                <button
                  className={`dle-btn dle-toggle ${w.visible ? 'visible' : 'hidden-toggle'}`}
                  onClick={() => onToggle(w.id)}
                  title={w.visible ? 'Hide' : 'Show'}
                >
                  {w.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="dle-reset" onClick={onReset}>
          <RotateCcw size={14} /> Reset to default
        </button>
      </div>
    </div>
  );
}
