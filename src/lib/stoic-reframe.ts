/**
 * Stoic Obstacle Reframing — Marcus Aurelius-inspired goal coaching
 *
 * Pattern-matches common goal blockers to Stoic reframes with practical action steps.
 * Includes a rotating daily Stoic reflection system (30 curated quotes).
 * Pure functions — no React imports.
 */

import type { Goal } from '../types/database';

// ── TYPES ──

export interface StoicReframe {
  obstacle: string;
  reframe: string;
  principle: string;
  action: string;
}

export interface StoicReflection {
  quote: string;
  author: string;
  application: string;
}

// ── STOIC PRINCIPLES ──

export const STOIC_PRINCIPLES = [
  { name: 'The Obstacle Is the Way', text: 'The impediment to action advances action. What stands in the way becomes the way.' },
  { name: 'Dichotomy of Control', text: 'You have power over your mind, not outside events. Realize this and you will find strength.' },
  { name: 'Amor Fati', text: 'Accept the things to which fate binds you, and love the people with whom fate brings you together.' },
  { name: 'Memento Mori', text: 'Think of yourself as dead. You have lived your life. Now take what is left and live it properly.' },
  { name: 'Premeditatio Malorum', text: 'Begin each day by telling yourself: today I shall meet ingratitude, insolence, disloyalty, ill-will, and selfishness.' },
  { name: 'Sympatheia', text: 'What injures the hive injures the bee. We are all working on the same project.' },
  { name: 'Eudaimonia', text: 'The happiness of your life depends upon the quality of your thoughts.' },
  { name: 'Virtue as the Sole Good', text: 'Waste no more time arguing about what a good person should be. Be one.' },
  { name: 'Present Focus', text: 'Never let the future disturb you. You will meet it with the same weapons of reason.' },
  { name: 'Voluntary Discomfort', text: 'We suffer more often in imagination than in reality. Set aside a number of days to practice poverty.' },
  { name: 'Turning the Obstacle', text: 'Choose not to be harmed and you will not feel harmed. Do not feel harmed and you have not been.' },
  { name: 'Inner Citadel', text: 'Retreat into yourself. The rational principle that rules has this nature: it is content with itself when it does what is just.' },
] as const;

// ── BLOCKER PATTERNS ──

interface BlockerPattern {
  keywords: string[];
  principle: string;
  reframe: string;
  action: string;
}

const BLOCKER_PATTERNS: BlockerPattern[] = [
  {
    keywords: ['no time', 'too busy', 'not enough time', 'overwhelmed', 'swamped'],
    principle: 'The Obstacle Is the Way',
    reframe: 'The impediment to action advances action. What you cannot do all at once, do in pieces. Time pressure reveals what truly matters.',
    action: 'Break this goal into a 5-minute daily micro-action. Start there.',
  },
  {
    keywords: ['lost motivation', 'unmotivated', 'no motivation', 'dont feel like', 'lazy', 'apathy'],
    principle: 'Dichotomy of Control',
    reframe: 'You have power over your mind, not outside events. Motivation follows action, not the reverse. Focus on what you control.',
    action: 'Commit to just 2 minutes of effort right now. Momentum builds from motion.',
  },
  {
    keywords: ['fear of failure', 'afraid', 'scared', 'anxious', 'nervous', 'what if i fail'],
    principle: 'The Obstacle Is the Way',
    reframe: 'The obstacle is the way. This difficulty is the training. Every attempt, successful or not, builds the person you need to become.',
    action: 'Define the worst realistic outcome. Then plan one step to mitigate it.',
  },
  {
    keywords: ['too hard', 'impossible', 'cant do', 'beyond me', 'too difficult', 'complicated'],
    principle: 'Voluntary Discomfort',
    reframe: 'We suffer more often in imagination than in reality. Difficulty is what wakes up the genius within.',
    action: 'Identify the single smallest sub-task and complete only that today.',
  },
  {
    keywords: ['perfectionism', 'not good enough', 'not ready', 'not perfect', 'imposter'],
    principle: 'Virtue as the Sole Good',
    reframe: 'Waste no more time arguing about what a good person should be. Be one. Progress over perfection.',
    action: 'Ship a rough version. Iterate tomorrow. Done beats perfect.',
  },
  {
    keywords: ['distracted', 'procrastinating', 'procrastination', 'cant focus', 'shiny object'],
    principle: 'Present Focus',
    reframe: 'Never let the future disturb you. The present moment is the only one you possess. Guard it fiercely.',
    action: 'Set a 25-minute focus block. Remove your phone from the room.',
  },
  {
    keywords: ['no support', 'alone', 'nobody helps', 'isolated', 'no one cares'],
    principle: 'Inner Citadel',
    reframe: 'Retreat into yourself. Your rational mind is your greatest ally. External support is welcome but never required.',
    action: 'Write down 3 resources you already have. Then ask one person for specific help.',
  },
  {
    keywords: ['money', 'expensive', 'cant afford', 'budget', 'financial'],
    principle: 'Amor Fati',
    reframe: 'Love your fate. Constraints breed creativity. The greatest achievements often come from the most limited resources.',
    action: 'List 3 free alternatives or ways to start with zero budget.',
  },
  {
    keywords: ['stuck', 'plateau', 'stagnant', 'no progress', 'spinning wheels'],
    principle: 'Turning the Obstacle',
    reframe: 'Choose not to be harmed and you will not feel harmed. A plateau is your foundation being strengthened. Rest is not regression.',
    action: 'Change one variable in your approach. Try a completely different method for 1 week.',
  },
  {
    keywords: ['comparison', 'behind', 'others are better', 'jealous', 'envious'],
    principle: 'Eudaimonia',
    reframe: 'The happiness of your life depends upon the quality of your thoughts. Your only competition is who you were yesterday.',
    action: 'Delete one social media app for 7 days. Journal your own wins instead.',
  },
];

