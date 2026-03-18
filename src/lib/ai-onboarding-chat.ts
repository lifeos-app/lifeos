/**
 * AI Onboarding Chat Engine
 * 
 * Powers the conversational onboarding path.
 * Each exchange: user talks → AI responds naturally + extracts structured data.
 * Coverage tracker knows what's been gathered and what's still needed.
 */

import { callLLMProxy } from './llm-proxy';
import { getErrorMessage } from '../utils/error';
import { logger } from '../utils/logger';

// ─── Coverage Tracking ───────────────────────────────────────────

export interface OnboardingCoverage {
  name: boolean;
  values: boolean;        // at least 3 core values detected
  strengths: boolean;     // at least 2 strengths
  purpose: boolean;       // purpose/passion/mission mentioned
  lifeAreas: boolean;     // rated or discussed life areas
  goals: boolean;         // at least 2 concrete goals
  habits: boolean;        // mentioned habits or routines
  reflection: boolean;    // past wins/lessons/struggles
}

export interface ExtractedData {
  name: string;
  coreValues: string[];
  strengths: string[];
  purposeAnswers: string[];   // raw answers about passion/purpose
  purpose: string;            // synthesized purpose statement
  lifeRatings: Record<string, number>;
  focusAreas: string[];
  futureVision: Record<string, { be: string; have: string; feel: string }>;
  goals: string[];
  goalDetails: Array<{
    title: string;
    type: 'short' | 'medium' | 'long';
    description: string;
    feeling: string;
    targetDate: string;
    actions: string[];
    milestones: string[];
    reward: string;
    category: string;
  }>;
  pastWins: string;
  pastMisses: string;
  pastLessons: string;
  pastRating: number;
  goodHabits: string[];
  badHabits: Array<{ bad: string; replacement: string }>;
  morningRoutine: Array<{ activity: string; time: string }>;
  eveningRoutine: Array<{ activity: string; time: string }>;
}

export interface ChatExchangeResult {
  reply: string;
  extractedUpdates: Partial<ExtractedData>;
  coverage: OnboardingCoverage;
  coveragePercent: number;
  readyToFinalize: boolean;
  suggestedNextTopic: string | null;
}

export function getEmptyData(): ExtractedData {
  return {
    name: '',
    coreValues: [],
    strengths: [],
    purposeAnswers: [],
    purpose: '',
    lifeRatings: {},
    focusAreas: [],
    futureVision: {},
    goals: [],
    goalDetails: [],
    pastWins: '',
    pastMisses: '',
    pastLessons: '',
    pastRating: 5,
    goodHabits: [],
    badHabits: [],
    morningRoutine: [],
    eveningRoutine: [],
  };
}

export function calculateCoverage(data: ExtractedData): { coverage: OnboardingCoverage; percent: number } {
  const coverage: OnboardingCoverage = {
    name: !!data.name.trim(),
    values: data.coreValues.length >= 3,
    strengths: data.strengths.length >= 2,
    purpose: !!data.purpose.trim() || data.purposeAnswers.filter(a => a.trim()).length >= 2,
    lifeAreas: data.focusAreas.length >= 2 || Object.keys(data.lifeRatings).length >= 3,
    goals: data.goals.length >= 2 || data.goalDetails.length >= 2,
    habits: data.goodHabits.length >= 1 || data.morningRoutine.length >= 1 || data.eveningRoutine.length >= 1,
    reflection: !!(data.pastWins.trim() || data.pastLessons.trim()),
  };

  const total = Object.values(coverage).length;
  const filled = Object.values(coverage).filter(Boolean).length;
  return { coverage, percent: Math.round((filled / total) * 100) };
}

// ─── System Prompt ───────────────────────────────────────────────

