/**
 * DashboardGoals — Goals progress widget for the Dashboard.
 */

import React, { Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, ChevronRight } from 'lucide-react';

const MiniCharacter = lazy(() => import('../../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import { EmojiIcon } from '../../lib/emoji-icon';
import type { GoalNode } from '../../stores/useGoalsStore';

interface DashboardGoalsProps {
  goals: GoalNode[];
}

export const DashboardGoals = React.memo(function DashboardGoals({ goals }: DashboardGoalsProps) {
  const navigate = useNavigate();
  const activeGoals = goals.filter((g) => g.category === 'goal' || !g.category);

  return (
    <section className="dash-card">
      <div className="card-top">
        <h2><Target size={16} /> Goals <Suspense fallback={null}><MiniCharacter size={24} fps={10} /></Suspense></h2>
        <Link to="/goals" className="card-link">View all <ChevronRight size={14} /></Link>
      </div>
      {activeGoals.length === 0 ? (
        <div className="card-empty"><p>No goals yet</p></div>
      ) : (
        <div className="dash-goals">
          {activeGoals.slice(0, 4).map((g) => {
            const pct = Math.round((g.progress || 0) * 100);
            return (
              <div key={g.id} className="dash-goal-row clickable" onClick={() => navigate('/goals')}>
                <span className="dash-goal-icon"><EmojiIcon emoji={g.icon || '🎯'} size={18} fallbackAsText /></span>
                <div className="dash-goal-info">
                  <span className="dash-goal-name">{g.title}</span>
                  <div className="dash-goal-bar"><div className="dash-goal-fill progress-smooth" style={{ width: `${pct}%`, background: g.color || '#00D4FF' }} /></div>
                </div>
                <span className="dash-goal-pct" style={{ color: g.color || '#00D4FF' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});
