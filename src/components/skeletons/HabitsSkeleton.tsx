import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function HabitsSkeleton() {
  return (
    <div className="sk-page sk-habits">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkeletonLoader variant="circle" width={36} height={36} />
          <SkeletonLoader variant="title" width="100px" />
        </div>
        <SkeletonLoader variant="card" width={90} height={36} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonLoader key={i} variant="card" width="100%" height={70} />
        ))}
      </div>

      {/* Habit cards grid */}
      <div className="sk-habits-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk-habit-card" style={{ animationDelay: `${i * 80}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonLoader variant="circle" width={32} height={32} />
              <SkeletonLoader variant="text" width="60%" />
            </div>
            {/* Mini week dots */}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              {Array.from({ length: 7 }, (_, j) => (
                <SkeletonLoader key={j} variant="circle" width={20} height={20} />
              ))}
            </div>
            <SkeletonLoader variant="text" width="100%" height={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
