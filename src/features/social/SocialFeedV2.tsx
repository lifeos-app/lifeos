// LifeOS Social — Enhanced Social Feed
// Activity stream with celebrate, reactions, comments, privacy, weekly summary

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Flame, Trophy, BookOpen, Sword, Target, Star,
  MessageCircle, Lock, Globe, Users2, ChevronDown, ChevronUp, X, Send, Sparkles
} from 'lucide-react';
import { useSocialFeed, FEED_EVENT_CONFIG, REACTION_OPTIONS } from './useSocialFeed';
import type { SocialFeedItem, FeedEventType, ReactionEmoji, FeedVisibility, FeedComment } from './useSocialFeed';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface SocialFeedV2Props {
  userId: string;
  guildId?: string;
  maxItems?: number;
  showWeeklySummary?: boolean;
}

// ═══════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════

function CelebrationOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const particles = Array.from({ length: 50 }, (_, i) => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#A855F7', '#F97316'];
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const duration = 1.5 + Math.random() * 2;
    const size = 4 + Math.random() * 8;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: -10,
          width: size,
          height: size,
          background: color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `sf-confetti-fall ${duration}s ${delay}s ease-out forwards`,
        }}
      />
    );
  });

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
      {particles}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getVisibilityIcon(vis: FeedVisibility) {
  switch (vis) {
    case 'everyone': return <Globe size={10} />;
    case 'friends': return <Users2 size={10} />;
    case 'guild': return <Sword size={10} />;
    default: return <Lock size={10} />;
  }
}

