/**
 * LearningGoalsHub — Grid of LearningGoalCard + "New Goal" button.
 */

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { useAcademyStore2 } from '../../stores/useAcademyStore2';
import { LearningGoalCard } from './LearningGoalCard';
import { LearningGoalWizard } from './LearningGoalWizard';
import { CurriculumView2 } from './CurriculumView2';
import { LessonViewer2 } from './LessonViewer2';
import type { CurriculumLesson } from '../../types/academy';

export function LearningGoalsHub() {
  const { activeLearningGoals, loading } = useAcademyStore2();
  const [showWizard, setShowWizard] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const getGoalById = useAcademyStore2(s => s.getGoalById);
  const activeGoal = activeGoalId ? getGoalById(activeGoalId) : undefined;

  // Find lesson in curriculum
  let activeLesson: CurriculumLesson | null = null;
  if (activeGoal?.curriculum && activeLessonId) {
    for (const phase of activeGoal.curriculum.phases) {
      for (const topic of phase.topics) {
        for (const lesson of topic.lessons) {
          if (lesson.id === activeLessonId) {
            activeLesson = lesson;
          }
        }
      }
    }
  }

  // Lesson viewer
  if (activeGoal && activeLesson) {
    return (
      <LessonViewer2
        goal={activeGoal}
        lesson={activeLesson}
        onComplete={() => setActiveLessonId(null)}
        onBack={() => setActiveLessonId(null)}
      />
    );
  }

  // Curriculum view
  if (activeGoal) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <button
          onClick={() => setActiveGoalId(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#8BA4BE',
            cursor: 'pointer', fontSize: 13, marginBottom: 16,
          }}
        >
          Back to Goals
        </button>
        <CurriculumView2
          goal={activeGoal}
          onOpenLesson={(lessonId) => setActiveLessonId(lessonId)}
        />
      </div>
    );
  }

  // Goals grid
  return (
    <div style={{ paddingBottom: 24 }}>
      {showWizard && (
        <LearningGoalWizard
          onClose={() => setShowWizard(false)}
          onCreated={(goalId) => {
            setShowWizard(false);
            setActiveGoalId(goalId);
          }}
        />
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>
          Learning Goals
        </h2>
        <button
          onClick={() => setShowWizard(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: 'rgba(0,212,255,0.15)', color: '#00D4FF',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {loading && activeLearningGoals.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#5A7A9A' }}>
          Loading...
        </div>
      )}

      {!loading && activeLearningGoals.length === 0 && (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          background: 'rgba(255,255,255,0.02)', borderRadius: 16,
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <Target size={40} color="#5A7A9A" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#8BA4BE', marginBottom: 8 }}>
            Start your first learning journey
          </h3>
          <p style={{ fontSize: 13, color: '#5A7A9A', marginBottom: 20 }}>
            Create a personalised curriculum with AI-generated lessons
          </p>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #00D4FF, #0088CC)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Create Learning Goal
          </button>
        </div>
      )}

      {activeLearningGoals.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {activeLearningGoals.map(goal => (
            <LearningGoalCard
              key={goal.id}
              goal={goal}
              onOpen={(id) => setActiveGoalId(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
