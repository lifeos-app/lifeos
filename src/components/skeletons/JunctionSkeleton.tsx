import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function JunctionSkeleton() {
  return (
    <div className="sk-page sk-junction">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonLoader variant="circle" width={44} height={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="120px" />
          <SkeletonLoader variant="text" width="200px" height={12} />
        </div>
      </div>

      {/* Equipped tradition banner */}
      <SkeletonLoader variant="card" width="100%" height={80} />

      {/* Tradition cards grid */}
      <div className="sk-junction-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-junction-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SkeletonLoader variant="circle" width={48} height={48} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonLoader variant="text" width="70%" />
                <SkeletonLoader variant="text" width="40%" height={10} />
              </div>
            </div>
            <SkeletonLoader variant="list" count={3} />
            <SkeletonLoader variant="text" width="100%" height={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
