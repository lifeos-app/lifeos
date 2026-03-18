import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function EventDrawerSkeleton() {
  return (
    <div className="sk-drawer">
      {/* Header with time + close */}
      <div className="sk-drawer-header">
        <SkeletonLoader variant="circle" width={36} height={36} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="140px" />
          <SkeletonLoader variant="text" width="100px" height={12} />
        </div>
      </div>

      {/* Status badge row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <SkeletonLoader variant="text" width="80px" height={26} />
        <SkeletonLoader variant="text" width="60px" height={26} />
      </div>

      {/* Content blocks */}
      <div className="sk-drawer-content">
        <SkeletonLoader variant="card" height={80} />
        <SkeletonLoader variant="list" count={3} />
        <SkeletonLoader variant="card" height={60} />
      </div>
    </div>
  );
}
