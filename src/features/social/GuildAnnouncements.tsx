// LifeOS Social — Guild Announcements Board
// Pinned announcements, reactions, @mentions, polls, edit/delete

import { useState, useCallback } from 'react';
import { Megaphone, Pin, X, Edit3, Trash2, BarChart3, AtSign } from 'lucide-react';
import type { GuildAnnouncement, GuildPoll } from './useGuildEvents';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface GuildAnnouncementsProps {
  guildId: string;
  userId: string;
  userRole: 'owner' | 'admin' | 'member';
  announcements: GuildAnnouncement[];
  onCreateAnnouncement: (data: { guild_id: string; author_id: string; content: string; is_pinned: boolean; poll?: GuildPoll | null }) => Promise<GuildAnnouncement | null>;
  onUpdateAnnouncement: (id: string, updates: Partial<GuildAnnouncement>) => Promise<boolean>;
  onDeleteAnnouncement: (id: string) => Promise<boolean>;
  onToggleReaction: (id: string, emoji: string) => Promise<boolean>;
  onTogglePin: (id: string, pinned: boolean) => Promise<boolean>;
  onVotePoll: (id: string, optionId: string) => Promise<boolean>;
  loading?: boolean;
}

const REACTION_EMOJIS = ['👍', '🔥', '👏', '❤️', '🎉', '🤔'];

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

