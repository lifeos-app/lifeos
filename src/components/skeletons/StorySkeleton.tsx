import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function StorySkeleton() {
  return (
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonLoader variant="circle" width={36} height={36} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="120px" />
          <SkeletonLoader variant="text" width="180px" height={12} />
        </div>
      </div>

      {/* Story cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{
            padding: 20, borderRadius: 14,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{
                width: 24, height: 24, borderRadius: 6,
                animationDelay: `${i * 100}ms`,
              }} />
              <SkeletonLoader variant="text" width="60%" />
            </div>
            <SkeletonLoader variant="list" count={3} />
            <SkeletonLoader variant="text" width="30%" height={10} />
          </div>
        ))}
      </div>
    </div>
  );
}
