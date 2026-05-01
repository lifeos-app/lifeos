/**
 * Onboarding LLM — Sage NPC communication layer
 *
 * Uses Gemini Flash via the existing LLM proxy to interpret free-form
 * user responses and extract structured onboarding data.
 */

import { callLLMProxy } from '../../lib/llm-proxy';
import type { CharacterClass } from '../../rpg/engine/types';
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────

export type OnboardingScene =
  | 'awakening'
  | 'path_selection'
  | 'identity'
  | 'first_seed'
  | 'the_dream'
  | 'first_words'
  | 'reveal';

export type EsbiClass = 'E' | 'S' | 'B' | 'I';

export interface ExtractedOnboardingData {
  motivation: string;
  esbiClass: EsbiClass;
  characterClass: CharacterClass;
  characterName: string;
  habitName: string;
  habitCategory: string;
  goalTitle: string;
  goalDescription: string;
  journalContent: string;
  journalMood: number;
  wakeDescription?: string;
  procrastinatedTask?: string;
  habitTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  goalTimeframe?: string;
}

export interface SageResponse {
  sageReply: string;
  extractedData?: Partial<ExtractedOnboardingData>;
  sceneComplete?: boolean;
  classScores?: Record<CharacterClass, number>;
}

export interface ConversationMessage {
  role: 'sage' | 'user';
  text: string;
}

// ── System prompt builders ───────────────────────

export function buildAwakeningPrompt(exchangeCount: number): string {
  return `You are the Sage, an ancient wise guide in a fantasy RPG realm called LifeOS. A new adventurer has just awakened. Guide them through 3 questions:

1. What motivates them (extract "motivation" keyword: fitness, learning, business, wellness, creative, balance)
2. What a good day looks like (extract "wakeDescription")
3. What they've been putting off (extract "procrastinatedTask")

Respond as JSON:
{
  "sageReply": "your in-character reply (1-3 sentences, warm and mystical)",
  "extractedData": { "motivation": "...", "wakeDescription": "...", "procrastinatedTask": "..." },
  "sceneComplete": true or false
}

${exchangeCount < 1 ? 'This is the first exchange. Extract motivation, then ask about a good day. sceneComplete: false.'
  : exchangeCount < 2 ? 'Second exchange. Extract wakeDescription, then ask what they have been putting off. sceneComplete: false.'
  : 'Third exchange. Extract procrastinatedTask. Set sceneComplete: true.'}`;
}

export function buildIdentityPrompt(exchangeCount: number): string {
  return `You are the Sage, guiding a new adventurer in LifeOS. You're helping them discover their life focus area.

The 5 focus areas (mapped to internal class IDs):
- warrior: Health & Fitness — building strength, discipline, physical training
- mage: Education & Research — learning, reading, intellectual pursuits
- ranger: Business & Finance — strategy, entrepreneurship, markets
- healer: Wellbeing & Healing — mindfulness, emotional balance, spirituality
- engineer: Tech & Building — creating, designing, projects, code

Discover their focus area based on what they say about their interests/lifestyle.
Extract the matching "characterClass" ID (warrior/mage/ranger/healer/engineer).
Do NOT ask for a name — the character creation UI handles that separately.

Respond as JSON:
{
  "sageReply": "your in-character reply acknowledging their path (1-3 sentences, warm)",
  "extractedData": { "characterClass": "class id" },
  "classScores": { "warrior": 0.0, "mage": 0.0, "ranger": 0.0, "healer": 0.0, "engineer": 0.0 },
  "sceneComplete": false
}

${exchangeCount < 1 ? 'First exchange. Extract characterClass from their response. sceneComplete: false — the character creation panel will handle the rest.'
  : 'Follow-up exchange. If class is already known, acknowledge warmly. sceneComplete: false.'}`;
}

export function buildFirstSeedPrompt(exchangeCount: number): string {
  return `You are the Sage in LifeOS. The adventurer has chosen their class. Now help them plant their first seed — their first daily habit.

Guide them through 2 questions:
1. Name a habit they want to build (extract "habitName" and "habitCategory": health/learning/finance/wellness/productivity/creative)
2. When they want to do it (extract "habitTimeOfDay": morning/afternoon/evening/anytime)

Respond as JSON:
{
  "sageReply": "your in-character reply (1-3 sentences, encouraging)",
  "extractedData": { "habitName": "...", "habitCategory": "...", "habitTimeOfDay": "..." },
  "sceneComplete": true or false
}

${exchangeCount < 1 ? 'First exchange. Extract habitName and habitCategory, then ask about time of day. sceneComplete: false.'
  : 'Second exchange. Extract habitTimeOfDay. Set sceneComplete: true.'}`;
}

export function buildTheDreamPrompt(exchangeCount: number): string {
  return `You are the Sage in LifeOS. The adventurer has planted their first habit. Now help them envision their dream — their first goal.

Guide them through 2 questions:
1. Describe a goal (extract "goalTitle" and "goalDescription")
2. By when (extract "goalTimeframe" as raw text like "3 months", "by summer")

Respond as JSON:
{
  "sageReply": "your in-character reply (1-3 sentences, inspiring)",
  "extractedData": { "goalTitle": "...", "goalDescription": "...", "goalTimeframe": "..." },
  "sceneComplete": true or false
}

${exchangeCount < 1 ? 'First exchange. Extract goalTitle and goalDescription, then ask "by when?". sceneComplete: false.'
  : 'Second exchange. Extract goalTimeframe. Set sceneComplete: true.'}`;
}

