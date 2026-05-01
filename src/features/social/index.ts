// LifeOS Social Features — Barrel Export

// Guild Events & Calendar
export { GuildEvents } from './GuildEvents';
export { guildEventsStyles } from './GuildEvents';
export { useGuildEvents } from './useGuildEvents';
export type {
  GuildEvent,
  GuildEventType,
  GuildEventStatus,
  RSVPStatus,
  EventRecurrence,
  GuildEventRSVP,
  GuildEventResult,
  GuildAnnouncement,
  GuildPoll,
  GuildPollOption,
} from './useGuildEvents';
export { EVENT_TYPE_CONFIG } from './useGuildEvents';

// Guild Announcements
export { GuildAnnouncements } from './GuildAnnouncements';
export { guildAnnouncementsStyles } from './GuildAnnouncements';

// Collaborative Quests
export { CollaborativeQuests } from './CollaborativeQuests';
export { collaborativeQuestsStyles } from './CollaborativeQuests';
export { useCollaborativeQuests } from './useCollaborativeQuests';
export { QUEST_TYPE_CONFIG, DIFFICULTY_CONFIG, QUEST_TEMPLATES } from './useCollaborativeQuests';
export type {
  CollaborativeQuest,
  CollaborativeQuestType,
  QuestDifficulty,
  QuestStatus,
  XPDistribution,
  QuestContribution,
} from './useCollaborativeQuests';

// Guild Wars
export { GuildWars } from './GuildWars';
export { guildWarsStyles } from './GuildWars';
export { WarScoreboard } from './WarScoreboard';
export { warScoreboardStyles } from './WarScoreboard';
export { WarRewards } from './WarRewards';
export { warRewardsStyles } from './WarRewards';
export { WarDeclaration } from './WarDeclaration';
export { warDeclarationStyles } from './WarDeclaration';
export { useGuildWars } from './useGuildWars';
export { WAR_TYPE_CONFIG } from '../../stores/guildWarStore';
export type {
  GuildWar as GuildWarType,
  WarType,
  WarStatus,
  WarReward as WarRewardType,
  WarEvent,
  GuildWarRecord,
  GuildWarRanking,
} from './useGuildWars';

// Social Feed V2
export { SocialFeedV2 } from './SocialFeedV2';
export { socialFeedV2Styles } from './SocialFeedV2';
export { useSocialFeed, autoGenerateFeedItem, FEED_EVENT_CONFIG, REACTION_OPTIONS } from './useSocialFeed';
export type {
  FeedEventType,
  ReactionEmoji,
  FeedVisibility,
  SocialFeedItem,
  FeedComment,
  WeeklySummary,
} from './useSocialFeed';