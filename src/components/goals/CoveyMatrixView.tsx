/**
 * CoveyMatrixView — 2x2 Covey Urgent/Important quadrant grid
 *
 * Visualizes tasks and goals classified by the Covey matrix.
 * Q1=red (crises), Q2=green (strategic), Q3=yellow (interruptions), Q4=gray (prune).
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Target, Bell, Trash2, X } from 'lucide-react';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import {
  getCoveyMatrix,
  getEssentialismInsight,
  getPruningCandidates,
  type CoveyMatrix,
} from '../../lib/covey-matrix';
import type { Task, Goal } from '../../types/database';

// ── QUADRANT CONFIG ──

const QUADRANT_CONFIG = {
  Q1_urgent_important: {
    label: 'Q1: Do First',
    subtitle: 'Urgent + Important',
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.08)',
    border: 'rgba(244, 63, 94, 0.2)',
    icon: AlertTriangle,
  },
  Q2_not_urgent_important: {
    label: 'Q2: Schedule',
    subtitle: 'Not Urgent + Important',
    color: '#39FF14',
    bg: 'rgba(57, 255, 20, 0.06)',
    border: 'rgba(57, 255, 20, 0.2)',
    icon: Target,
  },
  Q3_urgent_not_important: {
    label: 'Q3: Delegate',
    subtitle: 'Urgent + Not Important',
    color: '#EAB308',
    bg: 'rgba(234, 179, 8, 0.06)',
    border: 'rgba(234, 179, 8, 0.2)',
    icon: Bell,
  },
  Q4_not_urgent_not_important: {
    label: 'Q4: Eliminate',
    subtitle: 'Not Urgent + Not Important',
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.06)',
    border: 'rgba(107, 114, 128, 0.2)',
    icon: Trash2,
  },
} as const;

type QuadrantKey = keyof typeof QUADRANT_CONFIG;

function isTask(item: Task | Goal): item is Task {
  return 'status' in item && ('due_date' in item || 'priority' in item) && !('target_date' in item);
}

function getItemTitle(item: Task | Goal): string {
  return item.title || 'Untitled';
}

export function CoveyMatrixView() {
  const goals = useGoalsStore(s => s.goals);
  const tasks = useScheduleStore(s => s.tasks);
  const updateTask = useScheduleStore(s => s.updateTask);
  const [pruning, setPruning] = useState<string | null>(null);

  const matrix = useMemo(() => getCoveyMatrix(tasks, goals), [tasks, goals]);
  const insight = useMemo(() => getEssentialismInsight(matrix), [matrix]);
  const pruneCount = useMemo(() => getPruningCandidates(matrix).length, [matrix]);

  const handlePrune = async (item: Task | Goal) => {
    if (!isTask(item)) return;
    setPruning(item.id);
    try {
      await updateTask(item.id, { status: 'cancelled' as Task['status'] });
    } finally {
      setPruning(null);
    }
  };

  const renderQuadrant = (key: QuadrantKey) => {
    const config = QUADRANT_CONFIG[key];
    const items = matrix[key];
    const Icon = config.icon;

    return (
      <div
        key={key}
        style={{
          background: config.bg,
          border: `1px solid ${config.border}`,
          borderRadius: 10,
          padding: 12,
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Icon size={14} style={{ color: config.color }} />
          <span style={{ color: config.color, fontWeight: 600, fontSize: 13 }}>{config.label}</span>
          <span style={{
            marginLeft: 'auto',
            background: config.border,
            color: '#fff',
            borderRadius: 8,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {items.length}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#8BA4BE', marginBottom: 4 }}>{config.subtitle}</div>

        {items.slice(0, 3).map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              fontSize: 12,
              color: '#CBD5E1',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isTask(item) ? '#00D4FF' : '#D4AF37',
              flexShrink: 0,
            }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getItemTitle(item)}
            </span>
            {key === 'Q4_not_urgent_not_important' && isTask(item) && (
              <button
                onClick={() => handlePrune(item)}
                disabled={pruning === item.id}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6B7280',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: pruning === item.id ? 0.4 : 0.7,
                }}
                title="Cancel this task"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {items.length > 3 && (
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            +{items.length - 3} more
          </div>
        )}
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: '#4B5563', fontStyle: 'italic', marginTop: 4 }}>
            No items
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Insight Banner */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
        fontSize: 13,
        color: '#8BA4BE',
        lineHeight: 1.5,
      }}>
        {insight}
      </div>

      {/* 2x2 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {renderQuadrant('Q1_urgent_important')}
        {renderQuadrant('Q2_not_urgent_important')}
        {renderQuadrant('Q3_urgent_not_important')}
        {renderQuadrant('Q4_not_urgent_not_important')}
      </div>

      {/* Prune summary */}
      {pruneCount > 0 && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: '#6B7280',
          textAlign: 'center',
        }}>
          {pruneCount} item{pruneCount > 1 ? 's' : ''} in Q4 — consider eliminating to focus on what matters
        </div>
      )}
    </div>
  );
}
