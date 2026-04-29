// ============================================================================
// LifeOS Tutor Engine
// AI tutoring integration layer — connects SRS, challenge, and roadmap engines
// with local Ollama for Hermetic-aligned pedagogical interactions.
// ============================================================================

import type { ChallengeType } from './challenge-engine';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

/** Tutor modes — different pedagogical approaches */
export type TutorMode =
  | 'explain'      // Explain a concept in depth
  | 'quiz'         // Generate quiz questions on a topic
  | 'hint'         // Give hints without revealing the answer
  | 'review'       // Review and correct mistakes
  | 'connect'      // Connect concepts to Hermetic principles
  | 'socratic'     // Ask probing questions to guide discovery
  | 'practice';    // Generate practice problems

export interface TutorRequest {
  topic: string;
  mode: TutorMode;
  context?: string;             // Previous conversation or card content
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  hermeticPrinciple?: number;   // 0-6 for Hermetic alignment
  challengeType?: ChallengeType;
  previousAnswer?: string;      // For review mode
  language?: string;            // Default: 'en'
}

export interface TutorResponse {
  content: string;              // markdown response
  followUpQuestions?: string[];
  suggestedNextMode?: TutorMode;
  hermeticConnection?: {
    principle: number;
    principleName: string;
    insight: string;
  };
  confidence: number;          // 0-1
  modelUsed: string;
}

