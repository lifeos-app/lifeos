/**
 * SocialFeed — Activity feed / story system
 *
 * Friends' activity stream, celebration cards, emoji reactions,
 * privacy controls, and daily digest summary.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type FeedEventType =
  | 'streak_milestone'
  | 'level_up'
  | 'habit_logged'
  | 'goal_completed'
  | 'achievement_unlocked'
  | 'journal_entry'
  | 'community_event'
  | 'boss_defeated'
  | 'zone_visited';

export type ReactionEmoji = '👍' | '🔥' | '👏' | '❤️' | '🤯' | '🎉';

export interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  userClassIcon: string;
  userLevel: number;
  eventType: FeedEventType;
  title: string;
  body: string;
  icon: string;
  createdAt: string;
  /** Milestone value (e.g., 30 for 30-day streak) */
  milestoneValue?: number;
  /** Number of reactions by type */
  reactions: Record<ReactionEmoji, number>;
  /** Current user's reaction (if any) */
  myReaction?: ReactionEmoji | null;
  /** Privacy setting */
  visibility: 'friends' | 'public' | 'private';
}

export interface FeedPrivacySettings {
  showStreaks: boolean;
  showLevelUps: boolean;
  showHabits: boolean;
  showGoals: boolean;
  showAchievements: boolean;
  showJournalEntries: boolean;
  defaultVisibility: 'friends' | 'public' | 'private';
}

export interface DailyDigestCard {
  date: string;
  totalActivities: number;
  friendMilestones: number;
  achievementsUnlocked: number;
  levelUps: number;
  bossDefeats: number;
  topFriend: string;
  topFriendActivity: string;
}

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const EVENT_CONFIG: Record<FeedEventType, { icon: string; bgColor: string; verb: string }> = {
  streak_milestone: { icon: '🔥', bgColor: '#F97316', verb: 'completed a' },
  level_up: { icon: '⬆️', bgColor: '#3B82F6', verb: 'leveled up to' },
  habit_logged: { icon: '✅', bgColor: '#10B981', verb: 'logged a habit:' },
  goal_completed: { icon: '🏆', bgColor: '#EAB308', verb: 'completed a goal:' },
  achievement_unlocked: { icon: '🏅', bgColor: '#8B5CF6', verb: 'unlocked an achievement:' },
  journal_entry: { icon: '📓', bgColor: '#EC4899', verb: 'wrote in their journal' },
  community_event: { icon: '🌌', bgColor: '#06B6D4', verb: 'participated in' },
  boss_defeated: { icon: '⚔️', bgColor: '#EF4444', verb: 'defeated the' },
  zone_visited: { icon: '🗺️', bgColor: '#64748B', verb: 'explored' },
};

const REACTION_OPTIONS: ReactionEmoji[] = ['👍', '🔥', '👏', '❤️', '🤯', '🎉'];

// ═══════════════════════════════════════════════════
// SIMULATED FEED DATA (for demo, replace with real data)
// ═══════════════════════════════════════════════════

