/**
 * Custom hook for Academy page-level state management.
 *
 * Encapsulates view switching, lesson2 navigation, and store hydration.
 */

import { useState, useEffect } from 'react';
import { useAcademyStore } from '../../stores/useAcademyStore';
import { useAcademyStore2 } from '../../stores/useAcademyStore2';
import type { AcademyView, LearningGoal, CurriculumLesson } from './types';

export function useAcademyPageState() {
  const [view, setView] = useState<AcademyView>('curriculum');
  const store = useAcademyStore();

  // Academy 2.0 lesson2 state
  const [lesson2Goal, setLesson2Goal] = useState<LearningGoal | null>(null);
  const [lesson2Lesson, setLesson2Lesson] = useState<CurriculumLesson | null>(null);
  const [lesson2Phase, setLesson2Phase] = useState<{ title: string; topics: { lessons: CurriculumLesson[] }[] } | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    store.hydrate();
    useAcademyStore2.getState().fetchAll();
  }, []);

  // Start study session tracking
  useEffect(() => {
    store.startStudySession(store.currentLesson);
    return () => { store.endStudySession(); };
  }, []);

  // URL param syncing: ?goal=X&lesson=Y navigates to lesson2 view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const goalParam = params.get('goal');
    const lessonParam = params.get('lesson');
    if (goalParam && lessonParam) {
      // Attempt to find the goal/lesson — this requires goal data to be available
      // For now, store the params for when goal data arrives from Phase 2's store
      // TODO: Wire up to useAcademyStore2 when available
    }
  }, []);

  const openLesson = (lessonId: string) => {
    store.setCurrentLesson(lessonId);
    setView('lesson');
  };

  /** Open a lesson in the Academy 2.0 two-column viewer */
  const openLesson2 = (goal: LearningGoal, lesson: CurriculumLesson, phase: { title: string; topics: { lessons: CurriculumLesson[] }[] }) => {
    setLesson2Goal(goal);
    setLesson2Lesson(lesson);
    setLesson2Phase(phase);
    setView('lesson2');
  };

  const backToCurriculum = () => {
    store.setCurrentLesson(null);
    setLesson2Goal(null);
    setLesson2Lesson(null);
    setLesson2Phase(null);
    setView('curriculum');
  };

  /** Navigate to next/prev lesson within the current lesson2 phase */
  const navigateLesson2 = (direction: 'next' | 'prev') => {
    if (!lesson2Phase) return;
    const allLessons = lesson2Phase.topics.flatMap((t) => t.lessons);
    const idx = allLessons.findIndex((l) => l.id === lesson2Lesson?.id);
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < allLessons.length) {
      setLesson2Lesson(allLessons[nextIdx]);
    }
  };

  /** Mark the current lesson2 lesson as complete locally */
  const completeLesson2 = () => {
    if (lesson2Lesson) {
      setLesson2Lesson({ ...lesson2Lesson, completedAt: new Date().toISOString() });
    }
  };

  return {
    view,
    setView,
    store,
    lesson2Goal,
    lesson2Lesson,
    lesson2Phase,
    openLesson,
    openLesson2,
    backToCurriculum,
    navigateLesson2,
    completeLesson2,
  };
}