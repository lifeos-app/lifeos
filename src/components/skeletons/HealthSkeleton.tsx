import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function HealthSkeleton() {
  return (
    <div className="sk-page sk-health">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <SkeletonLoader variant="circle" width={44} height={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="100px" />
          <SkeletonLoader variant="text" width="180px" height={12} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="sk-health-tabs">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk sk-health-tab" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Metric cards */}
      <div className="sk-health-metrics">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk sk-health-metric" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>

      {/* Chart area */}
      <SkeletonLoader variant="chart" height={200} />

      {/* Additional list */}
      <SkeletonLoader variant="list" count={4} />
    </div>
  );
}
