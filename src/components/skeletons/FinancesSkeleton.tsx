import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function FinancesSkeleton() {
  return (
    <div className="sk-page sk-fin">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLoader variant="title" width="140px" />
        <SkeletonLoader variant="text" width="80px" height={32} />
      </div>

      {/* Tab bar */}
      <div className="sk-fin-tabs">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk sk-fin-tab" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>

      {/* Summary cards */}
      <div className="sk-fin-summary">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="sk sk-fin-summary-card" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>

      {/* Chart */}
      <SkeletonLoader variant="chart" height={200} />

      {/* Transaction list */}
      <div className="sk-fin-transactions">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-fin-tx" style={{ animationDelay: `${i * 60}ms` }}>
            <SkeletonLoader variant="circle" width={32} height={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonLoader variant="text" width={`${50 + (i % 3) * 15}%`} />
              <SkeletonLoader variant="text" width="30%" height={10} />
            </div>
            <SkeletonLoader variant="text" width="60px" height={16} />
          </div>
        ))}
      </div>
    </div>
  );
}
