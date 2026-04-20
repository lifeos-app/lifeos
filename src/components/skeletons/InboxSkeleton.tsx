import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function InboxSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkeletonLoader variant="circle" width={32} height={32} />
          <SkeletonLoader variant="title" width="80px" />
        </div>
        <div className="sk" style={{ width: 80, height: 32, borderRadius: 8 }} />
      </div>

      {/* Inbox items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div className="sk" style={{
              width: 8, height: 8, borderRadius: '50%',
              animationDelay: `${i * 60}ms`,
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLoader variant="text" width={`${55 + i * 7}%`} />
              <SkeletonLoader variant="text" width="35%" height={10} />
            </div>
            <div className="sk" style={{ width: 48, height: 24, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
    </Shimmer>
  );
}
