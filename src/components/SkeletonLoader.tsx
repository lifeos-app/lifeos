import './SkeletonLoader.css';

interface SkeletonLoaderProps {
  variant?: 'dashboard' | 'cards' | 'list' | 'page' | 'inline';
  count?: number;
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div className="skel-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="skel-card-header">
        <div className="skeleton skeleton-avatar" />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: '40%', height: 10 }} />
        </div>
      </div>
      <div className="skel-card-body">
        <div className="skeleton skeleton-text" style={{ width: '100%', marginBottom: 6 }} />
        <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: 6 }} />
        <div className="skeleton skeleton-text" style={{ width: '90%' }} />
      </div>
      <div className="skel-card-bar">
        <div className="skeleton" style={{ height: 6, borderRadius: 3, width: '100%' }} />
      </div>
    </div>
  );
}

function SkeletonStat({ delay = 0 }: { delay?: number }) {
  return (
    <div className="skel-stat" style={{ animationDelay: `${delay}ms` }}>
      <div className="skeleton skeleton-avatar" style={{ width: 36, height: 36 }} />
      <div>
        <div className="skeleton skeleton-text" style={{ width: 48, height: 20, marginBottom: 4 }} />
        <div className="skeleton skeleton-text" style={{ width: 64, height: 10 }} />
      </div>
    </div>
  );
}

export function SkeletonLoader({ variant = 'dashboard', count = 4 }: SkeletonLoaderProps) {
  if (variant === 'inline') {
    return (
      <div className="skel-inline">
        <div className="skeleton skeleton-text" style={{ width: '100%', marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '75%', marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="skel-list">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skel-list-item" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: `${70 + Math.random() * 30}%` }} />
            </div>
            <div className="skeleton" style={{ width: 48, height: 20, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="skel-grid">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} delay={i * 80} />
        ))}
      </div>
    );
  }

  // Dashboard variant
  return (
    <div className="skel-dashboard animate-fade-in">
      {/* Header */}
      <div className="skel-header">
        <div>
          <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 8 }} />
          <div className="skeleton skeleton-heading" style={{ width: 200 }} />
        </div>
        <div className="skeleton" style={{ width: 200, height: 40, borderRadius: 10 }} />
      </div>

      {/* Week strip */}
      <div className="skel-week-strip">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton" style={{ width: '100%', height: 52, borderRadius: 10 }} />
        ))}
      </div>

      {/* Stats */}
      <div className="skel-stats-row">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStat key={i} delay={i * 60} />
        ))}
      </div>

      {/* Insights */}
      <div className="skel-insights">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton skel-insight" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>

      {/* Grid cards */}
      <div className="skel-grid-2col">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} delay={i * 100} />
        ))}
      </div>
    </div>
  );
}
