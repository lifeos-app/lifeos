import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function ReflectSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonLoader variant="circle" width={36} height={36} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="100px" />
          <SkeletonLoader variant="text" width="240px" height={12} />
        </div>
      </div>

      {/* Tab icons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk" style={{
            width: 48, height: 48, borderRadius: 12,
            animationDelay: `${i * 60}ms`,
          }} />
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 14,
            background: 'rgba(255,255,255,0.02)', borderRadius: 12,
          }}>
            <SkeletonLoader variant="circle" width={32} height={32} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonLoader variant="text" width="50px" height={10} />
              <SkeletonLoader variant="text" width="40px" height={16} />
            </div>
          </div>
        ))}
      </div>

      {/* Hub cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonLoader key={i} variant="card" height={140} />
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
