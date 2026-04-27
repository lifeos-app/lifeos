/**
 * LessonsView — Teddy's interactive lessons (Piano Academy, Learning to Code, etc.)
 */

import { useState } from 'react';
import { lazy, Suspense } from 'react';
import { ChevronLeft, Music, Code, Lock, CheckCircle2 } from 'lucide-react';
import { useLessonsStore } from '../../stores/useLessonsStore';
import { PageSkeleton } from '../../components/skeletons';
import type { LessonCard } from './types';

const PianoAcademy = lazy(() => import('../../components/lessons/PianoAcademy'));
const LearningToCode = lazy(() => import('../../components/lessons/LearningToCode'));

const LESSON_CATALOG: LessonCard[] = [
  {
    id: 'piano-academy',
    title: 'Piano Academy',
    description: 'Learn piano from zero — notes, chords, scales, reading music. An interactive Web Audio piano with 8 lessons.',
    icon: <Music size={24} color="#FFD700" />,
    color: '#FFD700',
    component: 'piano-academy',
  },
  {
    id: 'learning-to-code',
    title: 'Learning to Code',
    description: 'Build web pages step by step — HTML, CSS, JavaScript. Write code and see it live in real-time.',
    icon: <Code size={24} color="#00D4FF" />,
    color: '#00D4FF',
    component: 'learning-to-code',
  },
  {
    id: 'guitar-101',
    title: 'Guitar 101',
    description: 'Strum your first chords, learn fingerpicking patterns, and play campfire songs.',
    icon: <Lock size={24} color="#5A7A9A" />,
    color: '#E8A87C',
    component: 'piano-academy',
    locked: true,
  },
  {
    id: 'beat-lab',
    title: 'Beat Lab',
    description: 'Create beats, loops, and tracks using the Web Audio API. From drum patterns to full arrangements.',
    icon: <Lock size={24} color="#5A7A9A" />,
    color: '#A855F7',
    component: 'piano-academy',
    locked: true,
  },
];

export function LessonsView() {
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const { completeStep, getCompletedSteps } = useLessonsStore();
  const activeData = LESSON_CATALOG.find(l => l.id === activeLesson);

  const handleStepComplete = (stepId: string) => {
    if (activeLesson) completeStep(activeLesson, stepId);
  };

  // Active lesson view
  if (activeLesson && activeData && !activeData.locked) {
    const completedSteps = getCompletedSteps(activeLesson);
    return (
      <div style={{ minHeight: '100%' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 0', marginBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={() => setActiveLesson(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
              padding: '6px 12px', color: '#8BA4BE', cursor: 'pointer', fontSize: 13,
            }}
          >
            <ChevronLeft size={14} /> Back to Lessons
          </button>
          <span style={{ color: activeData.color, fontWeight: 600, fontSize: 14 }}>
            {activeData.title}
          </span>
        </div>

        <Suspense fallback={<PageSkeleton />}>
          {activeData.component === 'piano-academy' && (
            <PianoAcademy
              onStepComplete={handleStepComplete}
              completedSteps={completedSteps}
            />
          )}
          {activeData.component === 'learning-to-code' && (
            <LearningToCode
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
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
        Teddy's Lessons
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
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
                border: `1px solid ${lesson.locked ? 'rgba(255,255,255,0.05)' : `${lesson.color}20`}`,
                borderRadius: 14,
                padding: 20,
                cursor: lesson.locked ? 'default' : 'pointer',
                transition: 'all 0.2s',
                opacity: lesson.locked ? 0.5 : 1,
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!lesson.locked) {
                  (e.currentTarget as HTMLElement).style.borderColor = lesson.color;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = lesson.locked ? 'rgba(255,255,255,0.05)' : `${lesson.color}20`;
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <div style={{ marginBottom: 12 }}>{lesson.icon}</div>
              <h3 style={{
                fontSize: 16, fontWeight: 600,
                color: lesson.locked ? '#5A7A9A' : '#fff',
                marginBottom: 6,
              }}>
                {lesson.title}
              </h3>
              <p style={{
                fontSize: 12, color: lesson.locked ? '#3A5A7A' : '#8BA4BE',
                lineHeight: 1.5, marginBottom: hasProgress ? 8 : 0,
              }}>
                {lesson.locked ? 'Coming soon...' : lesson.description}
              </p>
              {hasProgress && !lesson.locked && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: '#39FF14',
                }}>
                  <CheckCircle2 size={12} />
                  {completedSteps.length} step{completedSteps.length !== 1 ? 's' : ''} completed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}