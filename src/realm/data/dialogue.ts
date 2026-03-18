/**
 * NPC Dialogue — The Realm
 *
 * Pure template functions that generate dialogue lines from real store data.
 * RPG-flavored, no AI/LLM — just conditional string interpolation.
 */

import type { CharacterClass } from '../../rpg/engine/types';

export interface NPCDialogueContext {
  moodScore: number;
  energyScore: number;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  activeGoals: { title: string; progress: number }[];
  completedGoals: number;
  habits: { name: string; streak: number; category: string }[];
  bestStreak: number;
  journalCount: number;
  overdueTasks: number;
  netBalance: number;
  playerLevel: number;
  playerClass: CharacterClass;
}

type DialogueFn = (ctx: NPCDialogueContext) => string[];

const DIALOGUE: Record<string, DialogueFn> = {
  // ── The Guide ─────────────────────────────────
  the_guide: (ctx) => {
    const lines: string[] = [];
    const hour = new Date().getHours();

    if (hour < 6) lines.push('Burning the midnight oil, adventurer? The world sleeps but you press on.');
    else if (hour < 12) lines.push('Good morning, traveler. The dawn brings new possibilities.');
    else if (hour < 18) lines.push('The afternoon sun is high. How fares your journey today?');
    else lines.push('Evening falls upon the realm. Time to reflect on the day\'s deeds.');

    if (ctx.playerLevel <= 3) {
      lines.push('You\'re just beginning your journey. Explore the town — each building holds purpose.');
      lines.push('Visit the garden to see your habits take root. The bulletin board tracks your quests.');
    } else if (ctx.playerLevel <= 10) {
      lines.push(`Level ${ctx.playerLevel} already! Your dedication shapes this world.`);
    } else {
      lines.push(`A level ${ctx.playerLevel} ${ctx.playerClass}... few have come this far. The realm respects your commitment.`);
    }

    if (ctx.overdueTasks > 0) {
      lines.push(`I sense ${ctx.overdueTasks} unfinished task${ctx.overdueTasks > 1 ? 's' : ''} weighing on you. Shadows stir near the bulletin board...`);
    }

    if (ctx.bestStreak >= 30) {
      lines.push(`A ${ctx.bestStreak}-day streak! Your garden must be magnificent.`);
    }

    lines.push('Remember: this world grows with your life. Every action echoes here.');
    return lines;
  },

  // ── Healer ────────────────────────────────────
  healer_npc: (ctx) => {
    const lines: string[] = ['Welcome to my sanctuary, dear one. Let me see how you fare...'];

    if (ctx.sleepHours !== null) {
      if (ctx.sleepHours < 6) {
        lines.push(`Only ${ctx.sleepHours} hours of rest? The body is a temple, and yours needs tending.`);
        lines.push('Try to find your bed before the stars reach their zenith tonight.');
      } else if (ctx.sleepHours >= 8) {
        lines.push(`${ctx.sleepHours} hours of sleep — excellent! A well-rested warrior fights twice as well.`);
      } else {
        lines.push(`${ctx.sleepHours} hours of rest. Adequate, but more would strengthen your resolve.`);
      }
    } else {
      lines.push('I cannot read your vitals... Have you logged your health today?');
    }

    if (ctx.exerciseMinutes !== null) {
      if (ctx.exerciseMinutes >= 30) {
        lines.push(`${ctx.exerciseMinutes} minutes of training today! Your body grows stronger.`);
      } else if (ctx.exerciseMinutes > 0) {
        lines.push(`${ctx.exerciseMinutes} minutes of exercise. Every step counts, but aim for more.`);
      }
    }

    if (ctx.moodScore <= 2) {
      lines.push('I sense a heaviness in your spirit. The rain outside mirrors your heart.');
      lines.push('Be gentle with yourself. Even the mightiest heroes need rest.');
    } else if (ctx.moodScore >= 4) {
      lines.push('Your spirit shines bright today! That radiance heals all around you.');
    }

    if (ctx.energyScore <= 2) {
      lines.push('Your energy wanes... Rest, nourish yourself, and return when ready.');
    }

    return lines;
  },

  // ── Blacksmith ────────────────────────────────
  blacksmith_npc: (ctx) => {
    const lines: string[] = [];

    if (ctx.activeGoals.length === 0) {
      lines.push('The forge is cold. Bring me a goal to work on!');
      lines.push('Without projects, my anvil gathers dust. Set a goal in LifeOS to ignite the flame.');
    } else {
      lines.push(`${ctx.activeGoals.length} project${ctx.activeGoals.length > 1 ? 's' : ''} at the forge! Which shall we hammer today?`);

      // Show top goals
      for (const goal of ctx.activeGoals.slice(0, 3)) {
        const pct = Math.round(goal.progress * 100);
        if (pct >= 80) {
          lines.push(`"${goal.title}" — nearly complete at ${pct}%! One final push!`);
        } else if (pct >= 50) {
          lines.push(`"${goal.title}" — halfway forged at ${pct}%. Keep hammering!`);
        } else {
          lines.push(`"${goal.title}" — still raw iron at ${pct}%. Patience shapes the blade.`);
        }
      }
    }

    if (ctx.completedGoals > 0) {
      lines.push(`You've completed ${ctx.completedGoals} project${ctx.completedGoals > 1 ? 's' : ''} in total. Fine craftsmanship!`);
    }

    return lines;
  },

  // ── Librarian ─────────────────────────────────
  librarian_npc: (ctx) => {
    const lines: string[] = [];

    if (ctx.journalCount === 0) {
      lines.push('The shelves stand empty, waiting for your words.');
      lines.push('Write your first journal entry to place a tome upon these shelves.');
    } else if (ctx.journalCount < 10) {
      lines.push(`Your library holds ${ctx.journalCount} tome${ctx.journalCount > 1 ? 's' : ''} of wisdom. A modest but promising start.`);
      lines.push('Each entry you write adds another volume to this collection.');
    } else if (ctx.journalCount < 50) {
      lines.push(`${ctx.journalCount} tomes line these shelves! A respectable library grows before my eyes.`);
      lines.push('The echoes of your thoughts wander among the stacks...');
    } else if (ctx.journalCount < 100) {
      lines.push(`${ctx.journalCount} volumes! You could rival the great archives of the realm.`);
      lines.push('Your journal echoes have begun appearing near the library. They are drawn to your wisdom.');
    } else {
      lines.push(`${ctx.journalCount} tomes! This is a grand library worthy of legend.`);
      lines.push('The very walls glow with accumulated knowledge. Scholars would journey far to see this collection.');
    }

    if (ctx.bestStreak >= 7) {
      lines.push('Consistency is the ink of wisdom. Your streaks prove you understand this truth.');
    }

    return lines;
  },

  // ── Merchant ──────────────────────────────────
  merchant_npc: (ctx) => {
    const lines: string[] = [];

    lines.push('Welcome, welcome! Step right up to the finest market in all the realm!');

    if (ctx.netBalance > 0) {
      lines.push(`Business is thriving! A surplus of ${ctx.netBalance.toLocaleString()} coins this month.`);
      lines.push('Keep those coffers growing, my friend. Prosperity suits you well!');
    } else if (ctx.netBalance < 0) {
      lines.push(`The coffers run low... ${Math.abs(ctx.netBalance).toLocaleString()} coins in the red this month.`);
      lines.push('Perhaps review your expenditures? Even merchants must watch the bottom line.');
    } else {
      lines.push('I haven\'t seen your ledger yet. Track some expenses or income in LifeOS!');
    }

    if (ctx.habits.length > 0) {
      const finHabits = ctx.habits.filter(h => h.category === 'finance');
      if (finHabits.length > 0) {
        lines.push(`I see you have ${finHabits.length} financial habit${finHabits.length > 1 ? 's' : ''}. Smart thinking!`);
      }
    }

    return lines;
  },

  // ── Sage ──────────────────────────────────────
  sage_npc: (ctx) => {
    const lines: string[] = [];

    lines.push('Hmm... *strokes beard* ...I have been observing your journey with great interest.');

    // Overall assessment based on multiple factors
    const score = (
      (ctx.moodScore >= 4 ? 2 : ctx.moodScore >= 3 ? 1 : 0) +
      (ctx.bestStreak >= 7 ? 2 : ctx.bestStreak >= 1 ? 1 : 0) +
      (ctx.activeGoals.length >= 1 ? 1 : 0) +
      (ctx.journalCount >= 5 ? 1 : 0) +
      (ctx.overdueTasks === 0 ? 1 : 0)
    );

    if (score >= 6) {
      lines.push('Your life flows in harmony. Habits, goals, health, reflection — all in balance.');
      lines.push('You have achieved what many seek: a rhythm that sustains growth.');
    } else if (score >= 4) {
      lines.push('Good progress on your path. Some areas flourish while others wait for attention.');
      lines.push('Focus on what\'s lacking — the journey rewards balance above all.');
    } else if (score >= 2) {
      lines.push('The path is long, and you have taken the first steps. Do not lose heart.');
      lines.push('Start small. One habit, one goal, one journal entry. The realm responds to even the smallest effort.');
    } else {
      lines.push('Your realm reflects a life in transition. Change begins with a single step.');
      lines.push('Try logging your mood, or writing a journal entry. Watch how the world shifts.');
    }

    if (ctx.habits.length > 5) {
      lines.push(`${ctx.habits.length} habits at once? Wisdom lies in focus. Tend fewer gardens deeply rather than many shallowly.`);
    }

    if (ctx.playerLevel >= 20) {
      lines.push(`At level ${ctx.playerLevel}, you\'ve earned the right to call yourself a master of your domain.`);
    }

    return lines;
  },
};

/**
 * Get dialogue lines for an NPC based on current player/world context.
 */
export function getNPCDialogue(npcId: string, ctx: NPCDialogueContext): string[] {
  const fn = DIALOGUE[npcId];
  if (fn) return fn(ctx);

  // Fallback for unknown NPCs
  return [
    'Greetings, adventurer.',
    'The realm holds many secrets. Keep exploring.',
  ];
}
