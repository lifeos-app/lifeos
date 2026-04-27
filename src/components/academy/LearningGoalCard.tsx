/**
 * LearningGoalCard — Compact card for a single learning goal.
 */

import { ArrowRight } from 'lucide-react';
import type { LearningGoal, GoalDomain } from '../../types/academy';

interface LearningGoalCardProps {
  goal: LearningGoal;
  onOpen: (goalId: string) => void;
}

const DOMAIN_EMOJI: Record<GoalDomain, string> = {
  music: '\uD83C\uDFB5',
  language: '\uD83C\uDF0D',
  fitness: '\uD83D\uDCAA',
  business: '\uD83D\uDCBC',
  tech: '\uD83D\uDCBB',
  creative: '\uD83C\uDFA8',
  academic: '\uD83D\uDCDA',
  other: '\u2B50',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#39FF14',
  paused: '#D4AF37',
  completed: '#00D4FF',
  draft: '#8BA4BE',
  archived: '#5A7A9A',
};

export function LearningGoalCard({ goal, onOpen }: LearningGoalCardProps) {
  const phasesTotal = goal.curriculum?.phases.length ?? 0;
  const currentPhase = goal.currentPhaseIndex + 1;

  // Calculate completion
  let totalLessons = 0;
  let completedLessons = 0;
  if (goal.curriculum) {
    for (const phase of goal.curriculum.phases) {
      for (const topic of phase.topics) {
        for (const lesson of topic.lessons) {
          totalLessons++;
          if (lesson.completedAt) completedLessons++;
        }
      }
    }
  }

  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onClick={() => onOpen(goal.id)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{DOMAIN_EMOJI[goal.domain]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            {goal.topic}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px',
              borderRadius: 6, background: `${STATUS_COLORS[goal.status] || '#8BA4BE'}15`,
              color: STATUS_COLORS[goal.status] || '#8BA4BE',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {goal.status}
            </span>
            {phasesTotal > 0 && (
              <span style={{ fontSize: 11, color: '#8BA4BE' }}>
                Phase {currentPhase} of {phasesTotal}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#5A7A9A' }}>
            {completedLessons}/{totalLessons} lessons
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#00D4FF' }}>
            {percent}%
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{
            width: `${percent}%`, height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, color: '#8BA4BE', padding: '3px 8px',
          background: 'rgba(255,255,255,0.04)', borderRadius: 6,
        }}>
          {goal.weeklyTargetLessons} lessons/week
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(goal.id); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8, border: 'none',
            background: 'rgba(0,212,255,0.1)', color: '#00D4FF',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Continue <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