function renderMentions(content: string): string {
  return content.replace(/@(\w+)/g, '<span style="color: #A855F7; font-weight: 600;">@$1</span>');
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function GuildAnnouncements({
  guildId,
  userId,
  userRole,
  announcements,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onToggleReaction,
  onTogglePin,
  onVotePoll,
  loading: propLoading,
}: GuildAnnouncementsProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [creating, setCreating] = useState(false);

  // Poll creation
  const [addPoll, setAddPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollExpiry, setPollExpiry] = useState('');

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Reaction picker
  const [showReactionFor, setShowReactionFor] = useState<string | null>(null);

  const canCreate = userRole === 'owner' || userRole === 'admin';

  // ── Pinned announcements ─────────────────────────────────────────
  const pinnedAnnouncements = announcements.filter(a => a.is_pinned);
  const regularAnnouncements = announcements.filter(a => !a.is_pinned);

  // ── Create announcement ──────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!newContent.trim()) return;
    setCreating(true);

    let poll: GuildPoll | null = null;
    if (addPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
      poll = {
        question: pollQuestion.trim(),
        options: pollOptions.filter(o => o.trim()).map((label, i) => ({
          id: `opt_${i}`,
          label: label.trim(),
          votes: [],
        })),
        expires_at: pollExpiry || null,
      };
    }

    await onCreateAnnouncement({
      guild_id: guildId,
      author_id: userId,
      content: newContent.trim(),
      is_pinned: newIsPinned,
      poll,
    });

    setNewContent('');
    setNewIsPinned(false);
    setAddPoll(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollExpiry('');
    setShowCreate(false);
    setCreating(false);
  }, [newContent, newIsPinned, addPoll, pollQuestion, pollOptions, pollExpiry, onCreateAnnouncement, guildId, userId]);

  // ── Edit ──────────────────────────────────────────────────────────
  const startEdit = (announcement: GuildAnnouncement) => {
    setEditingId(announcement.id);
    setEditContent(announcement.content);
  };

  const handleEdit = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    await onUpdateAnnouncement(editingId, { content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  }, [editingId, editContent, onUpdateAnnouncement]);

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Delete this announcement?')) {
      await onDeleteAnnouncement(id);
    }
  }, [onDeleteAnnouncement]);

  // ── Add poll option ──────────────────────────────────────────────
  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  // ── Render announcement ──────────────────────────────────────────
  const renderAnnouncement = (announcement: GuildAnnouncement) => {
    const isEditing = editingId === announcement.id;
    const canEdit = announcement.author_id === userId || canCreate;
    const totalVotes = announcement.poll
      ? announcement.poll.options.reduce((s, o) => s + o.votes.length, 0)
      : 0;

    return (
      <div key={announcement.id} className={`ga-card ${announcement.is_pinned ? 'ga-card--pinned' : ''}`}>
        {/* Pin indicator */}
        {announcement.is_pinned && (
          <div className="ga-pinned-badge">
            <Pin size={10} /> Pinned
          </div>
        )}

        {/* Author header */}
        <div className="ga-card-header">
          <div className="ga-card-author">
            <div className="ga-avatar">{announcement.author_id.slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="ga-author-name">{announcement.author_id === userId ? 'You' : 'Guild Member'}</div>
              <div className="ga-card-time">{formatTimeAgo(announcement.created_at)}</div>
            </div>
          </div>
          {canEdit && (
            <div className="ga-card-actions">
              <button className="ga-action-btn" onClick={() => startEdit(announcement)} title="Edit">
                <Edit3 size={13} />
              </button>
              <button className="ga-action-btn ga-action-btn--danger" onClick={() => void handleDelete(announcement.id)} title="Delete">
                <Trash2 size={13} />
              </button>
              {canCreate && (
                <button
                  className="ga-action-btn"
                  onClick={() => void onTogglePin(announcement.id, !announcement.is_pinned)}
                  title={announcement.is_pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={13} style={announcement.is_pinned ? { color: '#F59E0B' } : {}} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="ga-edit-form">
            <textarea
              className="ga-textarea"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={3}
            />
            <div className="ga-edit-actions">
              <button className="ga-btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="ga-btn-primary" onClick={() => void handleEdit()}>Save</button>
            </div>
          </div>
        ) : (
          <div
            className="ga-card-content"
            dangerouslySetInnerHTML={{ __html: renderMentions(announcement.content) }}
          />
        )}

        {/* Mention indicator */}
        {announcement.mentions && announcement.mentions.length > 0 && (
          <div className="ga-mentions">
            <AtSign size={10} />
            {announcement.mentions.map((m, i) => (
              <span key={i} className="ga-mention-tag">@{m}</span>
            ))}
          </div>
        )}

        {/* Poll */}
        {announcement.poll && !isEditing && (
          <div className="ga-poll">
            <div className="ga-poll-question">
              <BarChart3 size={14} /> {announcement.poll.question}
            </div>
            <div className="ga-poll-options">
              {announcement.poll.options.map(option => {
                const voteCount = option.votes.length;
                const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                const hasVoted = option.votes.includes(userId);

                return (
                  <button
                    key={option.id}
                    className={`ga-poll-option ${hasVoted ? 'ga-poll-option--voted' : ''}`}
                    onClick={() => void onVotePoll(announcement.id, option.id)}
                  >
                    <div className="ga-poll-option-bar" style={{ width: `${percentage}%` }} />
                    <div className="ga-poll-option-content">
                      <span className="ga-poll-option-label">{option.label}</span>
                      <span className="ga-poll-option-votes">
                        {voteCount} {voteCount === 1 ? 'vote' : 'votes'} ({percentage}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="ga-poll-total">{totalVotes} total votes</div>
          </div>
        )}

        {/* Reactions */}
        <div className="ga-reactions">
          {(Object.entries(announcement.reactions) as [string, string[]][]).filter(([, ids]) => ids.length > 0).map(([emoji, userIds]) => (
            <button
              key={emoji}
              className={`ga-reaction ${userIds.includes(userId) ? 'ga-reaction--active' : ''}`}
              onClick={() => void onToggleReaction(announcement.id, emoji)}
            >
              {emoji} {userIds.length}
            </button>
          ))}
          <button
            className="ga-reaction-add"
            onClick={() => setShowReactionFor(showReactionFor === announcement.id ? null : announcement.id)}
          >
            + React
          </button>
          {showReactionFor === announcement.id && (
            <div className="ga-reaction-picker">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className="ga-reaction-pick"
                  onClick={() => {
                    void onToggleReaction(announcement.id, emoji);
                    setShowReactionFor(null);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ga-container">
      {/* Header */}
      <div className="ga-header">
        <div className="ga-header-left">
          <Megaphone size={20} style={{ color: '#F59E0B' }} />
          <h3 className="ga-title">Announcements</h3>
          <span className="ga-count">{announcements.length}</span>
        </div>
        {canCreate && (
          <button className="ga-create-btn" onClick={() => setShowCreate(true)}>
            <span>+</span> New
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ga-create-form">
          <textarea
            className="ga-textarea"
            placeholder="Write an announcement... Use @username to mention members"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <div className="ga-create-options">
            <label className="ga-checkbox-label">
              <input
                type="checkbox"
                checked={newIsPinned}
                onChange={e => setNewIsPinned(e.target.checked)}
              />
              <Pin size={12} /> Pin to top
            </label>
            <label className="ga-checkbox-label">
              <input
                type="checkbox"
                checked={addPoll}
                onChange={e => setAddPoll(e.target.checked)}
              />
              <BarChart3 size={12} /> Add poll
            </label>
          </div>
          {addPoll && (
            <div className="ga-poll-create">
              <input
                className="ga-input"
                placeholder="Poll question"
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                maxLength={200}
              />
              {pollOptions.map((option, i) => (
                <div key={i} className="ga-poll-option-input">
                  <span className="ga-poll-option-letter">{String.fromCharCode(65 + i)}</span>
                  <input
                    className="ga-input"
                    placeholder={`Option ${i + 1}`}
                    value={option}
                    onChange={e => setPollOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                    maxLength={100}
                  />
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button className="ga-poll-add-btn" onClick={addPollOption}>+ Add option</button>
              )}
              <input
                className="ga-input"
                type="datetime-local"
                value={pollExpiry}
                onChange={e => setPollExpiry(e.target.value)}
                placeholder="Poll expiry (optional)"
              />
            </div>
          )}
          <div className="ga-create-actions">
            <button className="ga-btn-secondary" onClick={() => {
              setShowCreate(false);
              setNewContent('');
              setAddPoll(false);
            }}>Cancel</button>
            <button
              className="ga-btn-primary"
              onClick={() => void handleCreate()}
              disabled={!newContent.trim() || creating}
            >
              {creating ? 'Posting…' : '📢 Post'}
            </button>
          </div>
        </div>
      )}

      {/* Pinned banner */}
      {pinnedAnnouncements.length > 0 && (
        <div className="ga-pinned-section">
          {pinnedAnnouncements.slice(0, 1).map(announcement => (
            <div key={announcement.id} className="ga-pinned-banner">
              <Pin size={12} style={{ color: '#F59E0B' }} />
              <div
                className="ga-pinned-text"
                dangerouslySetInnerHTML={{ __html: renderMentions(announcement.content) }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {propLoading && <div className="ga-loading">Loading announcements…</div>}

      {/* All announcements */}
      {!propLoading && (
        <div className="ga-list">
          {pinnedAnnouncements.length > 1 && (
            <div className="ga-section-label">📌 Pinned</div>
          )}
          {pinnedAnnouncements.slice(1).map(renderAnnouncement)}
          {regularAnnouncements.length > 0 && pinnedAnnouncements.length > 0 && (
            <div className="ga-section-label">Recent</div>
          )}
          {regularAnnouncements.map(renderAnnouncement)}
          {announcements.length === 0 && (
            <div className="ga-empty">
              <span className="ga-empty-icon">📢</span>
              <p>No announcements yet</p>
              {canCreate && <button className="ga-btn-primary" onClick={() => setShowCreate(true)}>Create the first announcement</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

export const guildAnnouncementsStyles = `
.ga-container { max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
.ga-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.ga-header-left { display: flex; align-items: center; gap: 8px; }
.ga-title { font-size: 1.1rem; font-weight: 700; color: white; margin: 0; }
.ga-count { font-size: 0.75rem; background: rgba(245,158,11,0.2); color: #F59E0B; padding: 2px 8px; border-radius: 9999px; }
.ga-create-btn { display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); color: #F59E0B; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.ga-create-btn:hover { background: rgba(245,158,11,0.2); }

/* Create form */
.ga-create-form { background: #1e293b; border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 14px; margin-bottom: 16px; }
.ga-textarea { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; color: white; font-size: 0.85rem; resize: vertical; min-height: 80px; font-family: inherit; }
.ga-textarea:focus { outline: none; border-color: rgba(245,158,11,0.5); }
.ga-input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; color: white; font-size: 0.8rem; margin-bottom: 6px; }
.ga-input:focus { outline: none; border-color: rgba(245,158,11,0.5); }
.ga-create-options { display: flex; gap: 12px; margin: 8px 0; }
.ga-checkbox-label { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #94A3B8; cursor: pointer; }
.ga-checkbox-label input { accent-color: #F59E0B; }
.ga-create-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.ga-btn-primary { padding: 7px 16px; border-radius: 8px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer; }
.ga-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ga-btn-secondary { padding: 7px 16px; border-radius: 8px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; font-size: 0.8rem; cursor: pointer; }

/* Poll create */
.ga-poll-create { background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.12); border-radius: 8px; padding: 10px; margin: 8px 0; }
.ga-poll-option-input { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.ga-poll-option-letter { width: 20px; height: 20px; border-radius: 50%; background: rgba(245,158,11,0.15); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; flex-shrink: 0; }
.ga-poll-add-btn { font-size: 0.75rem; color: #F59E0B; background: none; border: none; cursor: pointer; padding: 4px 0; }

/* Pinned banner */
.ga-pinned-section { margin-bottom: 12px; }
.ga-pinned-banner { display: flex; align-items: flex-start; gap: 8px; background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03)); border: 1px solid rgba(245,158,11,0.2); border-radius: 10px; padding: 12px 14px; font-size: 0.85rem; color: #FCD34D; }
.ga-pinned-text { flex: 1; line-height: 1.5; }

/* Announcements list */
.ga-list { display: flex; flex-direction: column; gap: 10px; }
.ga-section-label { font-size: 0.75rem; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin: 8px 0 4px; }

/* Card */
.ga-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; position: relative; transition: border-color 0.15s; }
.ga-card:hover { border-color: rgba(255,255,255,0.12); }
.ga-card--pinned { border-color: rgba(245,158,11,0.2); background: linear-gradient(135deg, #1e293b, rgba(245,158,11,0.04)); }
.ga-pinned-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 600; color: #F59E0B; margin-bottom: 8px; }

/* Header */
.ga-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.ga-card-author { display: flex; align-items: center; gap: 8px; }
.ga-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(245,158,11,0.2); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; }
.ga-author-name { font-size: 0.8rem; font-weight: 600; color: white; }
.ga-card-time { font-size: 0.65rem; color: #64748B; }
.ga-card-actions { display: flex; gap: 4px; }
.ga-action-btn { background: none; border: none; color: #64748B; cursor: pointer; padding: 4px; border-radius: 4px; }
.ga-action-btn:hover { color: #94A3B8; background: rgba(255,255,255,0.05); }
.ga-action-btn--danger:hover { color: #EF4444; }

/* Content */
.ga-card-content { font-size: 0.85rem; color: #E2E8F0; line-height: 1.6; margin-bottom: 8px; }

/* Mentions */
.ga-mentions { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
.ga-mention-tag { font-size: 0.7rem; background: rgba(168,85,247,0.15); color: #A855F7; padding: 2px 6px; border-radius: 4px; }

/* Edit form */
.ga-edit-form { margin-bottom: 8px; }
.ga-edit-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

/* Poll display */
.ga-poll { background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.12); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.ga-poll-question { font-size: 0.8rem; font-weight: 600; color: #60A5FA; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ga-poll-options { display: flex; flex-direction: column; gap: 6px; }
.ga-poll-option { position: relative; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 12px; cursor: pointer; text-align: left; overflow: hidden; transition: all 0.15s; }
.ga-poll-option:hover { border-color: rgba(59,130,246,0.3); }
.ga-poll-option--voted { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.06); }
.ga-poll-option-bar { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(59,130,246,0.15); transition: width 0.3s; }
.ga-poll-option-content { position: relative; display: flex; justify-content: space-between; align-items: center; }
.ga-poll-option-label { font-size: 0.8rem; color: #E2E8F0; }
.ga-poll-option-votes { font-size: 0.7rem; color: #94A3B8; }
.ga-poll-total { font-size: 0.7rem; color: #64748B; margin-top: 6px; text-align: center; }

/* Reactions */
.ga-reactions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.ga-reaction { display: inline-flex; align-items: center; gap: 3px; font-size: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 9999px; padding: 3px 8px; color: #CBD5E1; cursor: pointer; transition: all 0.15s; }
.ga-reaction:hover { background: rgba(255,255,255,0.1); }
.ga-reaction--active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60A5FA; }
.ga-reaction-add { font-size: 0.7rem; background: none; border: 1px dashed rgba(255,255,255,0.15); border-radius: 9999px; padding: 3px 8px; color: #64748B; cursor: pointer; }
.ga-reaction-add:hover { border-color: rgba(255,255,255,0.3); color: #94A3B8; }
.ga-reaction-picker { display: flex; gap: 4px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 9999px; padding: 4px 8px; }
.ga-reaction-pick { background: none; border: none; font-size: 1rem; cursor: pointer; padding: 2px; border-radius: 50%; }
.ga-reaction-pick:hover { background: rgba(255,255,255,0.1); }

/* Empty & Loading */
.ga-empty { text-align: center; padding: 32px; color: #64748B; }
.ga-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
.ga-empty p { font-size: 0.85rem; margin: 0 0 12px; }
.ga-loading { text-align: center; color: #64748B; padding: 24px; font-size: 0.85rem; }
`;