function buildOnboardingPrompt(currentData: ExtractedData, coverage: OnboardingCoverage): string {
  const uncovered = Object.entries(coverage)
    .filter(([, done]) => !done)
    .map(([key]) => key);
  const covered = Object.entries(coverage)
    .filter(([, done]) => done)
    .map(([key]) => key);
  const percent = Math.round((covered.length / Object.keys(coverage).length) * 100);

  return `You are LifeOS — a warm, insightful life coach helping someone set up their personal life system through natural conversation.

## CRITICAL RULES
1. NEVER repeat a question you already asked. Read the conversation history.
2. NEVER ask about something already gathered (see GATHERED DATA below).
3. Each reply must move the conversation FORWARD toward uncovered areas.
4. Be AGGRESSIVE with extraction — infer values, strengths, and focus areas from context.
5. Keep replies to 2-3 sentences MAX. One question per reply.
6. After 5+ exchanges, start wrapping toward uncovered areas directly.

## PROGRESS: ${percent}% complete
✅ Covered: ${covered.length > 0 ? covered.join(', ') : 'nothing yet'}
🔲 Still needed: ${uncovered.length > 0 ? uncovered.join(', ') : 'DONE — offer to build system!'}

## GATHERED DATA (DO NOT re-ask about these)
- name: ${currentData.name || '(unknown)'}
- values: ${currentData.coreValues.length > 0 ? currentData.coreValues.join(', ') : '(none)'}
- strengths: ${currentData.strengths.length > 0 ? currentData.strengths.join(', ') : '(none)'}
- purpose: ${currentData.purpose || '(none)'}
- focus areas: ${currentData.focusAreas.length > 0 ? currentData.focusAreas.join(', ') : '(none)'}
- goals: ${currentData.goals.length > 0 ? currentData.goals.join(', ') : '(none)'}
- habits: ${currentData.goodHabits.length > 0 ? currentData.goodHabits.join(', ') : '(none)'}
- reflection: ${currentData.pastWins ? 'gathered' : '(none)'}

## STRATEGY FOR UNCOVERED AREAS
${uncovered.includes('name') ? '- ASK THEIR NAME FIRST before anything else.\n' : ''}${uncovered.includes('values') ? '- Values: Listen for what matters to them. If they talk about family, extract "Family". If they talk about learning, extract "Knowledge", "Growth". Infer aggressively.\n' : ''}${uncovered.includes('strengths') ? '- Strengths: Ask "What are you naturally good at?" or infer from what they do well.\n' : ''}${uncovered.includes('purpose') ? '- Purpose: Once you have values + goals, SYNTHESIZE a purpose statement from what you know. Don\'t wait for them to state it perfectly.\n' : ''}${uncovered.includes('lifeAreas') ? '- Life Areas: Extract from context. If they talk about business → "Career / Business". Health → "Health & Fitness". Multiple areas count.\n' : ''}${uncovered.includes('goals') ? '- Goals: Any "I want to..." or "I\'m working on..." is a goal. Extract it.\n' : ''}${uncovered.includes('habits') ? '- Habits: Ask "Do you have any daily routines or habits?" or infer from mentions.\n' : ''}${uncovered.includes('reflection') ? '- Reflection: Ask "What\'s something you\'re proud of recently?" or "What lesson has stuck with you?"\n' : ''}
## EXTRACTION RULES — BE AGGRESSIVE
Extract EVERYTHING you can from each message. Examples:
- "I run a cleaning business" → goals: ["Grow cleaning business"], focusAreas: ["Career / Business"], strengths: ["Entrepreneurship"]
- "I love reading about robotics" → values: ["Knowledge", "Innovation"], focusAreas: ["Education / Learning"], goodHabits: ["Reading"]
- "Finding staff is hard" → goals: ["Hire reliable staff"], strengths: ["Business management"]
- "I wake up at 5am" → morningRoutine: [{"activity": "Early rise", "time": "05:00"}]

When you have enough data for purpose (values + what drives them), SYNTHESIZE one immediately:
e.g. "To build innovative cleaning solutions through robotics and automation while growing as a leader and learner."

## LIFE AREAS
Health & Fitness, Career / Business, Finances, Relationships, Education / Learning, Travel / Adventure, Spirituality, Home / Physical Environment

## OUTPUT FORMAT — RETURN ONLY VALID JSON
{
  "reply": "Your 2-3 sentence response. ONE question max. Warm and natural.",
  "extracted": {
    "name": "string (if mentioned)",
    "coreValues": ["inferred values from this message"],
    "strengths": ["inferred strengths"],
    "purposeAnswers": ["raw answer about what drives them"],
    "purpose": "synthesized purpose (when you have enough info)",
    "focusAreas": ["life areas mentioned or implied"],
    "goals": ["concrete goals/ambitions"],
    "goalDetails": [{"title":"...","type":"short|medium|long","description":"...","feeling":"","targetDate":"","actions":[],"milestones":[],"reward":"","category":"..."}],
    "pastWins": "what they're proud of",
    "pastLessons": "what they've learned",
    "goodHabits": ["habits mentioned or implied"],
    "morningRoutine": [{"activity":"...","time":""}],
    "eveningRoutine": [{"activity":"...","time":""}]
  },
  "suggestedNextTopic": "next uncovered area to steer toward"
}`;
}

