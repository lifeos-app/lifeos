import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function PageSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonLoader variant="circle" width={40} height={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="140px" />
          <SkeletonLoader variant="text" width="220px" height={12} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SkeletonLoader variant="card" height={120} />
        <SkeletonLoader variant="card" height={120} />
        <SkeletonLoader variant="card" height={120} />
        <SkeletonLoader variant="card" height={120} />
      </div>
      <SkeletonLoader variant="list" count={4} />
    </div>
    </Shimmer>
  );
}