function generateDemoFeed(): FeedItem[] {
  const now = Date.now();
  return [
    {
      id: 'feed-1',
      userId: 'alex',
      userName: 'Alex',
      userClassIcon: '⚔️',
      userLevel: 15,
      eventType: 'streak_milestone',
      title: '30-Day Streak! 🔥',
      body: 'Alex completed a 30-day habit streak!',
      icon: '🔥',
      createdAt: new Date(now - 3600000).toISOString(),
      milestoneValue: 30,
      reactions: { '👍': 5, '🔥': 12, '👏': 3, '❤️': 2, '🤯': 1, '🎉': 4 },
      visibility: 'public',
    },
    {
      id: 'feed-2',
      userId: 'sam',
      userName: 'Sam',
      userClassIcon: '📚',
      userLevel: 18,
      eventType: 'level_up',
      title: 'Level 15!',
      body: 'Sam hit Level 15!',
      icon: '⬆️',
      createdAt: new Date(now - 7200000).toISOString(),
      milestoneValue: 15,
      reactions: { '👍': 8, '🔥': 3, '👏': 6, '❤️': 4, '🤯': 0, '🎉': 2 },
      visibility: 'friends',
    },
    {
      id: 'feed-3',
      userId: 'jordan',
      userName: 'Jordan',
      userClassIcon: '🎯',
      userLevel: 12,
      eventType: 'habit_logged',
      title: '100th Habit!',
      body: 'Jordan logged their 100th habit!',
      icon: '✅',
      createdAt: new Date(now - 14400000).toISOString(),
      milestoneValue: 100,
      reactions: { '👍': 2, '🔥': 6, '👏': 1, '❤️': 0, '🤯': 3, '🎉': 1 },
      visibility: 'public',
    },
  ];
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

interface SocialFeedProps {
  currentUserId?: string;
  /** Limit items shown */
  maxItems?: number;
  /** Whether to show the daily digest card */
  showDigest?: boolean;
}

export function SocialFeed({
  currentUserId,
  maxItems = 20,
  showDigest = true,
}: SocialFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<FeedPrivacySettings>({
    showStreaks: true,
    showLevelUps: true,
    showHabits: true,
    showGoals: true,
    showAchievements: true,
    showJournalEntries: false,
    defaultVisibility: 'friends',
  });
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);

  // Load feed data
  useEffect(() => {
    // In production: fetch from Supabase
    // For now: use demo data
    setFeedItems(generateDemoFeed());
  }, []);

  // React to a feed item
  const handleReact = useCallback((itemId: string, emoji: ReactionEmoji) => {
    setFeedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newReactions = { ...item.reactions };

      // If user already reacted with this emoji, un-react
      if (item.myReaction === emoji) {
        newReactions[emoji] = Math.max(0, (newReactions[emoji] || 0) - 1);
        return { ...item, reactions: newReactions, myReaction: null };
      }

      // Remove previous reaction if different
      if (item.myReaction && item.myReaction !== emoji) {
        newReactions[item.myReaction] = Math.max(0, (newReactions[item.myReaction] || 0) - 1);
      }

      // Add new reaction
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      return { ...item, reactions: newReactions, myReaction: emoji };
    }));
    setShowReactionsFor(null);
  }, []);

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Daily digest summary
  const digestCard: DailyDigestCard = {
    date: new Date().toLocaleDateString(),
    totalActivities: feedItems.length,
    friendMilestones: feedItems.filter(f => f.eventType === 'streak_milestone').length,
    achievementsUnlocked: feedItems.filter(f => f.eventType === 'achievement_unlocked').length,
    levelUps: feedItems.filter(f => f.eventType === 'level_up').length,
    bossDefeats: feedItems.filter(f => f.eventType === 'boss_defeated').length,
    topFriend: feedItems[0]?.userName ?? '—',
    topFriendActivity: feedItems[0]?.title ?? 'No activity yet',
  };

  const visibleItems = feedItems.slice(0, maxItems);

  return (
    <div className="social-feed">
      {/* Header */}
      <div className="social-feed-header">
        <h2 className="social-feed-title">Activity Feed</h2>
        <button
          className="social-feed-privacy-btn"
          onClick={() => setShowPrivacySettings(!showPrivacySettings)}
          title="Privacy settings"
        >
          🔒
        </button>
      </div>

      {/* Daily Digest Card */}
      {showDigest && (
        <div className="social-feed-digest">
          <div className="social-feed-digest-header">
            <span className="social-feed-digest-icon">📊</span>
            <span className="social-feed-digest-title">Today's Digest</span>
            <span className="social-feed-digest-date">{digestCard.date}</span>
          </div>
          <div className="social-feed-digest-stats">
            <div className="social-feed-digest-stat">
              <span className="social-feed-digest-stat-value">{digestCard.totalActivities}</span>
              <span className="social-feed-digest-stat-label">Activities</span>
            </div>
            <div className="social-feed-digest-stat">
              <span className="social-feed-digest-stat-value">{digestCard.friendMilestones}</span>
              <span className="social-feed-digest-stat-label">Milestones</span>
            </div>
            <div className="social-feed-digest-stat">
              <span className="social-feed-digest-stat-value">{digestCard.levelUps}</span>
              <span className="social-feed-digest-stat-label">Level Ups</span>
            </div>
            <div className="social-feed-digest-stat">
              <span className="social-feed-digest-stat-value">{digestCard.achievementsUnlocked}</span>
              <span className="social-feed-digest-stat-label">Achievements</span>
            </div>
          </div>
          {digestCard.topFriend !== '—' && (
            <div className="social-feed-digest-highlight">
              🌟 <strong>{digestCard.topFriend}</strong>: {digestCard.topFriendActivity}
            </div>
          )}
        </div>
      )}

      {/* Privacy Settings Panel */}
      {showPrivacySettings && (
        <div className="social-feed-privacy">
          <h4 className="social-feed-privacy-title">Feed Privacy Settings</h4>
          <p className="social-feed-privacy-subtitle">Choose what appears in friends' feeds</p>
          {([
            ['showStreaks', 'Streak milestones'],
            ['showLevelUps', 'Level ups'],
            ['showHabits', 'Habit logs'],
            ['showGoals', 'Goal completions'],
            ['showAchievements', 'Achievements'],
            ['showJournalEntries', 'Journal entries'],
          ] as const).map(([key, label]) => (
            <label key={key} className="social-feed-privacy-row">
              <input
                type="checkbox"
                checked={privacySettings[key]}
                onChange={() => setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }))}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className="social-feed-privacy-divider" />
          <label className="social-feed-privacy-row">
            <span>Default visibility:</span>
            <select
              value={privacySettings.defaultVisibility}
              onChange={(e) => setPrivacySettings(prev => ({
                ...prev,
                defaultVisibility: e.target.value as FeedPrivacySettings['defaultVisibility'],
              }))}
              className="social-feed-privacy-select"
            >
              <option value="friends">Friends only</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>
      )}

      {/* Feed Items */}
      <div className="social-feed-items">
        {visibleItems.length === 0 && (
          <div className="social-feed-empty">
            <div className="social-feed-empty-icon">🌱</div>
            <p>No activity yet. Add friends to see their progress here!</p>
          </div>
        )}
        {visibleItems.map(item => {
          const config = EVENT_CONFIG[item.eventType];
          const isMilestone = item.eventType === 'streak_milestone' || item.eventType === 'level_up' || item.eventType === 'achievement_unlocked';

          return (
            <div
              key={item.id}
              className={`social-feed-card ${isMilestone ? 'social-feed-card--celebration' : ''}`}
            >
              {/* Celebration card for milestones */}
              {isMilestone && (
                <div className="social-feed-card-sparkle">✨</div>
              )}

              <div className="social-feed-card-header">
                <div
                  className="social-feed-card-avatar"
                  style={{ background: config.bgColor }}
                >
                  {item.userClassIcon}
                </div>
                <div className="social-feed-card-info">
                  <span className="social-feed-card-name">{item.userName}</span>
                  <span className="social-feed-card-level">Lv.{item.userLevel}</span>
                  <span className="social-feed-card-time">{formatTimeAgo(item.createdAt)}</span>
                </div>
                <span className="social-feed-card-icon">{item.icon}</span>
              </div>

              <div className="social-feed-card-body">
                <span className="social-feed-card-title">{item.title}</span>
                <p className="social-feed-card-text">{item.body}</p>
                {item.milestoneValue && (
                  <span className="social-feed-card-milestone">
                    {item.icon} {item.milestoneValue}
                  </span>
                )}
              </div>

              {/* Reactions */}
              <div className="social-feed-card-reactions">
                {/* Existing reactions */}
                {(Object.entries(item.reactions) as [ReactionEmoji, number][])
                  .filter(([, count]) => count > 0)
                  .map(([emoji, count]) => (
                    <button
                      key={emoji}
                      className={`social-feed-reaction ${item.myReaction === emoji ? 'social-feed-reaction--active' : ''}`}
                      onClick={() => handleReact(item.id, emoji)}
                    >
                      {emoji} {count}
                    </button>
                  ))
                }
                {/* Add reaction button */}
                <button
                  className="social-feed-reaction-add"
                  onClick={() => setShowReactionsFor(showReactionsFor === item.id ? null : item.id)}
                >
                  +
                </button>
                {showReactionsFor === item.id && (
                  <div className="social-feed-reaction-picker">
                    {REACTION_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        className="social-feed-reaction-pick"
                        onClick={() => handleReact(item.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .social-feed {
          max-width: 600px;
          margin: 0 auto;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .social-feed-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
        }
        .social-feed-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }
        .social-feed-privacy-btn {
          background: none;
          border: none;
          font-size: 1.1rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        /* Daily Digest */
        .social-feed-digest {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 1rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        .social-feed-digest-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .social-feed-digest-icon { font-size: 1.25rem; }
        .social-feed-digest-title {
          font-weight: 600;
          color: white;
          font-size: 0.9rem;
        }
        .social-feed-digest-date {
          margin-left: auto;
          font-size: 0.75rem;
          color: #94a3b8;
        }
        .social-feed-digest-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }
        .social-feed-digest-stat {
          text-align: center;
          padding: 0.5rem;
          background: rgba(255,255,255,0.05);
          border-radius: 0.5rem;
        }
        .social-feed-digest-stat-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #60a5fa;
        }
        .social-feed-digest-stat-label {
          display: block;
          font-size: 0.65rem;
          color: #94a3b8;
          margin-top: 0.15rem;
        }
        .social-feed-digest-highlight {
          margin-top: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: rgba(234,179,8,0.1);
          border-radius: 0.5rem;
          font-size: 0.8rem;
          color: #fbbf24;
        }

        /* Privacy Settings */
        .social-feed-privacy {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }
        .social-feed-privacy-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: white;
          margin: 0 0 0.25rem 0;
        }
        .social-feed-privacy-subtitle {
          font-size: 0.7rem;
          color: #94a3b8;
          margin: 0 0 0.75rem 0;
        }
        .social-feed-privacy-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: #e2e8f0;
          padding: 0.2rem 0;
          cursor: pointer;
        }
        .social-feed-privacy-row input[type="checkbox"] {
          accent-color: #3b82f6;
        }
        .social-feed-privacy-divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 0.5rem 0;
        }
        .social-feed-privacy-select {
          margin-left: 0.5rem;
          background: #0f172a;
          color: white;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 0.25rem;
          padding: 0.2rem 0.5rem;
          font-size: 0.75rem;
        }

        /* Feed Cards */
        .social-feed-items {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .social-feed-empty {
          text-align: center;
          padding: 3rem 1rem;
          color: #64748b;
        }
        .social-feed-empty-icon {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }
        .social-feed-empty p {
          font-size: 0.85rem;
          margin: 0;
        }
        .social-feed-card {
          position: relative;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.75rem;
          padding: 0.75rem;
          transition: border-color 0.15s;
        }
        .social-feed-card:hover {
          border-color: rgba(255,255,255,0.15);
        }
        .social-feed-card--celebration {
          border-color: rgba(234,179,8,0.3);
          background: linear-gradient(135deg, #1e293b 0%, rgba(234,179,8,0.05) 100%);
        }
        .social-feed-card-sparkle {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          font-size: 1rem;
        }
        .social-feed-card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .social-feed-card-avatar {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          flex-shrink: 0;
        }
        .social-feed-card-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .social-feed-card-name {
          font-weight: 600;
          font-size: 0.85rem;
          color: white;
        }
        .social-feed-card-level {
          font-size: 0.7rem;
          color: #94a3b8;
          background: rgba(255,255,255,0.05);
          padding: 0.1rem 0.35rem;
          border-radius: 9999px;
        }
        .social-feed-card-time {
          font-size: 0.65rem;
          color: #64748b;
        }
        .social-feed-card-icon {
          font-size: 1.25rem;
        }
        .social-feed-card-body {
          margin-left: 2.5rem;
        }
        .social-feed-card-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: white;
        }
        .social-feed-card-text {
          font-size: 0.8rem;
          color: #94a3b8;
          margin: 0.15rem 0 0 0;
        }
        .social-feed-card-milestone {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(234,179,8,0.1);
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          margin-top: 0.25rem;
        }

        /* Reactions */
        .social-feed-card-reactions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.5rem;
          margin-left: 2.5rem;
          align-items: center;
        }
        .social-feed-reaction {
          display: inline-flex;
          align-items: center;
          gap: 0.15rem;
          font-size: 0.75rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9999px;
          padding: 0.2rem 0.5rem;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.15s;
        }
        .social-feed-reaction:hover {
          background: rgba(255,255,255,0.1);
        }
        .social-feed-reaction--active {
          background: rgba(59,130,246,0.15);
          border-color: rgba(59,130,246,0.3);
          color: #60a5fa;
        }
        .social-feed-reaction-add {
          font-size: 0.75rem;
          background: none;
          border: 1px dashed rgba(255,255,255,0.15);
          border-radius: 9999px;
          padding: 0.2rem 0.5rem;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }
        .social-feed-reaction-add:hover {
          border-color: rgba(255,255,255,0.3);
          color: #94a3b8;
        }
        .social-feed-reaction-picker {
          display: flex;
          gap: 0.25rem;
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 9999px;
          padding: 0.2rem 0.4rem;
          position: relative;
          z-index: 10;
        }
        .social-feed-reaction-pick {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          padding: 0.15rem;
          border-radius: 50%;
          transition: background 0.1s;
        }
        .social-feed-reaction-pick:hover {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}