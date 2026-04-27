/**
 * DashboardAcademy — Today's lesson widget for the Dashboard.
 *
 * Shows the next scheduled lesson, study streak status, or nothing
 * if no active learning goals exist.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Flame } from 'lucide-react';
import { useAcademyStore } from '../../stores/useAcademyStore';

export const DashboardAcademy = React.memo(function DashboardAcademy() {
  const navigate = useNavigate();
  const { studyStreak, completedLessons, currentLesson } = useAcademyStore();

  // Academy store exists but does not yet have learning_goals with curriculum.
  // This widget provides a bridge: it shows study streak and current lesson info
  // from the existing academy store until the Phase 1 learning_goals table is wired.

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const hour = new Date().getHours();

  // Determine priority — higher in morning/afternoon
  const isActiveTime = hour >= 6 && hour < 18;

  // If there is a current lesson set, show it
  if (currentLesson) {
    return (
      <section className="dash-card" style={{ borderLeft: '3px solid #D4AF37' }}>
        <div className="card-top">
          <h2><BookOpen size={16} color="#D4AF37" /> Academy</h2>
          <button
            onClick={() => navigate('/academy')}
            className="card-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}
          >
            Open <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ padding: '8px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 8,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(212,175,55,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={18} color="#D4AF37" />
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600, margin: 0 }}>
                Today's Lesson
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>
                {completedLessons.length} lessons completed
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/academy')}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
              background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <BookOpen size={14} /> Study Now
          </button>
        </div>
      </section>
    );
  }

  // If no current lesson but has study streak, show streak nudge
  if (studyStreak > 0 && completedLessons.length > 0) {
    return (
      <section className="dash-card" style={{ borderLeft: '3px solid #F97316' }}>
        <div className="card-top">
          <h2><BookOpen size={16} color="#D4AF37" /> Academy</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <Flame size={20} color="#F97316" />
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>
              Study streak at risk
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
              {studyStreak}-day streak &middot; Keep it going!
            </p>
          </div>
          <button
            onClick={() => navigate('/academy')}
            style={{
              marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none',
              background: 'rgba(249,115,22,0.12)', color: '#F97316',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Study
          </button>
        </div>
      </section>
    );
  }

  // No active goals — render nothing
  return null;
});