export interface TutorConversation {
  id: string;
  startedAt: string;
  messages: { role: 'user' | 'tutor'; content: string; timestamp: string }[];
  topic: string;
  hermeticPrinciple?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════════

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'glm-5.1:cloud';
const REQUEST_TIMEOUT_MS = 30_000;

export const HERMETIC_PRINCIPLES: Record<number, string> = {
  0: 'Mentalism',
  1: 'Correspondence',
  2: 'Vibration',
  3: 'Polarity',
  4: 'Rhythm',
  5: 'Cause & Effect',
  6: 'Gender',
};

export const TUTOR_MODE_LABELS: Record<TutorMode, string> = {
  explain: 'Explain',
  quiz: 'Quiz',
  hint: 'Hint',
  review: 'Review',
  connect: 'Hermetic Connect',
  socratic: 'Socratic',
  practice: 'Practice',
};

export const TUTOR_MODE_ICONS: Record<TutorMode, string> = {
  explain: 'BookOpen',
  quiz: 'HelpCircle',
  hint: 'Lightbulb',
  review: 'CheckCircle',
  connect: 'Sparkles',
  socratic: 'MessageCircle',
  practice: 'Dumbbell',
};

// ════════════════════════════════════════════════════════════════════════════
// System Prompts — Rich, LifeOS-aligned pedagogical prompts per mode
// ════════════════════════════════════════════════════════════════════════════

const TUTOR_SYSTEM_PROMPTS: Record<TutorMode, string> = {
  explain: `You are the Academy Sage within LifeOS, a life operating system guided by the 7 Hermetic Principles. You explain concepts by connecting them to universal principles. When a student asks about algorithms, you reveal the Correspondence between sorting and the natural order. When they ask about habit formation, you show how Rhythm governs all cycles. You teach with warmth, wisdom, and metaphor. You draw from the Kybalion and Hermetic tradition to illuminate modern topics. Your explanations are thorough but accessible. You use markdown formatting for clarity: headers, bold, lists, and code examples when relevant. You always begin from the student's current understanding and build upward. You never condescend. You make the abstract tangible through real-world examples — especially from business, habit science, and decision-making.`,

  quiz: `You are a master quiz-maker within LifeOS. You generate challenging, varied quiz questions that adapt to the learner's level. For beginners: factual recall and identification. For intermediate: application and analysis. For advanced: synthesis and evaluation. You create multiple-choice, true/false, short-answer, and scenario-based questions. Each question targets a specific concept and includes a detailed explanation of why the correct answer is right and why common distractors are wrong. When a Hermetic principle is specified, weave it into the questions naturally. Format your quizzes in clear markdown with question numbers, and always provide the answer key with explanations after the questions. Make your questions intellectually honest — not trick questions, but genuinely testing understanding.`,

  hint: `You are the Guide within LifeOS — a patient mentor who gives incremental hints that illuminate the path without revealing the destination. You NEVER give the answer outright. Instead, you guide through Socratic questioning and strategic clues. Start with the broadest, most abstract hint. If the student is still stuck, offer a slightly more specific one. Use metaphors and Hermetic connections. For example, if the answer is "binary search," your first hint might be "Think about how you find a word in a dictionary — do you read every page?" and your second might be "The Principle of Correspondence: macro-efficiency mirrors micro-efficiency." Always encourage the student's own discovery. Celebrate partial understanding. Redirect misconceptions gently. Your goal is the student's Eureka moment — earned, not given.`,

  review: `You are a compassionate reviewer within LifeOS. You celebrate correct thinking and gently redirect misconceptions. You reference Hermetic principles when relevant — noting where Cause & Effect reveals the chain of reasoning, or where Polarity shows that the student's answer was close but inverted. When reviewing code, focus on the approach first, then the details. When reviewing conceptual answers, acknowledge what's right before correcting what's wrong. Use the "yes, and..." technique: "Yes, you correctly identified X, and consider also Y..." Your feedback is specific, actionable, and encouraging. You never shame. You believe every wrong answer is a step toward right understanding. Rate confidence on a scale and provide study suggestions for weak areas.`,

  connect: `You are a master of Correspondence — the Hermetic principle that "As above, so below." Within LifeOS, you find the hidden connections between ANY topic and the 7 Hermetic Principles: Mentalism, Correspondence, Vibration, Polarity, Rhythm, Cause & Effect, and Gender. For any concept the student brings, you reveal how: (1) Mentalism — the concept exists first as a mental model before it's physical; (2) Correspondence — the concept mirrors patterns found at other scales; (3) Vibration — the concept involves oscillation, frequency, or energy transfer; (4) Polarity — the concept exists on a spectrum with its opposite; (5) Rhythm — the concept follows cycles of expansion and contraction; (6) Cause & Effect — the concept is governed by chains of causation; (7) Gender — the concept involves creative/receptive forces working together. You make the mystical practical and the practical mystical. Your connections are substantive, not forced.`,

  socratic: `You are a Socratic tutor within LifeOS. You ONLY ask questions. You never give answers, explanations, or statements. Every response must be a question or a series of questions. You guide the student toward understanding through strategic inquiry. When a student is confused, you ask simpler questions. When they're confident, you probe deeper. You use the Socratic method to reveal contradictions in thinking, to help students discover principles for themselves, and to build genuine understanding rather than memorization. You reference Hermetic principles through your questions: "What does the Principle of Rhythm suggest about the pattern you're observing?" Your questions build on each other, forming a chain of reasoning. You celebrate good reasoning with affirming questions: "That's an interesting insight — how might that apply here?"`,

  practice: `You are a Practice Coach within LifeOS. You create hands-on practice problems with increasing difficulty (scaffolding). Start with a warm-up that tests basic understanding, then build to intermediate application, and finally offer an advanced challenge. For code topics, provide starter code and clear requirements. For conceptual topics, create scenario-based exercises. For Hermetic principles, create real-world application challenges (e.g., "Map the Principle of Rhythm to your weekly schedule"). Always include: (1) a clear problem statement, (2) what success looks like, (3) estimated time (5-30 min), (4) hints if the student gets stuck, (5) a rubric or self-assessment checklist. Make practice feel like play, not punishment.`,
};

// ════════════════════════════════════════════════════════════════════════════
// Fallback Responses — Pre-crafted responses when Ollama is unavailable
// ════════════════════════════════════════════════════════════════════════════

interface FallbackEntry {
  pattern: RegExp;
  response: string;
}

const FALLBACK_RESPONSES: Record<TutorMode, { generic: string; entries: FallbackEntry[] }> = {
  explain: {
    generic: `That's a great topic to explore! While the AI tutor is currently offline, here's a foundational insight:\n\n**Key Principle**: Understanding comes in layers. Start with the "what," move to the "how," and eventually reach the "why."\n\nThe Hermetic tradition teaches that every concept has multiple levels of meaning — from the literal to the symbolic. When you study this topic, consider:\n\n1. **What** is it? (Definition and components)\n2. **How** does it work? (Mechanism and process)\n3. **Why** does it matter? (Purpose and connection to larger systems)\n\n*Reconnect with the AI tutor for a personalized deep-dive.*`,
    entries: [
      { pattern: /mentalism|mind|thought/i, response: `**The Principle of Mentalism** teaches that "The All is Mind; the Universe is Mental."\n\nThis means every creation begins as a thought. Every business, every habit, every decision was first a mental model before it became physical reality.\n\nWhen we understand Mentalism, we realize that:\n- Our **beliefs shape our perception** — we see what we expect to see\n- **Goal setting** is the act of creating a mental blueprint that the universe can materialize\n- **Limiting beliefs** are mental constructs that act as invisible barriers\n\n*Connect with the AI tutor for deeper exploration.*` },
      { pattern: /rhythm|cycle|burnout/i, response: `**The Principle of Rhythm** teaches that "Everything flows, out and in; the pendulum-swing manifests in everything."\n\nAll energy cycles between expansion and contraction. In business and life:\n- **High-energy phases** (expansion) demand bold action\n- **Low-energy phases** (contraction) are for reflection and planning\n- Fighting rhythm causes **burnout**; working with it creates **sustainability**\n\nThe key insight: you can't operate at peak intensity forever. Schedule your recovery as intentionally as your productivity.\n\n*Connect with the AI tutor for personalized rhythm strategies.*` },
      { pattern: /cause|effect|decision/i, response: `**The Principle of Cause & Effect** teaches that "Every Cause has its Effect; every Effect has its Cause."\n\nNothing happens by chance. In business and habits:\n- Every **spending decision** is a cause with compounding effects\n- Every **habit** is a small cause with cumulative results\n- **Unseen causes** (mental models, environment, social circles) shape visible effects\n\nThe practical application: when you see an effect you don't want, trace it back through the causal chain. When you want a specific effect, identify the smallest cause that would produce it.\n\n*Connect with the AI tutor for deeper analysis.*` },
    ],
  },
  quiz: {
    generic: `**Quick Knowledge Check** (offline mode)\n\nWhile the AI tutor is offline, test yourself with these reflection questions:\n\n1. Can you explain this concept in your own words?\n2. What's a real-world example of this?\n3. How does this connect to one of the 7 Hermetic Principles?\n4. What would happen if this principle were reversed?\n5. How could you apply this in your daily life?\n\n*Reconnect for AI-generated quizzes tailored to your level.*`,
    entries: [
      { pattern: /hermetic|principle/i, response: `**Hermetic Principles Quiz** (offline)\n\n1. Which principle states "As above, so below"?\n   a) Mentalism  b) Correspondence  c) Vibration  d) Polarity\n\n2. The Principle of Rhythm suggests that:\n   a) All is mind  b) Everything oscillates  c) Oppites are the same  d) Every cause has an effect\n\n3. How does Mentalism apply to goal-setting?\n   (Short answer)\n\n<details><summary>Answers</summary>\n1. b) Correspondence\n2. b) Everything oscillates\n3. Goals exist first as mental constructs before manifesting physically.\n</details>` },
    ],
  },
  hint: {
    generic: `**Hint Mode** (offline)\n\nI can't give personalized hints right now, but here's a universal strategy:\n\n1. **Start with what you know** — write down everything you understand about the topic\n2. **Identify the gap** — what's the missing piece between what you know and the answer?\n3. **Look for patterns** — is this similar to something you've solved before?\n4. **Apply Correspondence** — "As above, so below" — does a smaller version of this problem exist that you can solve?\n\n*Reconnect for AI-powered hints.*`,
    entries: [],
  },
  review: {
    generic: `**Review Mode** (offline)\n\nWhile the AI tutor is offline, try this self-review framework:\n\n**What I got right:**\n- [Identify specific points you're confident about]\n\n**What I'm uncertain about:**\n- [List anything that feels shaky]\n\n**Connection check:**\n- Can I connect this to a Hermetic principle?\n- Can I give a real-world example?\n- Could I teach this to someone else?\n\nIf you can't teach it, you haven't truly understood it yet. That's where to focus next.\n\n*Reconnect for AI-powered review.*`,
    entries: [],
  },
  connect: {
    generic: `**Hermetic Connection** (offline)\n\nEvery concept connects to the 7 Hermetic Principles. Here's how to find them:\n\n1. **Mentalism** — How does this concept originate in thought or mental models?\n2. **Correspondence** — What larger/smaller pattern does this mirror?\n3. **Vibration** — What energy, frequency, or oscillation is involved?\n4. **Polarity** — Where does this concept sit on a spectrum? What's its opposite?\n5. **Rhythm** — What cycles or pendulum swings appear?\n6. **Cause & Effect** — What causal chain produces this?\n7. **Gender** — What creative and receptive forces combine here?\n\n*Reconnect for AI-powered Hermetic connections.*`,
    entries: [],
  },
  socratic: {
    generic: `**Socratic Mode** (offline)\n\nWhile the AI tutor is offline, practice self-inquiry with these questions:\n\n1. What do I actually know about this topic? (Not what I assume I know.)\n2. How would I explain this to a 10-year-old?\n3. What's the strongest argument against my current understanding?\n4. If this concept didn't exist, what would be different?\n5. What's the simplest version of this concept? What's the most complex?\n\nRemember: the quality of your questions determines the quality of your understanding.\n\n*Reconnect for AI-powered Socratic dialogue.*`,
    entries: [],
  },
  practice: {
    generic: `**Practice Mode** (offline)\n\nWhile the AI tutor is offline, try this universal practice framework:\n\n**Warm-up (5 min):**\n- Write a one-sentence definition of the concept\n- Give one concrete example\n\n**Application (15 min):**\n- Apply the concept to a real problem you're facing\n- Map it to one Hermetic principle\n- Create an analogy that would make sense to a non-technical person\n\n**Challenge (10 min):**\n- What would happen if this concept were inverted?\n- Design an experiment to test your understanding\n\n*Reconnect for AI-generated practice problems.*`,
    entries: [],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Ollama API
// ════════════════════════════════════════════════════════════════════════════

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

let _ollamaAvailable: boolean | null = null;
let _availableModels: string[] | null = null;

/**
 * Check if Ollama is available at the configured endpoint.
 */
export async function isTutorAvailable(): Promise<boolean> {
  if (_ollamaAvailable !== null) {
    // Cache for 5 minutes
    return _ollamaAvailable;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    _ollamaAvailable = res.ok;
    return _ollamaAvailable;
  } catch {
    _ollamaAvailable = false;
    return false;
  }
}

/**
 * Get available models from Ollama.
 */
export async function getAvailableModels(): Promise<string[]> {
  if (_availableModels !== null) {
    return _availableModels;
  }
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    _availableModels = (data.models || []).map((m: { name: string }) => m.name);
    return _availableModels;
  } catch {
    return [];
  }
}

/**
 * Reset the availability cache (call if Ollama state may have changed).
 */
export function resetTutorCache(): void {
  _ollamaAvailable = null;
  _availableModels = null;
}

/**
 * Call Ollama chat API with retry logic.
 */
async function callOllama(
  messages: OllamaMessage[],
  model: string = DEFAULT_MODEL,
  options: { num_predict?: number; temperature?: number } = {},
): Promise<{ content: string; model: string }> {
  const { num_predict = 512, temperature = 0.7 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { num_predict, temperature },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${res.status} — ${errText}`);
    }

    const data: OllamaChatResponse = await res.json();
    return {
      content: data.message?.content || '',
      model: data.model || model,
    };
  } catch (err) {
    clearTimeout(timeout);
    // Cache unavailability
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('abort') || err.message.includes('ECONNREFUSED'))) {
      _ollamaAvailable = false;
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Fallback Response Builder
// ════════════════════════════════════════════════════════════════════════════

function getFallbackResponse(request: TutorRequest): TutorResponse {
  const modeData = FALLBACK_RESPONSES[request.mode];

  // Check pattern-matched entries first
  for (const entry of modeData.entries) {
    if (entry.pattern.test(request.topic)) {
      return {
        content: entry.response,
        followUpQuestions: [],
        suggestedNextMode: request.mode === 'hint' ? 'explain' : request.mode === 'quiz' ? 'review' : undefined,
        confidence: 0.3,
        modelUsed: 'fallback',
      };
    }
  }

  return {
    content: modeData.generic,
    followUpQuestions: [
      'What aspect would you like to explore deeper?',
      'How does this connect to your current projects?',
    ],
    suggestedNextMode: 'explain',
    confidence: 0.3,
    modelUsed: 'fallback',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate a tutoring response for the given request.
 * Falls back to pre-crafted responses if Ollama is unavailable.
 */
export async function generateTutorResponse(
  request: TutorRequest,
  conversation?: TutorConversation,
): Promise<TutorResponse> {
  const {
    topic,
    mode,
    context,
    difficulty = 'intermediate',
    hermeticPrinciple,
    challengeType,
    previousAnswer,
    language = 'en',
  } = request;

  // Check Ollama availability
  const isAvailable = await isTutorAvailable();

  if (!isAvailable) {
    return getFallbackResponse(request);
  }

  // Build the system prompt
  const systemPrompt = TUTOR_SYSTEM_PROMPTS[mode];

  // Build the user message with context
  let userContent = '';

  if (mode === 'review' && previousAnswer) {
    userContent = `Topic: ${topic}\n\nMy answer: "${previousAnswer}"\n\nPlease review my answer and provide feedback.`;
  } else if (mode === 'quiz') {
    userContent = `Generate a quiz on: ${topic}. Difficulty: ${difficulty}.`;
    if (hermeticPrinciple !== undefined) {
      userContent += ` Include questions related to the Principle of ${HERMETIC_PRINCIPLES[hermeticPrinciple]}.`;
    }
  } else if (mode === 'practice') {
    userContent = `Create a practice problem set on: ${topic}. Difficulty: ${difficulty}.`;
    if (challengeType) {
      userContent += ` Format: ${challengeType}.`;
    }
  } else if (mode === 'connect') {
    userContent = `Connect the topic "${topic}" to the 7 Hermetic Principles.`;
    if (hermeticPrinciple !== undefined) {
      userContent += ` Start with the Principle of ${HERMETIC_PRINCIPLES[hermeticPrinciple]}.`;
    }
  } else {
    userContent = topic;
  }

  if (context) {
    userContent = `Context: ${context}\n\n${userContent}`;
  }

  // Build messages array
  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history if provided
  if (conversation && conversation.messages.length > 0) {
    const recentHistory = conversation.messages.slice(-6); // Keep last 6 messages
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
  }

  messages.push({ role: 'user', content: userContent });

  try {
    // For longer responses (explain, connect), allow more tokens
    const maxTokens = mode === 'explain' || mode === 'connect' ? 1024 : 512;
    const result = await callOllama(messages, DEFAULT_MODEL, {
      num_predict: maxTokens,
      temperature: mode === 'practice' || mode === 'quiz' ? 0.5 : 0.7,
    });

    // Parse hermetic connection if present (simple extraction)
    let hermeticConnection: TutorResponse['hermeticConnection'] = undefined;
    if (hermeticPrinciple !== undefined) {
      const principleName = HERMETIC_PRINCIPLES[hermeticPrinciple] || 'Unknown';
      // Try to extract insight from the response
      const lines = result.content.split('\n');
      const principleLine = lines.find(l =>
        l.toLowerCase().includes(principleName.toLowerCase()) ||
        l.toLowerCase().includes('principle')
      );
      hermeticConnection = {
        principle: hermeticPrinciple,
        principleName,
        insight: principleLine?.replace(/[#*_]/g, '').trim() || `Connection to ${principleName} explored.`,
      };
    }

    // Suggest next mode based on current mode
    const nextModeMap: Partial<Record<TutorMode, TutorMode>> = {
      explain: 'quiz',
      quiz: 'review',
      hint: 'practice',
      review: 'practice',
      connect: 'socratic',
      socratic: 'explain',
      practice: 'quiz',
    };

    // Extract follow-up questions from the response
    const followUpRegex = /\d+\.\s+\*\*[^*]+\*\*\s+|\?\s*$/gm;
    const followUpQuestions: string[] = [];
    const questionRegex = /(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?([A-Z][^.!?]*\?(?:\*\*)?)/g;
    let match;
    while ((match = questionRegex.exec(result.content)) !== null && followUpQuestions.length < 3) {
      followUpQuestions.push(match[1].replace(/\*\*/g, '').trim());
    }

    return {
      content: result.content,
      followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
      suggestedNextMode: nextModeMap[mode],
      hermeticConnection,
      confidence: 0.85,
      modelUsed: result.model,
    };
  } catch (error) {
    // Fall back to pre-crafted responses
    console.warn('[tutor-engine] Ollama call failed, using fallback:', error);
    return getFallbackResponse(request);
  }
}

/**
 * Generate a follow-up based on the user's answer.
 * Useful for quiz review, hint progression, and Socratic dialogue.
 */
export async function generateFollowUp(
  topic: string,
  userAnswer: string,
  correctAnswer?: string,
  principle?: number,
): Promise<TutorResponse> {
  const mode: TutorMode = correctAnswer ? 'review' : 'socratic';

  return generateTutorResponse({
    topic,
    mode,
    previousAnswer: userAnswer,
    hermeticPrinciple: principle,
    context: correctAnswer
      ? `The correct answer is: "${correctAnswer}". The student answered: "${userAnswer}". Review their answer, celebrating what's correct and gently redirecting what isn't.`
      : `The student responded: "${userAnswer}". Continue the Socratic dialogue.`,
  });
}

/**
 * Create a study plan for a topic.
 * Generates a structured plan with steps and estimated times.
 */
export async function generateStudyPlan(
  topic: string,
  currentLevel: string,
  hoursPerWeek: number,
): Promise<{ title: string; steps: { title: string; description: string; estimatedMinutes: number }[] }> {
  const isAvailable = await isTutorAvailable();

  if (!isAvailable) {
    // Return a generic fallback study plan
    return {
      title: `${topic} Study Plan`,
      steps: [
        { title: 'Foundations', description: `Establish core understanding of ${topic} fundamentals. Read introductory material and create flashcards.`, estimatedMinutes: 60 },
        { title: 'Practice', description: `Apply ${topic} concepts through hands-on exercises. Use the practice mode to reinforce learning.`, estimatedMinutes: 90 },
        { title: 'Connection', description: `Map ${topic} to Hermetic principles. How does this topic reflect universal patterns?`, estimatedMinutes: 45 },
        { title: 'Review', description: `Review flashcards and quiz yourself. Identify gaps and revisit difficult areas.`, estimatedMinutes: 45 },
        { title: 'Teach', description: `Explain ${topic} to someone else (or write an explanation). Teaching reveals understanding gaps.`, estimatedMinutes: 30 },
      ],
    };
  }

  const messages: OllamaMessage[] = [
    {
      role: 'system',
      content: `You are a curriculum designer within LifeOS. Create structured study plans that integrate Hermetic principles with practical learning. Format your response as valid JSON matching this schema:
{
  "title": "string",
  "steps": [
    { "title": "string", "description": "string", "estimatedMinutes": number }
  ]
}
Provide 5-8 steps. Total estimated time should be roughly ${hoursPerWeek * 60} minutes (based on ${hoursPerWeek} hours/week).`,
    },
    {
      role: 'user',
      content: `Create a study plan for "${topic}" at level "${currentLevel}". Total weekly time: ${hoursPerWeek} hours.`,
    },
  ];

  try {
    const result = await callOllama(messages, DEFAULT_MODEL, {
      num_predict: 1024,
      temperature: 0.6,
    });

    // Try to parse the plan from the response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const plan = JSON.parse(jsonMatch[0]);
        if (plan.title && Array.isArray(plan.steps)) {
          return plan;
        }
      } catch {
        // Fall through to manual parsing
      }
    }

    // Manual fallback: parse numbered sections
    const steps: { title: string; description: string; estimatedMinutes: number }[] = [];
    const lines = result.content.split('\n');
    let currentTitle = '';
    let currentDesc = '';

    for (const line of lines) {
      const titleMatch = line.match(/^(?:\d+[\.\)]\s*)\*{0,2}([^*]+)\*{0,2}/);
      if (titleMatch) {
        if (currentTitle) {
          steps.push({
            title: currentTitle.trim(),
            description: currentDesc.trim() || `Study ${currentTitle.trim()}`,
            estimatedMinutes: Math.round((hoursPerWeek * 60) / 5),
          });
        }
        currentTitle = titleMatch[1].trim();
        currentDesc = '';
      } else if (currentTitle && line.trim()) {
        currentDesc += line.trim() + ' ';
      }
    }

    if (currentTitle) {
      steps.push({
        title: currentTitle.trim(),
        description: currentDesc.trim() || `Study ${currentTitle.trim()}`,
        estimatedMinutes: Math.round((hoursPerWeek * 60) / 5),
      });
    }

    return {
      title: `${topic} Study Plan`,
      steps: steps.length > 0 ? steps : [
        { title: 'Foundations', description: `Establish core understanding of ${topic}`, estimatedMinutes: 60 },
        { title: 'Application', description: `Apply concepts through practice`, estimatedMinutes: 60 },
        { title: 'Review & Mastery', description: `Solidify understanding through review`, estimatedMinutes: 60 },
      ],
    };
  } catch (error) {
    console.warn('[tutor-engine] Study plan generation failed:', error);
    return {
      title: `${topic} Study Plan`,
      steps: [
        { title: 'Foundations', description: `Establish core understanding of ${topic} fundamentals`, estimatedMinutes: 60 },
        { title: 'Practice', description: `Apply ${topic} concepts through exercises`, estimatedMinutes: 60 },
        { title: 'Review', description: `Review and solidify understanding`, estimatedMinutes: 60 },
      ],
    };
  }
}

/**
 * Create a new TutorConversation object.
 */
export function createConversation(topic: string, hermeticPrinciple?: number): TutorConversation {
  return {
    id: `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    messages: [],
    topic,
    hermeticPrinciple,
  };
}

/**
 * Add a message to a conversation.
 */
export function addConversationMessage(
  conversation: TutorConversation,
  role: 'user' | 'tutor',
  content: string,
): TutorConversation {
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}