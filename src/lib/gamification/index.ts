// LifeOS Gamification Engine — Public API

export { calculateXP, awardXP, recalcUserStats, getStreakMultiplier, getStreakLabel } from './xp-engine';
export type { ActionType, TaskPriority, GoalCategory, XPActionMetadata, XPCalculation, UserStats } from './xp-engine';

export { getLevelFromXP, getLevelProgress, getLevelInfo, getTitleForLevel, getUnlocksForLevel, xpForLevel, xpBetweenLevels, getAllLevels } from './levels';
export type { LevelInfo } from './levels';

export { ACHIEVEMENTS, checkAchievements, getAchievement, RARITY_COLORS, RARITY_LABELS } from './achievements';
export type { Achievement, AchievementRarity, AchievementCategory, UserAchievement } from './achievements';

// ── Quest system (v1 pool-based + v2 contextual) ─────────────────────────────
export {
  // v1 generators (backward compat)
  generateDailyQuests,
  generateWeeklyQuests,
  generateEpicQuests,
  updateQuestProgress,
  getActiveQuests,
  // v2 contextual engine
  generateContextualQuests,
  getContextualQuests,
  completeQuest,
  getQuestTitle,
  getQuestDescription,
  getQuestIcon,
  getPriorityColour,
  getPriorityLabel,
} from './quests';
export type {
  // v1 types
  QuestType,
  QuestTemplate,
  ActiveQuest,
  // v2 types
  ContextualQuest,
  QuestSourceType,
  QuestPriority,
  QuestCategory,
  QuestCompletionResult,
} from './quests';

// ── Plugin hook system ────────────────────────────────────────────────────────
export {
  injectPluginQuest,
  injectPluginQuestBatch,
  getPendingPluginQuests,
  dismissPluginQuest,
  buildTCSInvoiceQuest,
  buildShopifyFulfilmentQuest,
  buildFinanceAlertQuest,
  PLUGIN_IDS,
} from './plugin-hooks';
export type { PluginQuestSuggestion, PluginQuestRecord, PluginId } from './plugin-hooks';

// ── Ladder (Path) system ─────────────────────────────────────────────────────
export {
  LADDERS,
  inferLadderFromCategories,
  inferLadderFromFocus,
  getLadderRank,
  getLadderDisplay,
  getLadder,
} from './ladder';
export type { LadderKey, LadderDefinition } from './ladder';
