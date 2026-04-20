import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function DashboardSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page sk-dash">
      {/* Greeting */}
      <div className="sk-dash-greeting">
        <SkeletonLoader variant="text" width="120px" />
        <SkeletonLoader variant="title" width="220px" />
      </div>

      {/* Quick action row */}
      <div className="sk-dash-actions">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk sk-dash-action" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Week strip */}
      <div className="sk-dash-week">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="sk sk-dash-week-cell" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>

      {/* Stats row */}
      <div className="sk-dash-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-dash-stat" style={{ animationDelay: `${i * 60}ms` }}>
            <SkeletonLoader variant="circle" width={36} height={36} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonLoader variant="text" width="48px" height={18} />
              <SkeletonLoader variant="text" width="64px" height={10} />
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="sk-dash-insights">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk sk-dash-insight" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>

      {/* Widget cards grid */}
      <div className="sk-dash-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-dash-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonLoader variant="circle" width={28} height={28} />
              <SkeletonLoader variant="text" width="50%" />
            </div>
            <SkeletonLoader variant="list" count={3} />
            <SkeletonLoader variant="text" width="100%" height={6} />
          </div>
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
