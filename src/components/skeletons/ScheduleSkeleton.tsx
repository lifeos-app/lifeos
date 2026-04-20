import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function ScheduleSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page sk-sched">
      {/* Header */}
      <div className="sk-sched-header">
        <SkeletonLoader variant="title" width="200px" height={28} />
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonLoader variant="card" width={80} height={36} />
          <SkeletonLoader variant="card" width={120} height={36} />
        </div>
      </div>

      {/* Summary card */}
      <div className="sk sk-card" style={{ height: 60 }} />

      {/* Day context pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonLoader key={i} variant="text" width={`${80 + i * 15}px`} height={28} />
        ))}
      </div>

      {/* Timeline hours */}
      <div className="sk-sched-timeline">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="sk-sched-hour" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="sk sk-sched-hour-label" style={{ animationDelay: `${i * 40}ms` }} />
            <div className="sk-sched-hour-line" />
          </div>
        ))}
      </div>

      {/* Event blocks overlaying timeline */}
      <div className="sk-sched-events">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="sk-sched-event" style={{ animationDelay: `${i * 100}ms` }}>
            <SkeletonLoader variant="text" width="50px" height={12} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonLoader variant="text" width={`${50 + i * 15}%`} />
              <SkeletonLoader variant="text" width="30%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
