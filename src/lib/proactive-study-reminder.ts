/**
 * proactive-study-reminder.ts — Study Reminder for Proactive Suggestions
 *
 * Generates study reminder suggestions for academy lessons scheduled today.
 * This module is designed to be integrated into proactive-suggestions.ts
 * when branches converge. The 'study_reminder' SuggestionType and
 * generateStudyReminder function should be added to that file.
 */

import type { Task } from '../types/database';

// ── Types ──

export type StudySuggestionType = 'study_reminder';

export interface StudyReminderSuggestion {
  id: string;
  type: StudySuggestionType;
  priority: number;
  title: string;
  message: string;
  action: {
    label: string;
    intent: {
      type: string;
      data: Record<string, unknown>;
      summary: string;
      confidence: number;
    };
  };
  dismissed: boolean;
  timestamp: string;
}

// ── Helpers ──

const todayStr = () => new Date().toISOString().split('T')[0];
const genId = () => `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Generator ──

/**
 * Generate a study reminder if any academy tasks are scheduled for today.
 * Designed to be called from generateProactiveSuggestions() in the main
 * proactive-suggestions.ts file.
 */
export function generateStudyReminder(tasks: Task[]): StudyReminderSuggestion | null {
  const today = todayStr();

  // Find study tasks due today
  const studyTasks = tasks.filter(t =>
    !t.is_deleted &&
    t.status !== 'done' &&
    t.due_date === today &&
    t.title?.startsWith('Study:') &&
    (t.tags ?? []).includes('academy')
  );

  if (studyTasks.length === 0) return null;

  const task = studyTasks[0];
  const lessonTitle = task.title.replace('Study: ', '');

  return {
    id: genId(),
    type: 'study_reminder',
    priority: 2,
    title: `Academy: ${lessonTitle}`,
    message: 'You have a study session scheduled today. Stay on track with your learning goal!',
    action: {
      label: 'Start Lesson',
      intent: {
        type: 'navigate',
        data: { route: '/academy' },
        summary: `Start study session: ${lessonTitle}`,
        confidence: 0.9,
      },
    },
    dismissed: false,
    timestamp: new Date().toISOString(),
  };
}
