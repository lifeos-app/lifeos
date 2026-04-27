/**
 * OverallProgress — Top progress bar showing total lesson completion.
 */

import { getTotalLessonCount, getTotalEstimatedMinutes } from '../../data/academy-manifest';

export function OverallProgress({ completedLessons }: { completedLessons: string[] }) {
  const total = getTotalLessonCount();
  const done = completedLessons.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Overall progress: ${percent}%, ${done} of ${total} lessons`} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)', marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#8BA4BE' }}>Overall Progress</span>
          <span style={{ fontSize: 12, color: '#00D4FF', fontWeight: 600 }}>
            {done}/{total} lessons · {percent}%
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <div style={{
            width: `${percent}%`, height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#5A7A9A', whiteSpace: 'nowrap' }}>
        ~{Math.round(getTotalEstimatedMinutes() / 60)}h total
      </div>
    </div>
  );
}