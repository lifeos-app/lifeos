import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function GoalsSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page sk-goals">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkeletonLoader variant="circle" width={36} height={36} />
          <SkeletonLoader variant="title" width="80px" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonLoader variant="card" width={90} height={36} />
          <SkeletonLoader variant="card" width={90} height={36} />
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonLoader key={i} variant="text" width="80px" height={32} />
        ))}
      </div>

      {/* Goal cards with progress bars */}
      <div className="sk-goals-cards">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-goal-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SkeletonLoader variant="circle" width={36} height={36} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonLoader variant="text" width={`${45 + i * 10}%`} />
                <SkeletonLoader variant="text" width="30%" height={10} />
              </div>
              <SkeletonLoader variant="text" width="40px" height={20} />
            </div>
            <div className="sk sk-goal-bar" style={{ animationDelay: `${i * 100 + 50}ms` }} />
            {/* Sub-items */}
            {i < 2 && (
              <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 2 }, (_, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SkeletonLoader variant="circle" width={20} height={20} />
                    <SkeletonLoader variant="text" width={`${50 + j * 20}%`} height={12} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