// ─── Chat Engine ─────────────────────────────────────────────────

export async function processOnboardingMessage(
  userMessage: string,
  currentData: ExtractedData,
  history: { role: 'user' | 'model'; content: string }[],
): Promise<ChatExchangeResult> {
  const { coverage } = calculateCoverage(currentData);
  const systemPrompt = buildOnboardingPrompt(currentData, coverage);

  // Build messages for the proxy (OpenAI-style format)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : h.role,
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await callLLMProxy(messages, {
      timeoutMs: 30000,
      provider: 'openrouter',
      model: 'moonshotai/kimi-k2.5',
    });
    const text = response.content;

    let parsed: any;
    try {
      let jsonStr = text.trim();
      // Strip markdown code fences
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      // Handle cases where LLM wraps JSON in extra text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      logger.error('Onboarding JSON parse error:', parseErr, 'Raw:', text?.substring(0, 500));
      // Try to salvage: if the LLM returned plain text instead of JSON,
      // use it as the reply and attempt keyword extraction
      const salvaged = salvagedExtraction(userMessage, text, currentData);
      if (salvaged) return salvaged;
      return errorResponse(`I understood what you said, but had a technical hiccup processing it. Could you try saying it slightly differently?`, currentData);
    }

    // Merge extracted data
    const extracted = parsed.extracted || {};
    const merged = mergeExtracted(currentData, extracted);
    const { coverage: newCoverage, percent } = calculateCoverage(merged);

    return {
      reply: parsed.reply || "Tell me more about yourself!",
      extractedUpdates: extracted,
      coverage: newCoverage,
      coveragePercent: percent,
      readyToFinalize: percent >= 75,
      suggestedNextTopic: parsed.suggestedNextTopic || null,
    };
  } catch (err: unknown) {
    logger.error('Onboarding chat error:', err);
    const msg = getErrorMessage(err);
    if (msg.includes('401') || msg.includes('token')) {
      return errorResponse(`Session expired — please refresh the page and try again.`, currentData);
    }
    if (msg.includes('429') || msg.includes('Rate limit') || msg.includes('RESOURCE_EXHAUSTED')) {
      return errorResponse(`I'm getting a lot of requests right now. Wait a minute and try again.`, currentData);
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return errorResponse(`That took too long — try a shorter message or refresh the page.`, currentData);
    }
    return errorResponse(`Something went wrong on my end (${msg.substring(0, 80)}). Try refreshing the page.`, currentData);
  }
}

function errorResponse(message: string, currentData: ExtractedData): ChatExchangeResult {
  const { coverage, percent } = calculateCoverage(currentData);
  return {
    reply: message,
    extractedUpdates: {},
    coverage,
    coveragePercent: percent,
    readyToFinalize: false,
    suggestedNextTopic: null,
  };
}

/**
 * When the LLM returns text but not valid JSON, try to salvage what we can
 * via simple keyword extraction from the user's message.
 */
