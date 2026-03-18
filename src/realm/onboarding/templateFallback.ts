/**
 * Template Fallback — Pre-written Sage dialogue for when LLM is unavailable
 *
 * Provides canned responses, basic keyword matching, and default data
 * so onboarding can complete even without network.
 */

import type { OnboardingScene, SageResponse, ExtractedOnboardingData, EsbiClass } from './OnboardingLLM';
import type { CharacterClass } from '../../rpg/engine/types';
import { CHARACTER_CLASSES } from '../../rpg/data/classes';

// ── ESBI path cards ──

export const ESBI_CARD_DATA: { id: EsbiClass; name: string; description: string; icon: string; image: string }[] = [
  { id: 'E', name: 'Employee', description: 'Steady path — climb the ranks, master your craft', icon: '🏢', image: '/img/onboarding/esbi-employee.webp' },
  { id: 'S', name: 'Self-Employed', description: 'Trade your skills for freedom and autonomy', icon: '🔨', image: '/img/onboarding/esbi-trader.webp' },
  { id: 'B', name: 'Business Owner', description: 'Build systems that work without you', icon: '🏗️', image: '/img/onboarding/esbi-business.webp' },
  { id: 'I', name: 'Investor', description: 'Let money work for you', icon: '📈', image: '/img/onboarding/esbi-investor.webp' },
];

// ── Opening lines (used for both LLM and fallback modes) ──

export const SAGE_OPENING_LINES: Record<OnboardingScene, string> = {
  awakening:
    'Ah... you stir at last. The Realm has been waiting for one such as you. Tell me, adventurer — what draws you to this place? What do you seek to change in your life?',
  path_selection:
    'Before we discover your combat class, tell me — what path do you walk in the outer world?',
  identity:
    'Your spirit begins to take shape. Tell me — what world calls to you? Where does your energy flow most naturally?',
  first_seed:
    'Every great journey begins with a single seed. What is one habit — one small daily act — you wish to cultivate? It could be as simple as drinking water or reading a page.',
  the_dream:
    'Now look further, beyond tomorrow. What is a dream you carry? A goal that, once reached, would fill you with pride? Describe it to me.',
  first_words:
    'The Chronicle awaits your first words. They need not be grand — speak what is true. What is on your mind today?',
  reveal:
    'The Realm awakens to greet you. Your story begins now.',
};

// ── Fallback motivation pills ──

export const MOTIVATION_OPTIONS = [
  'Fitness', 'Learning', 'Business', 'Wellness', 'Creative', 'Balance',
] as const;

// ── Fallback class cards ──

export const CLASS_CARD_DATA = CHARACTER_CLASSES.map(c => ({
  id: c.id,
  name: c.name,
  icon: c.icon,
  image: c.image,
  color: c.color,
  description: c.focusAreas.join(', '),
}));

// ── Keyword → class mapping ──

const CLASS_KEYWORDS: Record<CharacterClass, string[]> = {
  warrior: ['fitness', 'exercise', 'gym', 'health', 'run', 'strong', 'discipline', 'workout', 'muscle', 'sport'],
  mage: ['learn', 'study', 'read', 'book', 'knowledge', 'school', 'education', 'course', 'research', 'write'],
  ranger: ['business', 'finance', 'money', 'invest', 'strategy', 'income', 'career', 'trade', 'entrepreneur', 'market'],
  healer: ['wellness', 'meditat', 'mindful', 'spiritual', 'peace', 'calm', 'mental', 'heal', 'yoga', 'balance'],
  engineer: ['build', 'code', 'tech', 'project', 'create', 'design', 'develop', 'app', 'maker', 'craft'],
};

// ── Keyword → habit category mapping ──

const HABIT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  health: ['exercise', 'gym', 'run', 'walk', 'water', 'sleep', 'stretch', 'workout', 'meditat'],
  learning: ['read', 'study', 'learn', 'book', 'course', 'practice', 'language'],
  finance: ['save', 'budget', 'invest', 'track', 'money', 'income'],
  wellness: ['journal', 'gratitude', 'mindful', 'relax', 'breath', 'yoga'],
  productivity: ['task', 'plan', 'organize', 'routine', 'schedule', 'focus', 'review'],
  creative: ['draw', 'write', 'music', 'paint', 'design', 'create', 'art'],
};

