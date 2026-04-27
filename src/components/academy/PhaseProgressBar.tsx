/**
 * PhaseProgressBar — dot-based lesson progress indicator
 *
 * Each dot = one lesson. Completed = gold, current = pulsing accent, future = dim gray.
 * Thin fill line underneath shows percentage complete.
 */

interface PhaseProgressBarProps {
  totalLessons: number;
  completedCount: number;
  currentLessonIndex: number;
}

export function PhaseProgressBar({ totalLessons, completedCount, currentLessonIndex }: PhaseProgressBarProps) {
  if (totalLessons <= 0) return null;

  const percent = Math.round((completedCount / totalLessons) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Dots */}
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {Array.from({ length: totalLessons }, (_, i) => {
          const isCompleted = i < completedCount;
          const isCurrent = i === currentLessonIndex;

          return (
            <div
              key={i}
              style={{
                width: isCurrent ? 10 : 8,
                height: isCurrent ? 10 : 8,
                borderRadius: '50%',
                background: isCompleted
                  ? '#D4AF37'
                  : isCurrent
                    ? '#00D4FF'
                    : 'rgba(255,255,255,0.12)',
                boxShadow: isCurrent
                  ? '0 0 8px rgba(0,212,255,0.5)'
                  : isCompleted
                    ? '0 0 4px rgba(212,175,55,0.3)'
                    : 'none',
                transition: 'all 0.2s ease',
                animation: isCurrent ? 'tutorDotPulse 2s ease-in-out infinite' : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Fill line */}
      <div style={{
        height: 3,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 2,
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: 2,
          background: 'linear-gradient(90deg, #D4AF37, #00D4FF)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Pulse keyframes */}
      <style>{`
        @keyframes tutorDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
