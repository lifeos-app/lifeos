import { useState, lazy, Suspense } from 'react';
import { useLessonsStore } from '../stores/useLessonsStore';
import { PageSkeleton } from '../components/skeletons';
import { Music, Lock, ArrowLeft, ExternalLink } from 'lucide-react';

const PianoAcademy = lazy(() => import('../components/lessons/PianoAcademy'));

interface LessonCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  component: 'piano-academy';
  badge?: string;
  locked?: boolean;
}

const LESSON_CATALOG: LessonCard[] = [
  {
    id: 'piano-academy',
    title: 'Piano Academy',
    description: 'Learn piano from zero — notes, chords, scales, reading music, and musical comedy. An interactive Web Audio piano with 8 lessons.',
    icon: '\u{1F3B9}',
    color: '#FFD700',
    component: 'piano-academy',
    badge: 'OPEN SOURCE',
  },
  {
    id: 'guitar-101',
    title: 'Guitar 101',
    description: 'Strum your first chords, learn fingerpicking patterns, and play campfire songs.',
    icon: '\u{1F3B8}',
    color: '#E8A87C',
    component: 'piano-academy', // placeholder
    locked: true,
  },
  {
    id: 'music-production',
    title: 'Beat Lab',
    description: 'Create beats, loops, and tracks using the Web Audio API. From drum patterns to full arrangements.',
    icon: '\u{1F3A7}',
    color: '#A855F7',
    component: 'piano-academy', // placeholder
    locked: true,
  },
  {
    id: 'code-music',
    title: 'Code & Music',
    description: 'The JSX source behind Piano Academy IS the lesson. Learn React hooks, Web Audio, and state management by reading real code.',
    icon: '\u{1F4BB}',
    color: '#00D4FF',
    component: 'piano-academy', // placeholder
    locked: true,
  },
];

export default function TeddysLessons() {
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const { completeStep, getCompletedSteps } = useLessonsStore();

  const activeLessonData = LESSON_CATALOG.find(l => l.id === activeLesson);

  const handleStepComplete = (stepId: string) => {
    if (activeLesson) {
      completeStep(activeLesson, stepId);
    }
  };

  // Active lesson view
  if (activeLesson && activeLessonData && !activeLessonData.locked) {
    const completedSteps = getCompletedSteps(activeLesson);
    return (
      <div style={{ minHeight: '100%' }}>
        {/* Back bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,37,64,0.5)',
        }}>
          <button
            onClick={() => setActiveLesson(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', color: '#8BA4BE',
              cursor: 'pointer', fontSize: 14, padding: '4px 8px',
            }}
          >
            <ArrowLeft size={16} /> Back to Lessons
          </button>
          <span style={{ color: '#FFD700', fontWeight: 600, fontSize: 14 }}>
            {activeLessonData.icon} {activeLessonData.title}
          </span>
          {completedSteps.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5A7A9A' }}>
              {completedSteps.length} steps completed
            </span>
          )}
        </div>

        <Suspense fallback={<PageSkeleton />}>
          {activeLessonData.component === 'piano-academy' && (
            <PianoAcademy
              onStepComplete={handleStepComplete}
              completedSteps={completedSteps}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // Catalog view
  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Music size={28} color="#FFD700" />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>
            Teddy's Lessons
          </h1>
        </div>
        <p style={{ fontSize: 15, color: '#8BA4BE', margin: 0, lineHeight: 1.6 }}>
          Premium educational content for the TCS next-gen program.
          <br />
          <span style={{ color: '#5A7A9A', fontSize: 13, fontStyle: 'italic' }}>
            Complete your lessons or get expelled from TCS.
          </span>
        </p>
      </div>

      {/* Lesson Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {LESSON_CATALOG.map(lesson => {
          const completedSteps = getCompletedSteps(lesson.id);
          const hasProgress = completedSteps.length > 0;

          return (
            <div
              key={lesson.id}
              onClick={() => !lesson.locked && setActiveLesson(lesson.id)}
              style={{
                background: lesson.locked
                  ? 'rgba(255,255,255,0.02)'
                  : 'linear-gradient(135deg, rgba(15,45,74,0.8), rgba(10,37,64,0.6))',
                border: `1px solid ${lesson.locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                padding: 24,
                cursor: lesson.locked ? 'default' : 'pointer',
                transition: 'all 0.2s',
                opacity: lesson.locked ? 0.5 : 1,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!lesson.locked) {
                  (e.currentTarget as HTMLElement).style.borderColor = lesson.color;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = lesson.locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              {/* Badge */}
              {lesson.badge && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'linear-gradient(135deg, #FFD700, #DAA520)',
                  color: '#1A0F0A', fontSize: 9, fontWeight: 800,
                  padding: '3px 8px', borderRadius: 4,
                  letterSpacing: '0.1em',
                }}>
                  {lesson.badge}
                </div>
              )}

              {/* Lock icon for locked lessons */}
              {lesson.locked && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  color: '#5A7A9A',
                }}>
                  <Lock size={16} />
                </div>
              )}

              {/* Icon */}
              <div style={{ fontSize: 40, marginBottom: 12 }}>{lesson.icon}</div>

              {/* Title */}
              <h3 style={{
                fontSize: 18, fontWeight: 600,
                color: lesson.locked ? '#5A7A9A' : '#fff',
                marginBottom: 8,
              }}>
                {lesson.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: 13, color: lesson.locked ? '#3A5A7A' : '#8BA4BE',
                lineHeight: 1.5, marginBottom: hasProgress ? 12 : 0,
              }}>
                {lesson.locked ? 'Coming soon...' : lesson.description}
              </p>

              {/* Progress */}
              {hasProgress && !lesson.locked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: '#FFD700',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#FFD700',
                  }} />
                  {completedSteps.length} lesson{completedSteps.length !== 1 ? 's' : ''} completed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
