// LifeOS Gamification — Quest Board Component
// v2: Supports time indicators, work category, cleaner mobile layout
//
// Renders daily, weekly, and epic quests.
// Supports both v1 (pool-based) and v2 (contextual) quests.

import React, { useState, useCallback } from 'react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { CheckCircle2, Zap, Sun, Calendar, ClipboardList, RefreshCw, Target, Wallet, Plug, Clock } from 'lucide-react';
import type { ActiveQuest } from '../../lib/gamification/quests';
import type { ContextualQuest, QuestPriority } from '../../lib/gamification/quest-engine-v2';
import {
  getQuestTitle,
  getQuestDescription,
  getQuestIcon,
  getPriorityColour,
  getPriorityLabel,
} from '../../lib/gamification/quest-engine-v2';
import { completeQuest } from '../../lib/gamification/quest-completion';
import type { QuestCompletionResult } from '../../lib/gamification/quest-completion';
import { supabase } from '../../lib/supabase';
import './gamification.css';
import { logger } from '../../utils/logger';

// ── TYPES ──────────────────────────────────────────────────────────────────────

type AnyQuest = ActiveQuest | ContextualQuest;

interface QuestBoardProps {
  dailyQuests: AnyQuest[];
  weeklyQuests: AnyQuest[];
  epicQuests?: AnyQuest[];
  showEpic?: boolean;
  userId?: string;
  onQuestComplete?: (result: QuestCompletionResult, quest: AnyQuest) => void;
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

function isContextualQuest(quest: AnyQuest): quest is ContextualQuest {
  return 'source_type' in quest && (quest as ContextualQuest).source_type !== undefined;
}

function getDisplayTitle(quest: AnyQuest): string {
  if (isContextualQuest(quest)) return getQuestTitle(quest);
  return quest.quest_data?.title ?? 'Quest';
}

function getDisplayDescription(quest: AnyQuest): string {
  if (isContextualQuest(quest)) return getQuestDescription(quest);
  return quest.quest_data?.description ?? '';
}

function getDisplayIcon(quest: AnyQuest): string {
  if (isContextualQuest(quest)) return getQuestIcon(quest);
  return quest.quest_data?.icon ?? '📋';
}

function getQuestPriority(quest: AnyQuest): QuestPriority | null {
  if (isContextualQuest(quest) && quest.priority) return quest.priority;
  return null;
}

function getContextLabel(quest: AnyQuest): string {
  if (isContextualQuest(quest)) return quest.context_label ?? '';
  return '';
}

function getSourceBadgeIcon(quest: AnyQuest): React.ReactNode {
  if (!isContextualQuest(quest)) return null;
  switch (quest.source_type) {
    case 'task':    return <ClipboardList size={11} />;
    case 'habit':   return <RefreshCw size={11} />;
    case 'goal':    return <Target size={11} />;
    case 'finance': return <Wallet size={11} />;
    case 'plugin':  return <Plug size={11} />;
    case 'system':  return null;
    default:        return null;
  }
}

/** Check if a quest has a scheduled time (from expires_at or description) */
function getQuestTime(quest: AnyQuest): string | null {
  // v2 quests: check description for time patterns
  const desc = getDisplayDescription(quest);
  const timeMatch = desc.match(/Due (today|tomorrow|in \d+ days?)/i);
  if (timeMatch) return timeMatch[0];

  // Check expires_at for same-day expiry
  if (quest.expires_at) {
    const expires = new Date(quest.expires_at);
    const now = new Date();
    if (expires.toDateString() === now.toDateString()) {
      return `Expires ${expires.getHours()}:${String(expires.getMinutes()).padStart(2, '0')}`;
    }
  }
  return null;
}

// ── QUEST BOARD ────────────────────────────────────────────────────────────────

export function QuestBoard({
  dailyQuests,
  weeklyQuests,
  epicQuests = [],
  showEpic = false,
  userId,
  onQuestComplete,
}: QuestBoardProps) {
  const [completing, setCompleting] = useState<string | null>(null);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());

  const handleComplete = useCallback(
    async (quest: AnyQuest) => {
      if (!userId || completing || localCompleted.has(quest.id) || quest.completed_at) return;

      setCompleting(quest.id);
      try {
        const result = await completeQuest(supabase, userId, quest as ContextualQuest);
        setLocalCompleted(prev => new Set([...prev, quest.id]));
        onQuestComplete?.(result, quest);
      } catch (err) {
        logger.error('[QuestBoard] completeQuest failed:', err);
      } finally {
        setCompleting(null);
      }
    },
    [userId, completing, localCompleted, onQuestComplete]
  );

  const isComplete = (q: AnyQuest) =>
    q.completed_at !== null || localCompleted.has(q.id);

