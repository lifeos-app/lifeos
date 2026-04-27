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
