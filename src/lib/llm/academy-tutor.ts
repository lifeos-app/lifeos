/**
 * Academy TutorBot — LLM prompt builder for 6 learning modes
 *
 * Builds mode-specific system prompts and message arrays for the
 * AI tutor sidebar in LessonViewer2.
 */

// ── Types ────────────────────────────────────────────────────────────

export type TutorMode = 'chat' | 'deep_solve' | 'quiz' | 'research' | 'visualize' | 'practice';

export interface TutorContext {
  goal: { topic: string; domain: string; currentLevel: string };
  lesson: { title: string; content: string; keyPoints: string[] };
  mode: TutorMode;
  messageHistory: { role: 'user' | 'assistant'; content: string }[];
  userInput: string;
}

// ── System prompts per mode ──────────────────────────────────────────

const SYSTEM_PROMPTS: Record<TutorMode, (ctx: TutorContext) => string> = {
  chat: (ctx) =>
    `You are a friendly, encouraging tutor teaching ${ctx.goal.topic} to a ${ctx.goal.currentLevel} student. ` +
    `The student is currently studying: ${ctx.lesson.title}. ` +
    `Key concepts covered: ${ctx.lesson.keyPoints.join(', ')}. ` +
    `Answer questions clearly and concisely. Give examples relevant to their level.`,

  deep_solve: (ctx) =>
    `You are a step-by-step problem solver. Break down the student's question about ${ctx.lesson.title} ` +
    `into clear numbered steps. Show your reasoning for each step. Be thorough but clear.`,

  quiz: (ctx) =>
    `You are a quiz master. Generate 3 quick practice questions about ${ctx.lesson.title} ` +
    `based on these key points: ${ctx.lesson.keyPoints.join(', ')}. ` +
    `Format as numbered questions. After the student answers, provide detailed feedback.`,

  research: (ctx) =>
    `You are a research assistant helping expand understanding of ${ctx.lesson.title} beyond the basics. ` +
    `Provide additional context, interesting connections to other concepts, historical background, ` +
    `and advanced applications. Keep it relevant to a ${ctx.goal.currentLevel} learner.`,

  visualize: (ctx) =>
    `You are an expert at explaining concepts visually. Create a clear ASCII diagram, concept map, ` +
    `or structured visual explanation of ${ctx.lesson.title}. Use boxes, arrows (→), and hierarchies ` +
    `to make relationships clear. Make it memorable.`,

  practice: (ctx) =>
    `You are a hands-on practice coach for ${ctx.goal.topic}. Create a concrete, achievable practice ` +
    `exercise the student can do RIGHT NOW based on ${ctx.lesson.title}. Include: what to do, ` +
    `how long it takes (~${Math.max(5, Math.round((ctx.lesson.keyPoints.length || 1) * 3))} min), ` +
    `what success looks like, and common mistakes to avoid.`,
};

// ── Public API ───────────────────────────────────────────────────────

export function buildTutorSystemPrompt(ctx: TutorContext): string {
  return SYSTEM_PROMPTS[ctx.mode](ctx);
}

export function buildTutorMessages(
  ctx: TutorContext,
): { role: string; content: string }[] {
  const system = buildTutorSystemPrompt(ctx);
  // Keep last 8 messages to stay within context window
  const recent = ctx.messageHistory.slice(-8);
  return [
    { role: 'system', content: system },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: ctx.userInput },
  ];
}

// ── Mode metadata ────────────────────────────────────────────────────

const MODE_META: Record<TutorMode, { label: string; description: string; icon: string }> = {
  chat:       { label: 'Chat',      description: 'Ask anything about the lesson',    icon: 'MessageCircle' },
  deep_solve: { label: 'Deep Solve',description: 'Step-by-step problem breakdown',   icon: 'Layers' },
  quiz:       { label: 'Quiz',      description: 'Test your understanding',          icon: 'HelpCircle' },
  research:   { label: 'Research',  description: 'Go deeper with context & history', icon: 'Search' },
  visualize:  { label: 'Visualize', description: 'See concepts as diagrams',         icon: 'Network' },
  practice:   { label: 'Practice',  description: 'Hands-on exercises to try now',    icon: 'Dumbbell' },
};

export function getModeLabel(mode: TutorMode): string {
  return MODE_META[mode].label;
}

export function getModeDescription(mode: TutorMode): string {
  return MODE_META[mode].description;
}

export function getModeIcon(mode: TutorMode): string {
  return MODE_META[mode].icon;
}

export const ALL_MODES: TutorMode[] = ['chat', 'deep_solve', 'quiz', 'research', 'visualize', 'practice'];
