/**
 * Academy 2.0 — Type Definitions
 *
 * All interfaces for the adaptive learning system:
 * LearningGoal, Curriculum, Assessment, TutorSession, etc.
 */

export type LearningStyle = 'visual' | 'reading' | 'hands_on' | 'mixed';
export type SkillLevel = 'complete_beginner' | 'some_exposure' | 'intermediate' | 'advanced';
export type GoalDomain = 'music' | 'language' | 'fitness' | 'business' | 'tech' | 'creative' | 'academic' | 'other';
export type TutorMode = 'chat' | 'deep_solve' | 'quiz' | 'research' | 'visualize' | 'practice';
export type PacingStatus = 'on_track' | 'ahead' | 'behind' | 'paused';
export type AssessmentStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'failed';
export type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false';
export type LearningGoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface LearnerProfile {
  userId: string;
  preferredLearningStyle: LearningStyle;
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
  averageSessionMinutes: number;
  completionRateWeekly: number;
  totalXPFromAcademy: number;
  lastUpdated: string;
}

export interface ReviewEntry {
  date: string;              // ISO date
  rating: 'again' | 'hard' | 'good' | 'easy';
  scheduledReview: string;   // ISO date of the next scheduled review
  elapsedDays: number;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  content: string;
  keyPoints: string[];
  phaseIndex: number;
  topicIndex: number;
  lessonIndex: number;
  scheduledDate: string | null;
  completedAt: string | null;
  xpReward: number;
  /** SRS scheduling state — undefined for unstarted lessons */
  srsState?: {
    state: 'new' | 'learning' | 'review' | 'relearning';
    ease: number;
    interval: number;
    due: number;             // timestamp (ms) when next review is due
    lapses: number;
    reviews: number;
    lastReview: number;      // timestamp (ms) of last review
    elapsedDays: number;
  };
  /** Review history for retention analytics */
  reviewHistory?: ReviewEntry[];
  /** FSRS-style difficulty (0-1) */
  difficulty?: number;
  /** FSRS-style memory stability */
  stability?: number;
}

export interface CurriculumTopic {
  id: string;
  title: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumPhase {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  estimatedWeeks: number;
  milestoneDescription: string;
  topics: CurriculumTopic[];
  assessmentStatus: AssessmentStatus;
  assessmentId: string | null;
  completedAt: string | null;
  goalId: string | null;
}

export interface GeneratedCurriculum {
  id: string;
  topic: string;
  phases: CurriculumPhase[];
  totalLessons: number;
  totalEstimatedHours: number;
  generatedAt: string;
  generatedBy: 'ai' | 'template' | 'fallback';
}

export interface LearningGoal {
  id: string;
  userId: string;
  topic: string;
  domain: GoalDomain;
  currentLevel: SkillLevel;
  targetDescription: string;
  minutesPerDay: number;
  targetDate: string | null;
  learningStyle: LearningStyle;
  status: LearningGoalStatus;
  curriculum: GeneratedCurriculum | null;
  currentPhaseIndex: number;
  currentLessonId: string | null;
  habitId: string | null;
  parentGoalId: string | null;
  pacingStatus: PacingStatus;
  lessonsCompletedThisWeek: number;
  lessonsScheduledThisWeek: number;
  weeklyTargetLessons: number;
  lastPacingEvalDate: string | null;
  createdAt: string;
  updatedAt: string;
  is_deleted: boolean;
}

export interface StudySession2 {
  id: string;
  userId: string;
  learningGoalId: string;
  lessonId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  tutorModeUsed: TutorMode[];
  xpEarned: number;
  completedLesson: boolean;
}

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export interface Assessment {
  id: string;
  userId: string;
  learningGoalId: string;
  phaseId: string;
  phaseIndex: number;
  status: AssessmentStatus;
  questions: AssessmentQuestion[];
  userAnswers: Record<string, string>;
  score: number | null;
  passingScore: number;
  attemptCount: number;
  lastAttemptAt: string | null;
  passedAt: string | null;
  createdAt: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: TutorMode;
  timestamp: string;
}

export interface TutorSession {
  learningGoalId: string;
  lessonId: string;
  messages: TutorMessage[];
  activeMode: TutorMode;
}

export interface PacingEvaluation {
  weekStart: string;
  scheduled: number;
  completed: number;
  completionRate: number;
  recommendation: 'increase' | 'decrease' | 'maintain';
  message: string;
  newWeeklyTarget: number;
}

export interface WizardInput {
  topic: string;
  domain: GoalDomain;
  currentLevel: SkillLevel;
  targetDescription: string;
  minutesPerDay: number;
  targetDate: string | null;
  learningStyle: LearningStyle;
}
