/**
 * RealmInsightLeaker — NPC insight extraction for use outside The Realm
 *
 * Pure template functions returning 1-2 sentence strings.
 * Each NPC picks the single most relevant observation from their domain.
 */

import type { NPCDialogueContext } from '../data/dialogue';

export function getHealerInsight(ctx: NPCDialogueContext): string {
  if (ctx.sleepHours !== null && ctx.sleepHours < 6) {
    return `The Healer worries: only ${ctx.sleepHours}h of sleep last night. Rest is the foundation of all power.`;
  }
  if (ctx.energyScore <= 2) {
    return 'The Healer senses your energy is fading. Take a break and recharge.';
  }
  if (ctx.moodScore <= 2) {
    return 'The Healer feels a heaviness in your spirit. Be gentle with yourself today.';
  }
  if (ctx.exerciseMinutes !== null && ctx.exerciseMinutes >= 30) {
    return `The Healer is pleased: ${ctx.exerciseMinutes} minutes of training today. Your body grows stronger!`;
  }
  if (ctx.moodScore >= 4) {
    return 'The Healer says: your spirit shines bright today. That radiance heals all around you.';
  }
  return 'The Healer reminds you: log your health to keep the sanctuary glowing.';
}

export function getBlacksmithInsight(ctx: NPCDialogueContext): string {
  if (ctx.activeGoals.length === 0) {
    return 'The Blacksmith\'s forge is cold. Set a goal to ignite the flame!';
  }
  const top = ctx.activeGoals[0];
  const pct = Math.round(top.progress * 100);
  if (pct >= 80) {
    return `The Blacksmith says: "${top.title}" is nearly complete at ${pct}%. One final push!`;
  }
  if (ctx.activeGoals.length >= 3) {
    return `The Blacksmith hammers away on ${ctx.activeGoals.length} projects. Focus brings mastery.`;
  }
  return `The Blacksmith is forging "${top.title}" — keep hammering!`;
}

export function getLibrarianInsight(ctx: NPCDialogueContext): string {
  if (ctx.journalCount === 0) {
    return 'The Librarian\'s shelves stand empty. Write your first entry to begin the collection.';
  }
  if (ctx.journalCount >= 100) {
    return `The Librarian marvels: ${ctx.journalCount} tomes! A library worthy of legend.`;
  }
  if (ctx.journalCount >= 50) {
    return `The Librarian admires your ${ctx.journalCount} volumes. Wisdom takes form in your words.`;
  }
  return `The Librarian tends ${ctx.journalCount} tome${ctx.journalCount !== 1 ? 's' : ''}. Each entry adds to your legacy.`;
}

export function getMerchantInsight(ctx: NPCDialogueContext): string {
  if (ctx.netBalance > 0) {
    return `The Merchant grins: a surplus of ${ctx.netBalance.toLocaleString()} coins this month. Prosperity suits you!`;
  }
  if (ctx.netBalance < 0) {
    return `The Merchant frowns: ${Math.abs(ctx.netBalance).toLocaleString()} coins in the red. Review your expenditures.`;
  }
  return 'The Merchant awaits your ledger. Track expenses or income to see the market thrive!';
}

function getGuideInsight(ctx: NPCDialogueContext): string {
  if (ctx.overdueTasks > 0) {
    return `The Guide warns: ${ctx.overdueTasks} unfinished task${ctx.overdueTasks !== 1 ? 's' : ''} stir shadows near the bulletin board.`;
  }
  if (ctx.bestStreak >= 30) {
    return `The Guide nods: a ${ctx.bestStreak}-day streak. Your dedication shapes the realm itself.`;
  }
  return 'The Guide says: every action in your life echoes here. Keep moving forward.';
}

function getSageInsight(ctx: NPCDialogueContext): string {
  const score = (
    (ctx.moodScore >= 4 ? 2 : ctx.moodScore >= 3 ? 1 : 0) +
    (ctx.bestStreak >= 7 ? 2 : ctx.bestStreak >= 1 ? 1 : 0) +
    (ctx.activeGoals.length >= 1 ? 1 : 0) +
    (ctx.journalCount >= 5 ? 1 : 0) +
    (ctx.overdueTasks === 0 ? 1 : 0)
  );

  if (score >= 6) {
    return 'The Sage observes: your life flows in harmony. Habits, goals, health — all in balance.';
  }
  if (score >= 4) {
    return 'The Sage notes: good progress. Some areas flourish while others wait for attention.';
  }
  return 'The Sage counsels: start small. One habit, one goal, one journal entry. The realm responds.';
}

const NPC_MAP: Record<number, { name: string; icon: string; fn: (ctx: NPCDialogueContext) => string }> = {
  1: { name: 'The Healer', icon: '✨', fn: getHealerInsight },     // Monday
  2: { name: 'The Blacksmith', icon: '⚒️', fn: getBlacksmithInsight }, // Tuesday
  3: { name: 'The Librarian', icon: '📚', fn: getLibrarianInsight },   // Wednesday
  4: { name: 'The Merchant', icon: '🪙', fn: getMerchantInsight },     // Thursday
  5: { name: 'The Guide', icon: '🧭', fn: getGuideInsight },           // Friday
  6: { name: 'The Sage', icon: '🔮', fn: getSageInsight },             // Saturday
  0: { name: 'The Sage', icon: '🔮', fn: getSageInsight },             // Sunday
};

/**
 * Get the daily rotating NPC insight.
 */
export function getDailyInsight(
  dayOfWeek: number,
  ctx: NPCDialogueContext,
): { npcName: string; npcIcon: string; insight: string } {
  const npc = NPC_MAP[dayOfWeek] || NPC_MAP[1];
  return {
    npcName: npc.name,
    npcIcon: npc.icon,
    insight: npc.fn(ctx),
  };
}
