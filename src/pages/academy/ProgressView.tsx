/**
 * ProgressView — Stats cards and phase breakdown for Academy progress.
 */

import { BookOpen, Flame, Clock, Zap, Trophy, Award } from 'lucide-react';
import { PHASES, getTotalLessonCount } from '../../data/academy-manifest';

export function ProgressView({ completedLessons, studyStreak, totalStudyTime }: {
  completedLessons: string[]; studyStreak: number; totalStudyTime: number;
}) {
  const total = getTotalLessonCount();
  const done = completedLessons.length;
  const xpEarned = done * 10;

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Stats Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        <StatCard icon={<BookOpen size={18} />} label="Lessons Completed" value={`${done}/${total}`} color="#00D4FF" />
        <StatCard icon={<Flame size={18} />} label="Study Streak" value={`${studyStreak} days`} color="#F97316" />
        <StatCard icon={<Clock size={18} />} label="Time Studied" value={`${Math.round(totalStudyTime / 60)}h ${totalStudyTime % 60}m`} color="#A855F7" />
        <StatCard icon={<Zap size={18} />} label="XP Earned" value={`${xpEarned} XP`} color="#FACC15" />
        <StatCard icon={<Trophy size={18} />} label="Completion" value={`${total > 0 ? Math.round((done / total) * 100) : 0}%`} color="#39FF14" />
        <StatCard icon={<Award size={18} />} label="Phases Done" value={`${PHASES.filter(p => p.topics.flatMap(t => t.lessons).every(l => completedLessons.includes(l.id))).length}/6`} color="#D4AF37" />
      </div>

      {/* Phase Breakdown */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
        Phase Progress
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHASES.map(phase => {
          const phaseLessons = phase.topics.flatMap(t => t.lessons);
          const phaseDone = phaseLessons.filter(l => completedLessons.includes(l.id)).length;
          const phaseTotal = phaseLessons.length;
          const phasePercent = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

          return (
            <div key={phase.id} style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#E0E0E0' }}>
                  {phase.icon} {phase.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: phase.color }}>
                  {phaseDone}/{phaseTotal} · {phasePercent}%
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{
                  width: `${phasePercent}%`, height: '100%', borderRadius: 3,
                  background: phase.gradient,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: `linear-gradient(135deg, ${color}08, ${color}04)`,
      border: `1px solid ${color}20`,
    }}>
      <div style={{ color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8BA4BE' }}>{label}</div>
    </div>
  );
}