// ── DAILY STOIC REFLECTIONS ──

const STOIC_QUOTES: StoicReflection[] = [
  { quote: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius', application: 'Before reacting to any situation today, pause and choose your interpretation deliberately.' },
  { quote: 'He who fears death will never do anything worthy of a living man.', author: 'Seneca', application: 'Take one bold action today that fear has been preventing.' },
  { quote: 'No man is free who is not master of himself.', author: 'Epictetus', application: 'Identify one habit or impulse controlling you and exercise discipline over it today.' },
  { quote: 'It is not death that a man should fear, but he should fear never beginning to live.', author: 'Marcus Aurelius', application: 'Start the project or conversation you have been postponing.' },
  { quote: 'Wealth consists not in having great possessions, but in having few wants.', author: 'Epictetus', application: 'Remove one unnecessary item or commitment from your life today.' },
  { quote: 'The best revenge is not to be like your enemy.', author: 'Marcus Aurelius', application: 'When wronged today, respond with the character you aspire to, not the one provoked.' },
  { quote: 'We are more often frightened than hurt; and we suffer more in imagination than in reality.', author: 'Seneca', application: 'Write down your current fear. Then write what would actually happen. Notice the gap.' },
  { quote: 'If it is not right, do not do it. If it is not true, do not say it.', author: 'Marcus Aurelius', application: 'Before each action and word today, apply this simple filter.' },
  { quote: 'Man is not worried by real problems so much as by his imagined anxieties about real problems.', author: 'Epictetus', application: 'Separate facts from stories in one situation causing you stress.' },
  { quote: 'Begin at once to live and count each separate day as a separate life.', author: 'Seneca', application: 'Treat today as complete in itself. What would make today a good life in miniature?' },
  { quote: 'The soul becomes dyed with the colour of its thoughts.', author: 'Marcus Aurelius', application: 'Choose three thoughts to deliberately cultivate today. Return to them when distracted.' },
  { quote: 'It is the power of the mind to be unconquerable.', author: 'Seneca', application: 'When something frustrates you today, observe the frustration without being consumed by it.' },
  { quote: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus', application: 'Write down the person you want to become. Then identify the one action that person would take today.' },
  { quote: 'Loss is nothing else but change, and change is nature\'s delight.', author: 'Marcus Aurelius', application: 'Reframe one loss or ending as a transformation. What is emerging?' },
  { quote: 'Difficulties strengthen the mind, as labor does the body.', author: 'Seneca', application: 'Embrace one difficulty today as deliberate training for your character.' },
  { quote: 'You could leave life right now. Let that determine what you do and say and think.', author: 'Marcus Aurelius', application: 'If this were your last day, what conversation would you have? Have it.' },
  { quote: 'The key is to keep company only with people who uplift you.', author: 'Epictetus', application: 'Spend more time today with someone who makes you better.' },
  { quote: 'It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.', author: 'Seneca', application: 'Dare to attempt one thing you have labeled as too difficult.' },
  { quote: 'When you arise in the morning think of what a privilege it is to be alive, to think, to enjoy, to love.', author: 'Marcus Aurelius', application: 'Before checking your phone tomorrow morning, spend 60 seconds in gratitude.' },
  { quote: 'No person is free who is not master of himself.', author: 'Epictetus', application: 'Practice saying no to one impulse today, however small.' },
  { quote: 'True happiness is to enjoy the present, without anxious dependence upon the future.', author: 'Seneca', application: 'Catch yourself planning or worrying. Return attention to what is directly in front of you.' },
  { quote: 'The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.', author: 'Marcus Aurelius', application: 'Question one belief you hold simply because everyone around you holds it.' },
  { quote: 'Caretake this moment. Immerse yourself in its particulars.', author: 'Epictetus', application: 'During one meal today, eat without screens. Taste every bite.' },
  { quote: 'Hang on to your youthful enthusiasms — you will be able to use them better when you are older.', author: 'Seneca', application: 'Revisit one childhood interest or curiosity. Spend 15 minutes exploring it.' },
  { quote: 'The best way to avenge yourself is to not be like that.', author: 'Marcus Aurelius', application: 'Let go of one grudge today. The weight was yours to carry, not theirs.' },
  { quote: 'Circumstances do not make the man, they reveal him.', author: 'Epictetus', application: 'Notice what today\'s challenges reveal about your character. Which virtues are being tested?' },
  { quote: 'As is a tale, so is life: not how long it is, but how good it is, is what matters.', author: 'Seneca', application: 'Do one thing today purely for its quality, not for speed or productivity.' },
  { quote: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.', author: 'Marcus Aurelius', application: 'When you hear strong opinions today, ask: what perspective might I be missing?' },
  { quote: 'He who laughs at himself never runs out of things to laugh at.', author: 'Epictetus', application: 'Find humor in one of your own mistakes today. Lightness is strength.' },
  { quote: 'Luck is what happens when preparation meets opportunity.', author: 'Seneca', application: 'Prepare for one opportunity you hope will come. Be ready when it arrives.' },
];

// ── PUBLIC API ──

/**
 * Reframe a goal obstacle using Stoic philosophy.
 * Pattern-matches common blockers to Stoic principles and practical actions.
 */
export function reframeObstacle(goalTitle: string, blockerText: string): StoicReframe {
  const lower = blockerText.toLowerCase();

  for (const pattern of BLOCKER_PATTERNS) {
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      return {
        obstacle: blockerText,
        reframe: pattern.reframe,
        principle: pattern.principle,
        action: pattern.action,
      };
    }
  }

  // Default reframe for unrecognized obstacles
  return {
    obstacle: blockerText,
    reframe: 'The impediment to action advances action. Whatever blocks your path to "' + goalTitle + '" is itself the training you need.',
    principle: 'The Obstacle Is the Way',
    action: 'Write down the obstacle in one sentence. Then write what the opposite would look like. Start moving toward the opposite.',
  };
}

/**
 * Get a daily Stoic reflection that rotates through 30 curated quotes.
 * Uses day-of-year modulo 30 for consistent daily rotation.
 */
export function getDailyStoicReflection(): StoicReflection {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const index = dayOfYear % STOIC_QUOTES.length;
  return STOIC_QUOTES[index];
}

/**
 * Get Stoic coaching for a goal that has stalled (no progress in 7+ days).
 * Returns null if the goal is progressing normally.
 */
export function getGoalStoicCoach(goal: Goal): StoicReframe | null {
  if (!goal.updated_at && !goal.created_at) return null;

  const lastActivity = new Date(goal.updated_at || goal.created_at);
  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity < 7) return null;

  // Goal has stalled — provide Stoic coaching
  const stalledDays = daysSinceActivity;
  const principle = STOIC_PRINCIPLES[stalledDays % STOIC_PRINCIPLES.length];

  return {
    obstacle: `"${goal.title}" has had no progress for ${stalledDays} days`,
    reframe: principle.text,
    principle: principle.name,
    action: stalledDays > 30
      ? 'Decide: recommit with a concrete next step, or archive this goal with intention. Both are valid.'
      : 'Spend 5 minutes on this goal today. Just 5 minutes. Momentum follows motion.',
  };
}