  if (dailyQuests.length === 0 && weeklyQuests.length === 0 && epicQuests.length === 0) {
    return (
      <div className="quest-board">
        <div className="quest-empty">
          <Zap size={28} style={{ opacity: 0.3, marginBottom: 4 }} />
          <span>No active quests.</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Check back soon!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="quest-board">
      {dailyQuests.length > 0 && (
        <>
          <div className="quest-section-title"><Sun size={13} />Daily Quests</div>
          <div className="quest-list">
            {dailyQuests.map(quest => (
              <QuestItem
                key={quest.id}
                quest={quest}
                isComplete={isComplete(quest)}
                isCompleting={completing === quest.id}
                showCompleteButton={!!userId}
                onComplete={handleComplete}
              />
            ))}
          </div>
        </>
      )}

      {weeklyQuests.length > 0 && (
        <>
          <div className="quest-section-title"><Calendar size={13} />Weekly Quests</div>
          <div className="quest-list">
            {weeklyQuests.map(quest => (
              <QuestItem
                key={quest.id}
                quest={quest}
                isComplete={isComplete(quest)}
                isCompleting={completing === quest.id}
                showCompleteButton={!!userId}
                onComplete={handleComplete}
              />
            ))}
          </div>
        </>
      )}

      {showEpic && epicQuests.length > 0 && (
        <>
          <div className="quest-section-title"><Zap size={13} />Epic Quests</div>
          <div className="quest-list">
            {epicQuests
              .filter(q => !isComplete(q))
              .map(quest => (
                <QuestItem
                  key={quest.id}
                  quest={quest}
                  isComplete={false}
                  isCompleting={false}
                  showCompleteButton={false}
                  onComplete={handleComplete}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── QUEST ITEM ─────────────────────────────────────────────────────────────────

interface QuestItemProps {
  quest: AnyQuest;
  isComplete: boolean;
  isCompleting: boolean;
  showCompleteButton: boolean;
  onComplete: (quest: AnyQuest) => void;
}

function QuestItem({
  quest,
  isComplete,
  isCompleting,
  showCompleteButton,
  onComplete,
}: QuestItemProps) {
  const progress    = Math.min(quest.progress, quest.target);
  const progressPct = quest.target > 0 ? (progress / quest.target) * 100 : 0;
  const priority    = getQuestPriority(quest);
  const contextLabel = getContextLabel(quest);
  const sourceBadge  = getSourceBadgeIcon(quest);
  const title        = getDisplayTitle(quest);
  const description  = getDisplayDescription(quest);
  const icon         = getDisplayIcon(quest);
  const questTime    = getQuestTime(quest);

  return (
    <div
      className={[
        'quest-item',
        isComplete ? 'completed' : '',
        isCompleting ? 'completing' : '',
        priority ? `priority-${priority}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Priority stripe */}
      {priority && !isComplete && (
        <div
          className="quest-priority-stripe"
          style={{ '--priority-colour': getPriorityColour(priority) } as React.CSSProperties}
        />
      )}

      {/* Icon */}
      <span className="quest-icon"><EmojiIcon emoji={icon} size={18} fallbackAsText /></span>

      {/* Content */}
      <div className="quest-info">
        {/* Priority badge + source indicator */}
        {(priority || sourceBadge) && !isComplete && (
          <div className="quest-meta-row">
            {priority && priority !== 'low' && (
              <span
                className="quest-priority-badge"
                style={{ color: getPriorityColour(priority) }}
              >
                {getPriorityLabel(priority)}
              </span>
            )}
            {sourceBadge && (
              <span className="quest-source-badge" title={`Source: ${sourceBadge}`}>
                {sourceBadge}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <div className="quest-title">{title}</div>

        {/* Description */}
        {description && (
          <div className="quest-desc">{description}</div>
        )}

        {/* Time badge */}
        {questTime && !isComplete && (
          <div className="quest-time-badge">
            <Clock size={10} />
            <span>{questTime}</span>
          </div>
        )}

        {/* Context label */}
        {contextLabel && (
          <div className="quest-context-label">{contextLabel}</div>
        )}

        {/* Progress bar */}
        <div className="quest-progress-wrap">
          <div className="quest-progress-bar">
            <div
              className="quest-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="quest-progress-text">
            {progress}/{quest.target}
          </div>
        </div>
      </div>

      {/* Right-side action */}
      <div className="quest-action">
        {isComplete ? (
          <span className="quest-check">
            <CheckCircle2 size={18} />
          </span>
        ) : showCompleteButton ? (
          <button
            className="quest-complete-btn"
            onClick={() => onComplete(quest)}
            disabled={isCompleting}
            title={quest.target === 1 ? 'Mark as complete' : `Progress (${progress}/${quest.target})`}
          >
            {isCompleting ? (
              <span className="quest-spinner" />
            ) : quest.target === 1 ? (
              <>
                <Zap size={12} />
                <span>+{quest.reward_xp}</span>
              </>
            ) : (
              <>
                <Zap size={12} />
                <span>{progress}/{quest.target}</span>
              </>
            )}
          </button>
        ) : (
          <span className="quest-reward">+{quest.reward_xp} XP</span>
        )}
      </div>
    </div>
  );
}

export default QuestBoard;
