/**
 * Shared types for the Academy page sub-components.
 */

export type AcademyView = 'curriculum' | 'lesson' | 'lesson2' | 'cheatsheets' | 'progress' | 'lessons' | 'goals';

export type CurriculumLesson = {
  id: string; title: string; content: string; keyPoints: string[];
  estimatedMinutes: number; phaseIndex: number; completedAt: string | null; xpReward: number;
};

export type LearningGoal = {
  id: string; topic: string; domain: string; currentLevel: string;
  curriculum: { phases: { title: string; topics: { lessons: CurriculumLesson[] }[] }[] } | null;
  [key: string]: unknown;
};

export interface LessonCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  component: 'piano-academy' | 'learning-to-code';
  locked?: boolean;
}