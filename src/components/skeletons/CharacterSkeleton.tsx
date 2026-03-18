import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';

export function CharacterSkeleton() {
  return (
    <div className="sk-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Character header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <SkeletonLoader variant="circle" width={56} height={56} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLoader variant="title" width="140px" />
          <SkeletonLoader variant="text" width="100px" height={12} />
          {/* XP bar */}
          <div className="sk" style={{ width: '80%', height: 6, borderRadius: 3 }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{
            padding: 14, borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <SkeletonLoader variant="circle" width={28} height={28} />
            <SkeletonLoader variant="text" width="60px" height={10} />
            <SkeletonLoader variant="text" width="40px" height={18} />
          </div>
        ))}
      </div>

      {/* Quest list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLoader variant="text" width="80px" height={14} />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 14,
            background: 'rgba(255,255,255,0.02)', borderRadius: 10,
          }}>
            <div className="sk" style={{
              width: 36, height: 36, borderRadius: 8,
              animationDelay: `${i * 80}ms`,
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLoader variant="text" width={`${60 + i * 10}%`} />
              <SkeletonLoader variant="text" width="40%" height={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
