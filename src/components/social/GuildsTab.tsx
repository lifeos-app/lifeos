// LifeOS Social — Guilds Browser + Chat

import { useState, useEffect } from 'react';
import { Plus, MessageCircle, Globe, Users, CheckCircle2, TrendingUp, Award, Calendar } from 'lucide-react';
import { CategoryIcon, GUILD_ICON_OPTIONS } from './CategoryIcon';
import { supabase } from '../../lib/supabase';
import {
  getGroups,
  getUserGroups,
  joinGroup,
  leaveGroup,
  createGroup,
  getGroupMessages,
  sendGroupMessage,
  subscribeToGroup,
  logGuildContribution,
  getGuildLeaderboard,
  getGuildProgress,
  getGuildMembers,
} from '../../lib/social/groups';
import { getConversation, sendMessage } from '../../lib/social/messaging';
import { ALL_GOAL_CATEGORIES, GOAL_CATEGORY_LABELS } from '../../lib/social/types';
import type { GoalGroup, Message, GoalCategory, GuildMemberWithContribution } from '../../lib/social/types';
import { Send, ArrowLeft } from 'lucide-react';
import { genId } from '../../utils/date';
import './social.css';
import './guild-objectives.css';

interface GuildsTabProps {
  userId: string;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Group Chat ────────────────────────────────────────────────────────────────

function GroupChat({
  group,
  userId,
  onBack,
  onOpenDM,
}: { group: GoalGroup; userId: string; onBack: () => void; onOpenDM: (partnerId: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showObjective, setShowObjective] = useState(true);
  const [leaderboard, setLeaderboard] = useState<GuildMemberWithContribution[]>([]);
  const [guildProgress, setGuildProgress] = useState({ current: 0, target: 1, percentage: 0 });
  const [showLogProgress, setShowLogProgress] = useState(false);
  const [progressAmount, setProgressAmount] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [loggingProgress, setLoggingProgress] = useState(false);
  const [members, setMembers] = useState<Array<{ user_id: string; profile: any; role: string }>>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [msgs, lb, progress, mems] = await Promise.all([
        getGroupMessages(group.id),
        getGuildLeaderboard(group.id),
        getGuildProgress(group.id),
        getGuildMembers(group.id),
      ]);
      setMessages(msgs);
      setLeaderboard(lb as any);
      setGuildProgress(progress);
      setMembers(mems);
      setLoading(false);
    };
    void load();

    const unsub = subscribeToGroup(group.id, (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });
    return unsub;
  }, [group.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const optimistic: Message = {
      id: genId(),
      sender_id: userId,
      receiver_id: null,
      group_id: group.id,
      content: text,
      message_type: 'text',
      metadata: {},
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    await sendGroupMessage(group.id, userId, text);
    setSending(false);
  };

  const handleLogProgress = async () => {
    const amount = parseFloat(progressAmount);
    if (isNaN(amount) || amount <= 0 || loggingProgress) return;
    setLoggingProgress(true);
    const success = await logGuildContribution(group.id, userId, amount, progressNote || undefined);
    if (success) {
      setProgressAmount('');
      setProgressNote('');
      setShowLogProgress(false);
      // Reload leaderboard and progress
      const [lb, progress] = await Promise.all([
        getGuildLeaderboard(group.id),
        getGuildProgress(group.id),
      ]);
      setLeaderboard(lb as any);
      setGuildProgress(progress);
    }
    setLoggingProgress(false);
  };

  const objective = group.objective;
  const hasObjective = objective && objective.title;

  return (
    <div className="chat-panel" style={{ height: 520, display: 'flex', flexDirection: 'column' }}>
      <div className="chat-panel__header">
        <button className="chat-panel__back" onClick={onBack} aria-label="Go back"><ArrowLeft size={18} /></button>
        <div style={{ fontSize: 24 }}><CategoryIcon name={group.icon} size={24} /></div>
        <div>
          <div className="chat-panel__title">{group.name}</div>
          <div className="chat-panel__subtitle">{group.member_count} members · {group.category}</div>
        </div>
      </div>

      {/* Guild Objective Panel */}
      {hasObjective && showObjective && (
        <div className="guild-objective-panel">
          <div className="guild-objective-header">
            <div className="guild-objective-title">
              <TrendingUp size={14} /> {objective.title}
            </div>
            <button className="guild-objective-close" onClick={() => setShowObjective(false)}>×</button>
          </div>
          
          <div className="guild-objective-progress">
            <div className="guild-progress-bar">
              <div className="guild-progress-fill" style={{ width: `${Math.min(guildProgress.percentage, 100)}%` }} />
            </div>
            <div className="guild-progress-text">
              {guildProgress.current} / {guildProgress.target} {objective.unit} ({Math.round(guildProgress.percentage)}%)
            </div>
          </div>

          {objective.deadline && (
            <div className="guild-objective-deadline">
              <Calendar size={12} /> Deadline: {new Date(objective.deadline).toLocaleDateString()}
            </div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="guild-leaderboard">
              <div className="guild-leaderboard-title"><Award size={12} /> Top Contributors</div>
              <div className="guild-leaderboard-list">
                {leaderboard.slice(0, 5).map((member, idx) => (
                  <div key={member.user_id} className="guild-leaderboard-item">
                    <span className="guild-leaderboard-rank">#{idx + 1}</span>
                    <span className="guild-leaderboard-name">{member.profile?.display_name || 'User'}</span>
                    <span className="guild-leaderboard-score">{member.total_contribution} {objective.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="guild-log-progress-btn" onClick={() => setShowLogProgress(!showLogProgress)}>
            <Plus size={14} /> Log Progress
          </button>

          {showLogProgress && (
            <div className="guild-log-progress-form">
              <input
                type="number"
                min="0"
                step="0.1"
                className="guild-progress-input"
                placeholder={`Amount (${objective.unit})`}
                value={progressAmount}
                onChange={e => setProgressAmount(e.target.value)}
              />
              <input
                type="text"
                className="guild-progress-note"
                placeholder="Note (optional)"
                value={progressNote}
                onChange={e => setProgressNote(e.target.value)}
                maxLength={100}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button 
                  className="guild-progress-submit" 
                  onClick={handleLogProgress}
                  disabled={loggingProgress || !progressAmount || parseFloat(progressAmount) <= 0}
                >
                  {loggingProgress ? 'Logging...' : 'Submit'}
                </button>
                <button className="guild-progress-cancel" onClick={() => setShowLogProgress(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasObjective && !showObjective && (
        <button className="guild-show-objective-btn" onClick={() => setShowObjective(true)}>
          <TrendingUp size={12} /> Show Objective
        </button>
      )}

      {/* Members bar (for DMs) */}
      {members.length > 0 && (
        <div className="guild-members-bar">
          {members.slice(0, 8).map(member => (
            <button
              key={member.user_id}
              className="guild-member-avatar"
              onClick={() => member.user_id !== userId && onOpenDM(member.user_id)}
              title={`${member.profile?.display_name || 'User'} (${member.role})`}
            >
              {member.profile?.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" />
              ) : (
                <span>{getInitials(member.profile?.display_name || 'U')}</span>
              )}
            </button>
          ))}
          {members.length > 8 && <span className="guild-member-more">+{members.length - 8}</span>}
        </div>
      )}

      <div className="chat-messages" style={{ flex: 1 }}>
        {loading && <div style={{ textAlign: 'center', color: '#4B5563', padding: 20, fontSize: 13 }}>Loading…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><MessageCircle size={32} color="#4B5563" /></div>
            <div style={{ fontSize: 14 }}>Be the first to say hi!</div>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          const sender = members.find(m => m.user_id === msg.sender_id);
          return (
            <div key={msg.id} className={`chat-bubble chat-bubble--${isMe ? 'me' : 'them'}`}>
              {!isMe && (
                <div 
                  style={{ fontSize: 11, color: '#6B7280', marginBottom: 3, cursor: 'pointer' }}
                  onClick={() => onOpenDM(msg.sender_id)}
                  title="Click to send DM"
                >
                  {sender?.profile?.display_name || getInitials(msg.sender_id)}
                </div>
              )}
              <div className="chat-bubble__content">{msg.content}</div>
              <div className="chat-bubble__time">{formatTime(msg.created_at)}</div>
            </div>
          );
        })}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={`Message ${group.name}…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }}
          rows={1}
        />
        <button className="chat-send-btn" onClick={() => void handleSend()} disabled={!input.trim() || sending}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Guilds Browser ────────────────────────────────────────────────────────────

interface GuildsTabProps {
  userId: string;
  onOpenDM?: (partnerId: string) => void;
}

export function GuildsTab({ userId, onOpenDM }: GuildsTabProps) {
  const [groups, setGroups] = useState<GoalGroup[]>([]);
  const [userGroups, setUserGroups] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GoalGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [createName, setCreateName] = useState('');
  const [createCat, setCreateCat] = useState<GoalCategory>('fitness');
  const [createDesc, setCreateDesc] = useState('');
  const [createIcon, setCreateIcon] = useState('target');
  const [creating, setCreating] = useState(false);
  // Objective fields
  const [createObjTitle, setCreateObjTitle] = useState('');
  const [createObjTarget, setCreateObjTarget] = useState('');
  const [createObjUnit, setCreateObjUnit] = useState('');
  const [createObjDeadline, setCreateObjDeadline] = useState('');

  const load = async () => {
    setLoading(true);
    const [all, mine] = await Promise.all([
      getGroups(categoryFilter || undefined),
      getUserGroups(userId),
    ]);
    setGroups(all);
    setUserGroups(new Set(mine.map(g => g.id)));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId, categoryFilter]);

  const handleJoin = async (groupId: string) => {
    await joinGroup(groupId, userId);
    setUserGroups(prev => new Set([...prev, groupId]));
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g));
  };

  const handleLeave = async (groupId: string) => {
    await leaveGroup(groupId, userId);
    setUserGroups(prev => { const s = new Set(prev); s.delete(groupId); return s; });
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);

    // Build objective if filled
    let objective = null;
    if (createObjTitle.trim() && createObjTarget && createObjUnit.trim()) {
      objective = {
        title: createObjTitle.trim(),
        target_value: parseFloat(createObjTarget),
        unit: createObjUnit.trim(),
        deadline: createObjDeadline || undefined,
      };
    }

    // Create group (will need to update createGroup to accept objective)
    const { data, error } = await supabase
      .from('goal_groups')
      .insert({
        name: createName.trim(),
        category: createCat,
        created_by: userId,
        description: createDesc || null,
        icon: createIcon,
        objective,
      })
      .select()
      .single();

    if (!error && data) {
      // Join as owner
      await supabase.from('goal_group_members').insert({
        group_id: data.id,
        user_id: userId,
        role: 'owner',
      });

      setGroups(prev => [data as GoalGroup, ...prev]);
      setUserGroups(prev => new Set([...prev, data.id]));
      setCreateName('');
      setCreateDesc('');
      setCreateObjTitle('');
      setCreateObjTarget('');
      setCreateObjUnit('');
      setCreateObjDeadline('');
      setShowCreate(false);
    }
    setCreating(false);
  };

  if (activeGroup) {
    return (
      <GroupChat
        group={activeGroup}
        userId={userId}
        onBack={() => setActiveGroup(null)}
        onOpenDM={(partnerId) => {
          setActiveGroup(null);
          onOpenDM?.(partnerId);
        }}
      />
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <select
          className="find-partners__filter-select"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {ALL_GOAL_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              <CategoryIcon name={GOAL_CATEGORY_LABELS[cat as GoalCategory].icon} size={14} /> {GOAL_CATEGORY_LABELS[cat as GoalCategory].label}
            </option>
          ))}
        </select>

        <button
          className="profile-card__btn profile-card__btn--primary"
          style={{ width: 'auto', padding: '9px 18px' }}
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={14} /> Found a Guild
        </button>
      </div>

      {/* Create guild form */}
      {showCreate && (
        <div className="profile-setup__section" style={{ marginBottom: 20 }}>
          <div className="profile-setup__section-title">Found a New Guild</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              className="profile-setup__input"
              type="text"
              placeholder="Guild name"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              maxLength={60}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="find-partners__filter-select"
                style={{ flex: 1 }}
                value={createCat}
                onChange={e => setCreateCat(e.target.value as GoalCategory)}
              >
                {ALL_GOAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    <CategoryIcon name={GOAL_CATEGORY_LABELS[cat as GoalCategory].icon} size={14} /> {GOAL_CATEGORY_LABELS[cat as GoalCategory].label}
                  </option>
                ))}
              </select>
              <select
                className="find-partners__filter-select"
                value={createIcon}
                onChange={e => setCreateIcon(e.target.value)}
                style={{ width: 90 }}
              >
                {GUILD_ICON_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <textarea
              className="profile-setup__textarea"
              placeholder="Description (optional)"
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
              rows={2}
              maxLength={200}
            />
            
            {/* Guild Objective (optional) */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                Guild Objective (optional)
              </div>
              <input
                className="profile-setup__input"
                type="text"
                placeholder="Objective title (e.g., Read 12 books this year)"
                value={createObjTitle}
                onChange={e => setCreateObjTitle(e.target.value)}
                maxLength={100}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  className="profile-setup__input"
                  type="number"
                  min="1"
                  placeholder="Target"
                  value={createObjTarget}
                  onChange={e => setCreateObjTarget(e.target.value)}
                  style={{ width: '30%' }}
                />
                <input
                  className="profile-setup__input"
                  type="text"
                  placeholder="Unit (e.g., books)"
                  value={createObjUnit}
                  onChange={e => setCreateObjUnit(e.target.value)}
                  maxLength={20}
                  style={{ flex: 1 }}
                />
                <input
                  className="profile-setup__input"
                  type="date"
                  placeholder="Deadline"
                  value={createObjDeadline}
                  onChange={e => setCreateObjDeadline(e.target.value)}
                  style={{ width: '35%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                className="profile-card__btn profile-card__btn--secondary"
                style={{ width: 'auto', padding: '8px 18px' }}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="profile-card__btn profile-card__btn--primary"
                style={{ width: 'auto', padding: '8px 18px' }}
                onClick={() => void handleCreate()}
                disabled={creating || !createName.trim()}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guilds grid */}
      {loading ? (
        <div className="groups-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="social-skeleton" style={{ height: 180 }} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty__icon"><Globe size={32} /></div>
          <div className="social-empty__title">No guilds yet</div>
          <div className="social-empty__sub">Create the first guild for your goal category!</div>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(group => {
            const isMember = userGroups.has(group.id);
            return (
              <div key={group.id} className="group-card" onClick={() => isMember && setActiveGroup(group)}>
                <div className="group-card__icon"><CategoryIcon name={group.icon} size={24} /></div>
                <div className="group-card__name">{group.name}</div>
                <div className="group-card__cat">{group.category}</div>
                {group.description && <div className="group-card__desc">{group.description}</div>}
                {group.objective && (
                  <div className={`group-card__objective${group.member_count < 2 ? ' group-card__objective--disabled' : ''}`}>
                    {group.objective.title}
                    {group.member_count < 2 && <span className="group-card__needs-members">Needs 2+ members</span>}
                  </div>
                )}
                <div className="group-card__members" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} />{group.member_count} members</div>
                <div className={`guild-status-badge guild-status--${group.member_count >= 2 ? 'active' : 'forming'}`}>
                  {group.member_count < 2 ? 'Forming — invite members!' : `Active · ${group.member_count} members`}
                </div>
                <button
                  className={`group-card__join-btn ${isMember ? 'joined' : ''}`}
                  onClick={e => {
                    e.stopPropagation();
                    if (isMember) { void handleLeave(group.id); } else { void handleJoin(group.id); }
                  }}
                >
                  {isMember ? <><CheckCircle2 size={12} style={{ marginRight: 4 }} />Joined — Open Chat</> : 'Join Guild'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GuildsTab;