function matchClass(input: string): CharacterClass {
  const lower = input.toLowerCase();
  const scores: Record<string, number> = { warrior: 0, mage: 0, ranger: 0, healer: 0, engineer: 0 };

  for (const [cls, keywords] of Object.entries(CLASS_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[cls] += 1;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return (best[1] > 0 ? best[0] : 'warrior') as CharacterClass;
}

function matchHabitCategory(input: string): string {
  const lower = input.toLowerCase();
  for (const [cat, keywords] of Object.entries(HABIT_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return 'productivity';
}

function inferMood(input: string): number {
  const lower = input.toLowerCase();
  const positive = ['great', 'happy', 'excited', 'good', 'wonderful', 'amazing', 'love', 'thriving', 'awesome'];
  const negative = ['bad', 'sad', 'tired', 'stressed', 'anxious', 'struggling', 'overwhelm', 'lost', 'difficult'];

  let score = 3;
  for (const w of positive) if (lower.includes(w)) score += 0.5;
  for (const w of negative) if (lower.includes(w)) score -= 0.5;
  return Math.max(1, Math.min(5, Math.round(score)));
}

// ── Fallback scene input config ──

export interface FallbackInputConfig {
  type: 'pills' | 'cards' | 'text' | 'textarea' | 'none';
  label?: string;
  placeholder?: string;
}

export function getFallbackInputConfig(
  scene: OnboardingScene,
  extractedSoFar?: Partial<ExtractedOnboardingData>,
): FallbackInputConfig {
  const data = extractedSoFar || {};
  switch (scene) {
    case 'awakening':
      if (!data.motivation) return { type: 'pills' };
      return { type: 'text', placeholder: 'Describe your ideal day...' };
    case 'path_selection':
      return { type: 'cards' };
    case 'identity':
      if (!data.characterClass) return { type: 'cards' };
      // After class selection, CharacterCreationPanel handles name input
      return { type: 'none' };
    case 'first_seed':
      if (!data.habitName) return { type: 'text', label: 'Your first habit', placeholder: 'e.g. Drink 8 glasses of water' };
      return { type: 'text', label: 'Time of day', placeholder: 'Morning, afternoon, evening, or anytime' };
    case 'the_dream':
      if (!data.goalTitle) return { type: 'text', label: 'Your first goal', placeholder: 'e.g. Run a 5K by summer' };
      return { type: 'text', label: 'Timeframe', placeholder: 'e.g. 3 months, by summer' };
    case 'first_words':
      return { type: 'textarea', label: 'Your first journal entry', placeholder: 'Write freely...' };
    default:
      return { type: 'none' };
  }
}

// ── Template replies ──

export function getTemplateSageReply(
  scene: OnboardingScene,
  userInput: string,
  extractedSoFar?: Partial<ExtractedOnboardingData>,
): SageResponse {
  const lower = userInput.toLowerCase();
  const data = extractedSoFar || {};

  switch (scene) {
    case 'awakening': {
      // Exchange 1: motivation (pill click)
      if (!data.motivation) {
        const motivationMap: Record<string, string> = {
          fitness: 'fitness', learning: 'learning', business: 'business',
          wellness: 'wellness', creative: 'creative', balance: 'balance',
        };
        const motivation = motivationMap[lower] || lower.split(/\s+/)[0] || 'balance';
        const motivationReplies: Record<string, string> = {
          fitness: 'The body is the vessel of the spirit — strengthening it strengthens everything. I sense great determination in you. Now tell me, what does your ideal day look like? Paint me a picture.',
          learning: 'A seeker of knowledge! The Realm treasures those who hunger to understand. Wisdom is the truest power. Now tell me, what does your ideal day look like?',
          business: 'You seek to build something greater than yourself — to shape the world through enterprise. The Realm respects ambition paired with purpose. What does your ideal day look like?',
          wellness: 'To seek balance and peace of mind is to seek the foundation upon which all else is built. A wise choice. Tell me, what does your ideal day look like?',
          creative: 'The spark of creation burns bright in you! To make something from nothing — that is true magic. Tell me, what does your ideal day look like?',
          balance: 'Harmony across all things — perhaps the most challenging and rewarding path of all. Tell me, what does your ideal day look like?',
        };
        return {
          sageReply: motivationReplies[motivation] || motivationReplies.balance,
          extractedData: { motivation },
          sceneComplete: false,
        };
      }
      // Exchange 2: wakeDescription (text)
      if (!data.wakeDescription) {
        return {
          sageReply: 'I can see it now — a day filled with intention and purpose. That vision will be your compass. Now tell me something harder: what is one thing you\'ve been putting off? Something that nags at the back of your mind, waiting to be faced.',
          extractedData: { wakeDescription: userInput.trim() || 'A day where I make progress on what matters' },
          sceneComplete: false,
        };
      }
      // Exchange 3: procrastinatedTask (text)
      return {
        sageReply: 'I hear you. We all carry those unfinished weights — but acknowledging them is the first step to freedom. The Realm will help you face it, one step at a time. Let us now discover who you truly are.',
        extractedData: { procrastinatedTask: userInput.trim() },
        sceneComplete: true,
      };
    }

    case 'path_selection': {
      const validEsbi: EsbiClass[] = ['E', 'S', 'B', 'I'];
      const esbiId = validEsbi.includes(userInput as EsbiClass) ? userInput as EsbiClass : 'E';
      const pathReplies: Record<EsbiClass, string> = {
        E: 'The Employee path — you build through dedication and mastery within a greater structure. There is honor in becoming indispensable. The Realm has guided many champions down this road. Now let us discover your focus area.',
        S: 'The Self-Employed path — trading your skills directly, answering to none but yourself. Freedom earned through competence. A bold walk. Let us see where your energy flows.',
        B: 'The Business Owner path — building systems that grow beyond you. You think in leverage and scale. The Realm admires those who create empires. Let us discover your focus area.',
        I: 'The Investor path — letting your resources multiply while you focus on what matters most. Patient, strategic, wise. Now let us discover where your passion lies.',
      };
      return {
        sageReply: pathReplies[esbiId],
        extractedData: { esbiClass: esbiId },
        sceneComplete: true,
      };
    }

    case 'identity': {
      // Exchange 1: characterClass (industry card click or text-based class match)
      if (!data.characterClass) {
        const validClasses: CharacterClass[] = ['warrior', 'mage', 'ranger', 'healer', 'engineer'];
        const cls = validClasses.includes(lower as CharacterClass) ? lower as CharacterClass : matchClass(userInput);
        const classReplies: Record<CharacterClass, string> = {
          warrior: `Health & Fitness — an excellent path! Discipline forged in fire, strength honed through perseverance. The Realm shapes itself around those who walk this road. Now, let us forge your true form...`,
          mage: `Education & Research — a seeker of hidden truths! Knowledge itself is the ultimate power. The Realm shapes itself around those who pursue wisdom. Now, let us forge your true form...`,
          ranger: `Business & Finance — masters of opportunity! Strategy and vision guide your path through the world. The Realm shapes itself around those who build empires. Now, let us forge your true form...`,
          healer: `Wellbeing & Healing — guardians of inner peace! Those who mend not just wounds, but souls. The Realm shapes itself around those who uplift others. Now, let us forge your true form...`,
          engineer: `Tech & Building — builders of the impossible! Creation flows through your veins. The Realm shapes itself around those who bring ideas to life. Now, let us forge your true form...`,
        };
        return {
          sageReply: classReplies[cls],
          extractedData: { characterClass: cls },
          classScores: { warrior: 0, mage: 0, ranger: 0, healer: 0, engineer: 0, [cls]: 1 } as Record<CharacterClass, number>,
          sceneComplete: false,
        };
      }
      // Exchange 2: characterName — handled by CharacterCreationPanel now,
      // but keep as fallback for LLM mode text entry
      const name = userInput.trim() || 'Adventurer';
      return {
        sageReply: `${name}... yes, I can feel it resonate through the Realm. A name carries power, and yours shall echo through these halls. Welcome, ${name}. Let us continue your journey.`,
        extractedData: { characterName: name },
        sceneComplete: true,
      };
    }

    case 'first_seed': {
      // Exchange 1: habit name
      if (!data.habitName) {
        const habitName = userInput.trim() || 'Build a daily routine';
        const habitCategory = matchHabitCategory(userInput);
        const categoryInsights: Record<string, string> = {
          health: 'The body remembers what the mind forgets — consistency will transform you.',
          learning: 'Knowledge compounds like interest — each day\'s learning builds upon the last.',
          finance: 'Wealth is built one mindful decision at a time.',
          wellness: 'Inner peace, practiced daily, becomes an unshakable foundation.',
          productivity: 'Small systems, repeated faithfully, move mountains.',
          creative: 'The muse rewards those who show up — create, and inspiration follows.',
        };
        const insight = categoryInsights[habitCategory] || categoryInsights.productivity;
        return {
          sageReply: `"${habitName}" — a powerful seed to plant. ${insight} When would you like to tend to this habit? Morning, afternoon, evening, or anytime?`,
          extractedData: { habitName, habitCategory },
          sceneComplete: false,
        };
      }
      // Exchange 2: habitTimeOfDay
      const timeMatch = lower.match(/\b(morning|afternoon|evening|anytime)\b/);
      const habitTimeOfDay = (timeMatch?.[1] || 'morning') as 'morning' | 'afternoon' | 'evening' | 'anytime';
      const timeReplies: Record<string, string> = {
        morning: 'The dawn hours — when willpower is strongest and the world is still quiet. Excellent timing. Tend this seed daily, and it shall grow into something magnificent.',
        afternoon: 'The heart of the day — a welcome anchor amidst the flow. Tend this seed daily, and watch it transform your afternoons.',
        evening: 'As the day winds down, this ritual will become your reward and your reflection. Tend it faithfully.',
        anytime: 'Flexibility is its own kind of wisdom — you\'ll find the right moment each day. The key is simply showing up.',
      };
      return {
        sageReply: timeReplies[habitTimeOfDay],
        extractedData: { habitTimeOfDay },
        sceneComplete: true,
      };
    }

    case 'the_dream': {
      // Exchange 1: goal title
      if (!data.goalTitle) {
        const goalTitle = userInput.trim() || 'Explore my potential';
        return {
          sageReply: `"${goalTitle}" — that is a vision worth pursuing. Dreams like this have shaped the greatest heroes of the Realm. Every epic journey has a timeline — by when do you imagine reaching this milestone?`,
          extractedData: { goalTitle, goalDescription: goalTitle },
          sceneComplete: false,
        };
      }
      // Exchange 2: goalTimeframe
      const timeframe = userInput.trim();
      return {
        sageReply: `It is inscribed upon the stars. ${timeframe ? `"${timeframe}" — a worthy horizon to aim for.` : 'The path will reveal its own timing.'} The Realm shall hold you accountable and light the way. Now let us chronicle this moment.`,
        extractedData: { goalTimeframe: timeframe },
        sceneComplete: true,
      };
    }

    case 'first_words': {
      const mood = inferMood(userInput);
      const moodReflection = mood >= 4
        ? 'Your words carry a bright warmth — I can feel the energy radiating from them. The Realm recognizes a spirit on the rise.'
        : mood <= 2
          ? 'There is profound courage in speaking your truth, especially when the road feels heavy. The Realm sees your strength, even when you cannot.'
          : 'Honest words, spoken plainly — there is power in that. The Chronicle treasures authenticity above all else.';
      return {
        sageReply: `${moodReflection} These first words will mark the beginning of your story. One day you will look back on them and see how far you have come.`,
        extractedData: { journalContent: userInput, journalMood: mood },
        sceneComplete: true,
      };
    }

    default:
      return { sageReply: 'The Realm awaits.' };
  }
}

// ── Default data for skip path ──

export function getDefaultExtractionData(): ExtractedOnboardingData {
  return {
    motivation: 'balance',
    esbiClass: 'E',
    characterClass: 'warrior',
    characterName: 'Adventurer',
    habitName: 'Build a daily routine',
    habitCategory: 'productivity',
    goalTitle: 'Explore my potential',
    goalDescription: 'Begin the journey of self-improvement and discover what I can achieve.',
    journalContent: 'Today I begin my journey in the Realm. A new chapter awaits.',
    journalMood: 3,
    wakeDescription: 'A day where I make progress on what matters',
    procrastinatedTask: '',
    habitTimeOfDay: 'morning',
    goalTimeframe: '',
  };
}
