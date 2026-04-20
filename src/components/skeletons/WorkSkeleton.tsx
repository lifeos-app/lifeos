import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function WorkSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonLoader variant="circle" width={44} height={44} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonLoader variant="title" width="80px" />
            <SkeletonLoader variant="text" width="160px" height={11} />
          </div>
        </div>
        <div className="sk" style={{ width: 90, height: 34, borderRadius: 8 }} />
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 140, padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.02)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div className="sk" style={{ width: 32, height: 32, borderRadius: 8, animationDelay: `${i * 80}ms` }} />
            <SkeletonLoader variant="text" width="60px" height={10} />
            <SkeletonLoader variant="text" width="80px" height={24} />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <SkeletonLoader variant="card" height={200} />
        <SkeletonLoader variant="card" height={200} />
      </div>

      {/* History */}
      <SkeletonLoader variant="text" width="120px" height={16} />
      <SkeletonLoader variant="list" count={4} />
    </div>
    </Shimmer>
  );
}