function getVisibilityLabel(vis: FeedVisibility) {
  switch (vis) {
    case 'everyone': return 'Public';
    case 'friends': return 'Friends';
    case 'guild': return 'Guild';
    default: return 'Private';
  }
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function SocialFeedV2({ userId, guildId, maxItems = 30, showWeeklySummary = true }: SocialFeedV2Props) {
  const {
    feedItems, weeklySummary, loading, error,
    addReaction, removeReaction, addComment,
    shareEvent, deleteItem, loadMore, hasMore, refresh,
  } = useSocialFeed(userId, guildId);

  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // ── Handle Reaction ──────────────────────────────────────────
  const handleReact = useCallback(async (itemId: string, emoji: ReactionEmoji) => {
    const item = feedItems.find(i => i.id === itemId);
    if (!item) return;

    const currentReaction = Object.entries(item.reactions).find(([, ids]) => ids.includes(userId));
    if (currentReaction && currentReaction[0] === emoji) {
      // Toggle off
      await removeReaction(itemId, emoji);
    } else {
      // Remove previous reaction if different
      if (currentReaction) {
        await removeReaction(itemId, currentReaction[0] as ReactionEmoji);
      }
      await addReaction(itemId, emoji);
    }

    // Celebrate on milestone reactions
    const newItem = feedItems.find(i => i.id === itemId);
    if (newItem) {
      const total = Object.values(newItem.reactions).reduce((sum, ids) => sum + ids.length, 0);
      if (total >= 5 && total % 5 === 0) {
        setCelebrate(itemId);
      }
    }

    setShowReactionsFor(null);
  }, [feedItems, userId, addReaction, removeReaction]);

  // ── Handle Comment ────────────────────────────────────────────
  const handleComment = useCallback(async (itemId: string) => {
    if (!commentText.trim()) return;
    await addComment(itemId, commentText.trim());
    setCommentText('');
  }, [commentText, addComment]);

  const visibleItems = feedItems.slice(0, maxItems);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="sf2-container">
      {/* Confetti */}
      {celebrate && <CelebrationOverlay onDone={() => setCelebrate(null)} />}

      {/* Header */}
      <div className="sf2-header">
        <h3 className="sf2-title"><Sparkles size={18} style={{ color: '#A855F7' }} /> Activity Feed</h3>
        <button className="sf2-refresh-btn" onClick={() => void refresh()}>↻</button>
      </div>

      {/* "Your Week" summary card */}
      {showWeeklySummary && weeklySummary && (
        <div className="sf2-weekly">
          <div className="sf2-weekly-header">
            <Flame size={14} style={{ color: '#F97316' }} />
            <span className="sf2-weekly-title">Your Week</span>
          </div>
          <div className="sf2-weekly-stats">
            <div className="sf2-weekly-stat">
              <span className="sf2-weekly-value">{weeklySummary.totalXP}</span>
              <span className="sf2-weekly-label">XP</span>
            </div>
            <div className="sf2-weekly-stat">
              <span className="sf2-weekly-value">{weeklySummary.habitsLogged}</span>
              <span className="sf2-weekly-label">Habits</span>
            </div>
            <div className="sf2-weekly-stat">
              <span className="sf2-weekly-value">{weeklySummary.streakDays}</span>
              <span className="sf2-weekly-label">Streak</span>
            </div>
            <div className="sf2-weekly-stat">
              <span className="sf2-weekly-value">{weeklySummary.achievementsUnlocked}</span>
              <span className="sf2-weekly-label">Achievements</span>
            </div>
            <div className="sf2-weekly-stat">
              <span className="sf2-weekly-value">{weeklySummary.goalsCompleted}</span>
              <span className="sf2-weekly-label">Goals</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="sf2-error">
          Could not load feed. <button onClick={() => void refresh()} style={{ color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="sf2-loading">Loading feed…</div>}

      {/* Feed Items */}
      <div className="sf2-items">
        {visibleItems.length === 0 && !loading && (
          <div className="sf2-empty">
            <span className="sf2-empty-icon">🌱</span>
            <p>No activity yet. Share your achievements!</p>
          </div>
        )}

        {visibleItems.map(item => {
          const config = FEED_EVENT_CONFIG[item.event_type];
          const isCelebration = config?.isCelebration || false;
          const totalReactions = Object.values(item.reactions).reduce((sum, ids) => sum + ids.length, 0);

          return (
            <div key={item.id} className={`sf2-card ${isCelebration ? 'sf2-card--celebration' : ''}`}>
              {/* Sparkle for celebrations */}
              {isCelebration && <div className="sf2-card-sparkle">✨</div>}

              {/* Header */}
              <div className="sf2-card-header">
                <div className="sf2-card-avatar" style={{ background: config?.bgColor || '#64748B' }}>
                  {item.user_class_icon || '🌟'}
                </div>
                <div className="sf2-card-info">
                  <div className="sf2-card-name-row">
                    <span className="sf2-card-name">{item.user_name || 'Adventurer'}</span>
                    <span className="sf2-card-level">Lv.{item.user_level}</span>
                  </div>
                  <div className="sf2-card-meta-row">
                    <span className="sf2-card-time">{formatTimeAgo(item.created_at)}</span>
                    <span className="sf2-card-vis">{getVisibilityIcon(item.visibility)} {getVisibilityLabel(item.visibility)}</span>
                  </div>
                </div>
                <span className="sf2-card-event-icon">{item.icon || config?.icon || '📢'}</span>
                {item.user_id === userId && (
                  <button
                    className="sf2-card-delete"
                    onClick={() => void deleteItem(item.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="sf2-card-body">
                <span className="sf2-card-title">{item.title}</span>
                <p className="sf2-card-text">{item.body}</p>
                {item.milestone_value && (
                  <span className="sf2-card-milestone">
                    {item.icon} {item.milestone_value}
                  </span>
                )}
              </div>

              {/* Reactions */}
              <div className="sf2-card-reactions">
                {(Object.entries(item.reactions) as [ReactionEmoji, string[]][])
                  .filter(([, ids]) => ids.length > 0)
                  .map(([emoji, ids]) => (
                    <button
                      key={emoji}
                      className={`sf2-reaction ${ids.includes(userId) ? 'sf2-reaction--active' : ''}`}
                      onClick={() => void handleReact(item.id, emoji)}
                    >
                      {emoji} {ids.length}
                    </button>
                  ))
                }
                <button
                  className="sf2-reaction-add"
                  onClick={() => setShowReactionsFor(showReactionsFor === item.id ? null : item.id)}
                >
                  +
                </button>
                {showReactionsFor === item.id && (
                  <div className="sf2-reaction-picker">
                    {REACTION_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        className="sf2-reaction-pick"
                        onClick={() => void handleReact(item.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments toggle */}
              <div className="sf2-comment-toggle">
                <button
                  className="sf2-comment-btn"
                  onClick={() => setShowCommentsFor(showCommentsFor === item.id ? null : item.id)}
                >
                  <MessageCircle size={12} /> {item.comments.length > 0 ? item.comments.length : 'Comment'}
                </button>
              </div>

              {/* Comments section */}
              {showCommentsFor === item.id && (
                <div className="sf2-comments">
                  {item.comments.length > 0 && (
                    <div className="sf2-comments-list">
                      {item.comments.map(comment => (
                        <div key={comment.id} className="sf2-comment">
                          <div className="sf2-comment-avatar">{comment.user_name.slice(0, 2).toUpperCase()}</div>
                          <div className="sf2-comment-body">
                            <span className="sf2-comment-name">{comment.user_name}</span>
                            <span className="sf2-comment-text">{comment.content}</span>
                          </div>
                          <span className="sf2-comment-time">{formatTimeAgo(comment.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="sf2-comment-input-row">
                    <input
                      className="sf2-comment-input"
                      placeholder="Write a comment…"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleComment(item.id); } }}
                    />
                    <button
                      className="sf2-comment-send"
                      onClick={() => void handleComment(item.id)}
                      disabled={!commentText.trim()}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Load more */}
        {hasMore && !loading && (
          <button className="sf2-load-more" onClick={() => void loadMore()}>
            Load more…
          </button>
        )}
      </div>

      {/* Share dialog button */}
      <button className="sf2-share-fab" onClick={() => setShowShareDialog(true)}>
        <Star size={18} />
      </button>

      {/* Share dialog (simplified) */}
      {showShareDialog && (
        <div className="sf2-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowShareDialog(false); }}>
          <div className="sf2-modal">
            <div className="sf2-modal-header">
              <h3>🌟 Share Achievement</h3>
              <button className="sf2-modal-close" onClick={() => setShowShareDialog(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: 12 }}>
              Share your progress with friends and guild members!
            </p>
            <div className="sf2-share-options">
              {(Object.entries(FEED_EVENT_CONFIG) as [FeedEventType, typeof FEED_EVENT_CONFIG[FeedEventType]][]).slice(0, 6).map(([type, config]) => (
                <button
                  key={type}
                  className="sf2-share-option"
                  onClick={async () => {
                    await shareEvent(type, `${config.verb} something great!`, `Achievement shared to the feed.`, undefined, 'friends', guildId);
                    setShowShareDialog(false);
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{config.icon}</span>
                  <span style={{ fontSize: '0.75rem', color: '#E2E8F0' }}>{config.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes sf-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

export const socialFeedV2Styles = `
.sf2-container { max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }

/* Header */
.sf2-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sf2-title { font-size: 1.1rem; font-weight: 700; color: white; margin: 0; display: flex; align-items: center; gap: 6px; }
.sf2-refresh-btn { background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94A3B8; padding: 4px 8px; font-size: 1rem; cursor: pointer; }
.sf2-refresh-btn:hover { background: rgba(255,255,255,0.05); }

/* Weekly summary */
.sf2-weekly { background: linear-gradient(135deg, #1e293b, #334155); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 16px; }
.sf2-weekly-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.sf2-weekly-title { font-size: 0.85rem; font-weight: 600; color: #F97316; }
.sf2-weekly-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.sf2-weekly-stat { text-align: center; padding: 8px 4px; background: rgba(255,255,255,0.04); border-radius: 8px; }
.sf2-weekly-value { display: block; font-size: 1.15rem; font-weight: 700; color: #60A5FA; }
.sf2-weekly-label { display: block; font-size: 0.6rem; color: #64748B; margin-top: 2px; }

/* Feed cards */
.sf2-items { display: flex; flex-direction: column; gap: 10px; }
.sf2-card { position: relative; background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; transition: border-color 0.15s; }
.sf2-card:hover { border-color: rgba(255,255,255,0.12); }
.sf2-card--celebration { border-color: rgba(234,179,8,0.25); background: linear-gradient(135deg, #1e293b 0%, rgba(234,179,8,0.04) 100%); }
.sf2-card-sparkle { position: absolute; top: 8px; right: 8px; font-size: 1rem; }

/* Card header */
.sf2-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.sf2-card-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
.sf2-card-info { flex: 1; min-width: 0; }
.sf2-card-name-row { display: flex; align-items: center; gap: 6px; }
.sf2-card-name { font-weight: 600; font-size: 0.85rem; color: white; }
.sf2-card-level { font-size: 0.65rem; color: #94A3B8; background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 9999px; }
.sf2-card-meta-row { display: flex; align-items: center; gap: 6px; margin-top: 1px; }
.sf2-card-time { font-size: 0.65rem; color: #64748B; }
.sf2-card-vis { font-size: 0.6rem; color: #64748B; display: flex; align-items: center; gap: 3px; }
.sf2-card-event-icon { font-size: 1.3rem; }
.sf2-card-delete { position: absolute; top: 6px; right: 6px; background: none; border: none; color: #64748B; font-size: 1rem; cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 4px; }
.sf2-card:hover .sf2-card-delete { opacity: 1; }
.sf2-card-delete:hover { color: #EF4444; }

/* Card body */
.sf2-card-body { margin-left: 46px; }
.sf2-card-title { font-weight: 600; font-size: 0.9rem; color: white; }
.sf2-card-text { font-size: 0.8rem; color: #94A3B8; margin: 2px 0 4px; }
.sf2-card-milestone { display: inline-block; font-size: 0.75rem; font-weight: 700; color: #FBBF24; background: rgba(234,179,8,0.1); padding: 2px 8px; border-radius: 9999px; margin-top: 4px; }

/* Reactions */
.sf2-card-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; margin-left: 46px; align-items: center; }
.sf2-reaction { display: inline-flex; align-items: center; gap: 3px; font-size: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 9999px; padding: 3px 8px; color: #CBD5E1; cursor: pointer; transition: all 0.15s; }
.sf2-reaction:hover { background: rgba(255,255,255,0.1); }
.sf2-reaction--active { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.3); color: #C084FC; }
.sf2-reaction-add { font-size: 0.7rem; background: none; border: 1px dashed rgba(255,255,255,0.15); border-radius: 9999px; padding: 3px 8px; color: #64748B; cursor: pointer; transition: all 0.15s; }
.sf2-reaction-add:hover { border-color: rgba(255,255,255,0.3); color: #94A3B8; }
.sf2-reaction-picker { display: flex; gap: 4px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 9999px; padding: 4px 8px; }
.sf2-reaction-pick { background: none; border: none; font-size: 1rem; cursor: pointer; padding: 2px; border-radius: 50%; transition: background 0.1s; }
.sf2-reaction-pick:hover { background: rgba(255,255,255,0.1); }

/* Comments */
.sf2-comment-toggle { margin-left: 46px; margin-top: 6px; }
.sf2-comment-btn { font-size: 0.7rem; color: #64748B; background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.sf2-comment-btn:hover { color: #94A3B8; }
.sf2-comments { margin-left: 46px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; }
.sf2-comments-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.sf2-comment { display: flex; gap: 6px; align-items: flex-start; }
.sf2-comment-avatar { width: 20px; height: 20px; border-radius: 50%; background: rgba(168,85,247,0.2); color: #A855F7; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 700; flex-shrink: 0; }
.sf2-comment-body { flex: 1; }
.sf2-comment-name { font-size: 0.7rem; font-weight: 600; color: #E2E8F0; margin-right: 4px; }
.sf2-comment-text { font-size: 0.75rem; color: #94A3B8; }
.sf2-comment-time { font-size: 0.6rem; color: #64748B; flex-shrink: 0; }
.sf2-comment-input-row { display: flex; gap: 6px; margin-top: 4px; }
.sf2-comment-input { flex: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 6px 12px; color: white; font-size: 0.75rem; }
.sf2-comment-input:focus { outline: none; border-color: rgba(168,85,247,0.5); }
.sf2-comment-send { background: linear-gradient(135deg, #A855F7, #7C3AED); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.sf2-comment-send:disabled { opacity: 0.5; cursor: not-allowed; }

/* Share FAB */
.sf2-share-fab { position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #A855F7, #7C3AED); color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(168,85,247,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
.sf2-share-fab:hover { transform: scale(1.05); }

/* Share dialog */
.sf2-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
.sf2-modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; max-height: 85vh; overflow-y: auto; width: 100%; max-width: 480px; padding: 20px; }
.sf2-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sf2-modal-header h3 { font-size: 1rem; font-weight: 700; color: white; margin: 0; }
.sf2-modal-close { background: none; border: none; color: #94A3B8; cursor: pointer; padding: 4px; }
.sf2-share-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sf2-share-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; cursor: pointer; transition: all 0.15s; }
.sf2-share-option:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }

/* Load More */
.sf2-load-more { display: block; width: 100%; padding: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #94A3B8; font-size: 0.8rem; cursor: pointer; text-align: center; margin-top: 12px; }
.sf2-load-more:hover { background: rgba(255,255,255,0.08); }

/* Error & empty */
.sf2-error { padding: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; color: #F87171; font-size: 0.8rem; margin-bottom: 12px; }
.sf2-loading { text-align: center; color: #64748B; padding: 24px; font-size: 0.85rem; }
.sf2-empty { text-align: center; padding: 32px; color: #64748B; }
.sf2-empty-icon { font-size: 2.5rem; display: block; margin-bottom: 8px; }
.sf2-empty p { font-size: 0.85rem; margin: 0; }
`;