export function buildFirstWordsPrompt(): string {
  return `You are the Sage in LifeOS. The adventurer is about to write their first journal entry — their first words in the Realm's chronicle. The Chronicle awaits their first words — they need not be grand, just true.

Acknowledge what they write warmly and reflect on the mood you sense. Extract their mood on a 1-5 scale (1=struggling, 3=neutral, 5=thriving) based on the tone.

Respond as JSON:
{
  "sageReply": "your in-character acknowledgment with mood reflection (2-3 sentences)",
  "extractedData": { "journalMood": 3 },
  "sceneComplete": true
}

Always set sceneComplete to true — any journal entry is valid.`;
}

function getSystemPrompt(scene: OnboardingScene, exchangeCount: number): string {
  switch (scene) {
    case 'awakening': return buildAwakeningPrompt(exchangeCount);
    case 'identity': return buildIdentityPrompt(exchangeCount);
    case 'first_seed': return buildFirstSeedPrompt(exchangeCount);
    case 'the_dream': return buildTheDreamPrompt(exchangeCount);
    case 'first_words': return buildFirstWordsPrompt();
    default: return '';
  }
}

// ── Main function ────────────────────────────────

/**
 * Parse and validate a raw LLM response string into a SageResponse.
 * Returns null if parsing fails.
 * @param scene - current scene (for guards)
 * @param exchangeCount - number of user messages so far (for guards)
 */
function parseSageResponse(rawContent: string, scene?: OnboardingScene, exchangeCount?: number): SageResponse | null {
  let jsonStr = rawContent.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: SageResponse;
  try {
    parsed = JSON.parse(jsonStr) as SageResponse;
  } catch {
    // Fallback: extract first {...} block via regex
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as SageResponse;
      } catch {
        logger.warn('[OnboardingLLM] Regex-extracted JSON also invalid:', match[0].slice(0, 200));
        return null;
      }
    } else {
      logger.warn('[OnboardingLLM] Could not extract JSON from response:', rawContent.slice(0, 300));
      return null;
    }
  }

  // Validate required field
  if (!parsed.sageReply || typeof parsed.sageReply !== 'string') {
    logger.warn('[OnboardingLLM] Missing sageReply in parsed response:', JSON.stringify(parsed).slice(0, 200));
    return null;
  }

  // Clean up extracted class — ensure it's a valid CharacterClass
  if (parsed.extractedData?.characterClass) {
    const valid: CharacterClass[] = ['warrior', 'mage', 'ranger', 'healer', 'engineer'];
    if (!valid.includes(parsed.extractedData.characterClass)) {
      delete parsed.extractedData.characterClass;
    }
  }

  // Clamp mood
  if (parsed.extractedData?.journalMood != null) {
    parsed.extractedData.journalMood = Math.max(1, Math.min(5, Math.round(parsed.extractedData.journalMood)));
  }

  // Guard: identity scene should never complete on first exchange
  // (needs both class + name, which requires at least 2 exchanges)
  if (scene === 'identity' && (exchangeCount ?? 0) < 1 && parsed.sceneComplete) {
    logger.warn('[OnboardingLLM] Blocked premature sceneComplete on identity first exchange');
    parsed.sceneComplete = false;
  }

  return parsed;
}

export async function askSage(
  scene: OnboardingScene,
  userMessage: string,
  history: ConversationMessage[],
  extractedSoFar: Partial<ExtractedOnboardingData>,
): Promise<SageResponse | null> {
  if (scene === 'reveal') return null;

  const exchangeCount = history.filter(m => m.role === 'user').length;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: getSystemPrompt(scene, exchangeCount) },
  ];

  // Add context about what we've already extracted
  if (Object.keys(extractedSoFar).length > 0) {
    messages.push({
      role: 'system',
      content: `Already extracted from previous scenes: ${JSON.stringify(extractedSoFar)}`,
    });
  }

  // Add conversation history
  for (const msg of history) {
    messages.push({
      role: msg.role === 'sage' ? 'assistant' : 'user',
      content: msg.text,
    });
  }

  // Add latest user message
  messages.push({ role: 'user', content: userMessage });

  const callOptions = {
    format: 'json' as const,
    timeoutMs: 60000,
    provider: 'ollama',
    model: 'glm-5.1:cloud',
    // Ollama runs locally — no auth needed. OpenRouter fallback requires auth.
  };

  // Attempt with one internal retry (callLLMProxy already retries on non-timeout errors,
  // but we also retry at the askSage level for parse failures)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      logger.info(`[OnboardingLLM] askSage attempt=${attempt + 1} scene=${scene} exchangeCount=${exchangeCount}`);
      const response = await callLLMProxy(messages, callOptions);

      const parsed = parseSageResponse(response.content, scene, exchangeCount);
      if (parsed) {
        logger.info(`[OnboardingLLM] askSage success on attempt ${attempt + 1}`);
        return parsed;
      }

      // Parse failed — if first attempt, retry
      if (attempt === 0) {
        logger.warn('[OnboardingLLM] Parse failed on attempt 1, retrying...');
        continue;
      }

      logger.warn('[OnboardingLLM] Parse failed on attempt 2, giving up');
      return null;
    } catch (err) {
      logger.warn(`[OnboardingLLM] askSage attempt ${attempt + 1} threw:`, err);
      if (attempt === 0) {
        // Wait briefly before retry
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return null;
    }
  }

  return null;
}
