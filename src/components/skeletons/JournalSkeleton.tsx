import { SkeletonLoader } from '../ui/SkeletonLoader';
import '../ui/SkeletonLoader.css';
import { Shimmer } from './Shimmer';

export function JournalSkeleton() {
  return (
    <Shimmer>
    <div className="sk-page sk-journal">
      {/* Entry list sidebar */}
      <div className="sk-journal-sidebar">
        <SkeletonLoader variant="title" width="80px" />
        <SkeletonLoader variant="text" width="100%" height={36} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk sk-journal-entry-item" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Editor area */}
      <div className="sk-journal-editor">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonLoader variant="title" width="160px" />
          <div style={{ display: 'flex', gap: 8 }}>
            <SkeletonLoader variant="text" width="60px" height={28} />
            <SkeletonLoader variant="text" width="60px" height={28} />
          </div>
        </div>

        {/* Mood / energy selectors */}
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonLoader key={i} variant="circle" width={36} height={36} />
          ))}
        </div>

        {/* Title input */}
        <SkeletonLoader variant="text" width="100%" height={40} />

        {/* Editor body */}
        <div className="sk sk-journal-editor-area" />

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonLoader key={i} variant="text" width={`${60 + i * 10}px`} height={26} />
          ))}
        </div>
      </div>
    </div>
    </Shimmer>
  );
}