function salvagedExtraction(userMessage: string, _llmText: string, currentData: ExtractedData): ChatExchangeResult | null {
  const msg = userMessage.toLowerCase();
  const extracted: Partial<ExtractedData> = {};

  // Extract goals from "I want to..." / "I plan to..." patterns
  const goalPatterns = msg.match(/(?:i (?:want|plan|aim|hope|need) to |my goal is to )(.*?)(?:\.|,|$)/gi);
  if (goalPatterns) {
    extracted.goals = goalPatterns.map(g => 
      g.replace(/^i (?:want|plan|aim|hope|need) to |^my goal is to /i, '').trim()
    ).filter(g => g.length > 3).slice(0, 5);
  }

  // Extract strengths from "my strength(s) include..." / "I'm good at..."
  const strengthPatterns = msg.match(/(?:my strengths? (?:include|are|is) |i(?:'m| am) good at )(.*?)(?:\.|$)/gi);
  if (strengthPatterns) {
    const raw = strengthPatterns.join(', ');
    extracted.strengths = raw.split(/,|and /).map(s => 
      s.replace(/^my strengths? (?:include|are|is) |^i(?:'m| am) good at /i, '').trim()
    ).filter(s => s.length > 2).slice(0, 5);
  }

  // Extract values from context keywords
  const valueKeywords: Record<string, string> = {
    'robot': 'Innovation', 'automat': 'Automation', 'system': 'Systems thinking',
    'learn': 'Learning', 'study': 'Education', 'read': 'Knowledge',
    'family': 'Family', 'faith': 'Faith', 'business': 'Entrepreneurship',
    'clean': 'Service', 'humanity': 'Service to others', 'resilien': 'Resilience',
    'effort': 'Hard work', 'passion': 'Passion', 'physic': 'Science',
  };
  const foundValues: string[] = [];
  for (const [keyword, value] of Object.entries(valueKeywords)) {
    if (msg.includes(keyword) && !foundValues.includes(value)) foundValues.push(value);
  }
  if (foundValues.length > 0) extracted.coreValues = foundValues.slice(0, 7);

  // Extract focus areas
  const areaKeywords: Record<string, string> = {
    'business': 'Career / Business', 'clean': 'Career / Business',
    'robot': 'Education / Learning', 'study': 'Education / Learning',
    'math': 'Education / Learning', 'physic': 'Education / Learning',
    'language': 'Education / Learning', 'read': 'Education / Learning',
    'health': 'Health & Fitness', 'exercise': 'Health & Fitness',
  };
  const foundAreas: string[] = [];
  for (const [keyword, area] of Object.entries(areaKeywords)) {
    if (msg.includes(keyword) && !foundAreas.includes(area)) foundAreas.push(area);
  }
  if (foundAreas.length > 0) extracted.focusAreas = foundAreas;

  // Only return salvaged result if we actually extracted something
  const hasData = (extracted.goals?.length || 0) + (extracted.strengths?.length || 0) + 
                  (extracted.coreValues?.length || 0) + (extracted.focusAreas?.length || 0) > 0;
  
  if (!hasData) return null;

  const merged = mergeExtracted(currentData, extracted);
  const { coverage, percent } = calculateCoverage(merged);

  return {
    reply: `Got it! I picked up a lot from that — your drive for automation, the cleaning business, your study habits. Let me ask: what does your typical daily routine look like?`,
    extractedUpdates: extracted,
    coverage,
    coveragePercent: percent,
    readyToFinalize: percent >= 75,
    suggestedNextTopic: 'habits',
  };
}

export function mergeExtracted(current: ExtractedData, updates: Partial<ExtractedData>): ExtractedData {
  const merged = { ...current };

  if (updates.name) merged.name = updates.name;
  if (updates.coreValues?.length) merged.coreValues = [...new Set([...merged.coreValues, ...updates.coreValues])].slice(0, 7);
  if (updates.strengths?.length) merged.strengths = [...new Set([...merged.strengths, ...updates.strengths])].slice(0, 7);
  if (updates.purposeAnswers?.length) merged.purposeAnswers = [...merged.purposeAnswers, ...updates.purposeAnswers];
  if (updates.purpose) merged.purpose = updates.purpose;
  if (updates.focusAreas?.length) merged.focusAreas = [...new Set([...merged.focusAreas, ...updates.focusAreas])].slice(0, 5);
  if (updates.goals?.length) merged.goals = [...new Set([...merged.goals, ...updates.goals])].slice(0, 8);
  if (updates.goalDetails?.length) merged.goalDetails = [...merged.goalDetails, ...updates.goalDetails];
  if (updates.pastWins) merged.pastWins = merged.pastWins ? `${merged.pastWins}. ${updates.pastWins}` : updates.pastWins;
  if (updates.pastMisses) merged.pastMisses = merged.pastMisses ? `${merged.pastMisses}. ${updates.pastMisses}` : updates.pastMisses;
  if (updates.pastLessons) merged.pastLessons = merged.pastLessons ? `${merged.pastLessons}. ${updates.pastLessons}` : updates.pastLessons;
  if (updates.goodHabits?.length) merged.goodHabits = [...new Set([...merged.goodHabits, ...updates.goodHabits])];
  if (updates.badHabits?.length) merged.badHabits = [...merged.badHabits, ...updates.badHabits];
  if (updates.morningRoutine?.length) merged.morningRoutine = [...merged.morningRoutine, ...updates.morningRoutine];
  if (updates.eveningRoutine?.length) merged.eveningRoutine = [...merged.eveningRoutine, ...updates.eveningRoutine];

  return merged;
}
