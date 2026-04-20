import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function SocialSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <SkeletonLoader variant="circle" width={40} height={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="120px" />
          <SkeletonLoader variant="text" width="200px" height={12} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk" style={{
            width: 60, height: 32, borderRadius: 8,
            animationDelay: `${i * 60}ms`,
          }} />
        ))}
      </div>

      {/* Friend cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
            <SkeletonLoader variant="circle" width={44} height={44} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLoader variant="text" width={`${50 + i * 10}%`} />
              <SkeletonLoader variant="text" width="40%" height={10} />
            </div>
            <div className="sk" style={{ width: 64, height: 28, borderRadius: 6, animationDelay: `${i * 80}ms` }} />
          </div>
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
