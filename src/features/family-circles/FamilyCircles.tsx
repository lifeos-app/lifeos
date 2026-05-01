/**
 * FamilyCircles.tsx — Main page for Family Circles
 *
 * "My Circle" overview, create/join flow, member avatars with roles,
 * shared activity feed, circle health score, achievements, and quick actions.
 * Warm, intimate, and cozy — this is the family layer of LifeOS.
 */

import { useState } from 'react';
import { useFamilyCircles } from './useFamilyCircles';
import { CircleDashboard } from './CircleDashboard';
import { SharedGoalsPanel } from './SharedGoalsPanel';
import { SharedBudgetPanel } from './SharedBudgetPanel';
import { MemberManager } from './MemberManager';
import { FamilyAchievements } from './FamilyAchievements';
import type { MemberRole } from '../../stores/familyStore';

type Tab = 'overview' | 'goals' | 'budget' | 'members' | 'achievements';

const ROLE_BADGES: Record<MemberRole, { label: string; color: string; bg: string }> = {
  parent: { label: 'Parent', color: '#F59E0B', bg: 'bg-amber-900/40 border-amber-500/30' },
  partner: { label: 'Partner', color: '#EC4899', bg: 'bg-pink-900/40 border-pink-500/30' },
  child: { label: 'Child', color: '#3B82F6', bg: 'bg-blue-900/40 border-blue-500/30' },
  guardian: { label: 'Guardian', color: '#10B981', bg: 'bg-emerald-900/40 border-emerald-500/30' },
  other: { label: 'Member', color: '#8B5CF6', bg: 'bg-violet-900/40 border-violet-500/30' },
};

export function FamilyCircles() {
  const {
    circles, activeCircle, activeCircleId, isLoaded, isCreating,
    joinError, circleHealth, todayActivity, recentActivity,
    createCircle, joinCircle, setActiveCircle, leaveCircle,
    nudgeMember,
  } = useFamilyCircles();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('👨‍👩‍👧‍👦');
  const [creatorName, setCreatorName] = useState('');
  const [creatorRole, setCreatorRole] = useState<MemberRole>('parent');

  // Join form state
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinRole, setJoinRole] = useState<MemberRole>('partner');

  const EMOJIS = ['👨‍👩‍👧‍👦', '🏠', '💕', '🌟', '🏠', '🦁', '🌺', '⚡', '🌙', '🦋', '🎵', '🍀'];

  const handleCreate = () => {
    if (!newName.trim() || !creatorName.trim()) return;
    createCircle(newName.trim(), newEmoji, {
      name: creatorName.trim(),
      avatar: newEmoji,
      role: creatorRole,
    });
    setShowCreateFlow(false);
    setNewName('');
    setNewEmoji('👨‍👩‍👧‍👦');
    setCreatorName('');
  };

  const handleJoin = () => {
    if (!inviteCode.trim() || !joinName.trim()) return;
    joinCircle(inviteCode.trim(), {
      name: joinName.trim(),
      avatar: '👤',
      role: joinRole,
    });
  };

  // ── Empty State / Onboarding ─────────────────────────────────

  if (!activeCircle && circles.length === 0 && isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0f2e] via-[#1f1535] to-[#1a0f2e] text-white">
        <div className="px-4 pt-12 pb-6 text-center">
          <span className="text-6xl block mb-4">🏠</span>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-rose-200 to-pink-200 bg-clip-text text-transparent mb-2">
            Family Circles
          </h1>
          <p className="text-sm text-rose-200/60 max-w-xs mx-auto">
            Your private family space. Shared goals, budgets, habits — all synced in real-time with the people who matter most.
          </p>
        </div>

        <div className="px-6 space-y-3 pb-32">
          {!showCreateFlow && !showJoinFlow && (
            <>
              <button
                onClick={() => setShowCreateFlow(true)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600/50 to-rose-600/50 hover:from-amber-500/60 hover:to-rose-500/60 border border-amber-400/20 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">✨</span> Create a Family Circle
              </button>
              <button
                onClick={() => setShowJoinFlow(true)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600/30 to-violet-600/30 hover:from-pink-500/40 hover:to-violet-500/40 border border-pink-400/15 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">🔗</span> Join with Invite Code
              </button>
            </>
          )}

          {showCreateFlow && (
            <div className="space-y-4 p-5 rounded-2xl bg-gradient-to-b from-amber-900/20 to-rose-900/20 border border-amber-500/15">
              <h2 className="text-lg font-semibold text-amber-100">Create Your Circle</h2>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-amber-300/60 mb-1.5 block">Circle Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="The Johnsons, Our Village..."
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-amber-300/60 mb-1.5 block">Choose an Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewEmoji(e)}
                      className={`text-2xl w-10 h-10 rounded-lg transition-all ${
                        newEmoji === e ? 'bg-amber-500/30 scale-110 border border-amber-400/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-amber-300/60 mb-1.5 block">Your Name</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={e => setCreatorName(e.target.value)}
                  placeholder="How should your family know you?"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-amber-300/60 mb-1.5 block">Your Role</label>
                <div className="flex flex-wrap gap-2">
                  {(['parent', 'partner', 'guardian'] as MemberRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => setCreatorRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        creatorRole === role
                          ? ROLE_BADGES[role].bg + ' text-white scale-105'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                      }`}
                    >
                      {ROLE_BADGES[role].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !creatorName.trim() || isCreating}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  🏠 Create Circle
                </button>
                <button
                  onClick={() => setShowCreateFlow(false)}
                  className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 hover:text-white/80 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showJoinFlow && (
            <div className="space-y-4 p-5 rounded-2xl bg-gradient-to-b from-pink-900/20 to-violet-900/20 border border-pink-500/15">
              <h2 className="text-lg font-semibold text-pink-100">Join a Circle</h2>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-pink-300/60 mb-1.5 block">Invite Code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-pink-500/20 text-white placeholder-white/30 text-sm tracking-widest font-mono outline-none focus:border-pink-400/50 text-center text-lg"
                />
              </div>

              {joinError && (
                <p className="text-xs text-red-400 text-center">{joinError}</p>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-widest text-pink-300/60 mb-1.5 block">Your Name</label>
                <input
                  type="text"
                  value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-pink-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-pink-400/50"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-pink-300/60 mb-1.5 block">Your Role</label>
                <div className="flex flex-wrap gap-2">
                  {(['parent', 'partner', 'child', 'guardian', 'other'] as MemberRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => setJoinRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        joinRole === role
                          ? ROLE_BADGES[role].bg + ' text-white scale-105'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                      }`}
                    >
                      {ROLE_BADGES[role].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleJoin}
                  disabled={!inviteCode.trim() || !joinName.trim()}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  🔗 Join Circle
                </button>
                <button
                  onClick={() => { setShowJoinFlow(false); setJoinError(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 hover:text-white/80 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Has Circles but No Active ───────────────────────────────

  if (!activeCircle && circles.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0f2e] via-[#1f1535] to-[#1a0f2e] text-white">
        <div className="px-4 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-rose-200 to-pink-200 bg-clip-text text-transparent">
              Family Circles
            </h1>
          </div>
          <p className="text-sm text-rose-200/60 mb-4">Choose a circle to dive in:</p>
        </div>
        <div className="px-4 space-y-3 pb-24">
          {circles.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCircle(c.id)}
              className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 to-rose-900/20 border border-amber-500/15 hover:border-amber-400/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{c.emoji}</span>
                <div>
                  <h3 className="text-base font-semibold text-amber-100">{c.name}</h3>
                  <p className="text-xs text-amber-300/50">{c.members.length} member{c.members.length !== 1 ? 's' : ''} · 🔥 {c.familyStreak} day streak</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Active Circle View ──────────────────────────────────────

  const circle = activeCircle!;
  const healthColor = circleHealth >= 70 ? '#10B981' : circleHealth >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f2e] via-[#1f1535] to-[#1a0f2e] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{circle.emoji}</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-rose-200 to-pink-200 bg-clip-text text-transparent">
              {circle.name}
            </h1>
          </div>
          {circles.length > 1 && (
            <button
              onClick={() => setActiveCircle('' as any)}
              className="px-2.5 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white/70 transition-all"
            >
              Switch
            </button>
          )}
        </div>
        <p className="text-xs text-rose-200/50 ml-9 -mt-1">
          {circle.members.length} member{circle.members.length !== 1 ? 's' : ''} · 🔥 {circle.familyStreak} day streak · Health: <span style={{ color: healthColor }}>{circleHealth}%</span>
        </p>
      </div>

      {/* Circle Health Bar */}
      <div className="px-4 mb-4">
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-900/20 to-rose-900/20 border border-amber-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-100">Circle Health</span>
            <span className="text-lg font-bold" style={{ color: healthColor }}>
              {circleHealth}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${circleHealth}%`,
                background: `linear-gradient(90deg, ${healthColor}80, ${healthColor})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-amber-300/40">
            <span>Needs attention</span>
            <span>Thriving</span>
          </div>
        </div>
      </div>

      {/* Member Avatars Row */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {circle.members.map(member => {
            const badge = ROLE_BADGES[member.role];
            return (
              <div key={member.id} className="flex flex-col items-center gap-1 min-w-[56px]">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600/40 to-rose-600/40 flex items-center justify-center text-xl border-2 border-amber-400/20">
                    {member.avatar}
                  </div>
                  <div
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap ${badge.bg}`}
                    style={{ color: badge.color }}
                  >
                    {badge.label}
                  </div>
                </div>
                <span className="text-[10px] text-white/50 mt-1.5 truncate max-w-[56px]">
                  {member.name}
                </span>
              </div>
            );
          })}
          {circle.members.length < 8 && (
            <div className="flex flex-col items-center gap-1 min-w-[56px]">
              <button
                onClick={() => setActiveTab('members')}
                className="w-12 h-12 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-lg hover:border-amber-400/40 hover:bg-amber-900/20 transition-all"
              >
                +
              </button>
              <span className="text-[10px] text-white/30 mt-2">Add</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/5">
          {([
            { id: 'overview' as Tab, label: 'Overview', emoji: '📊' },
            { id: 'goals' as Tab, label: 'Goals', emoji: '🎯' },
            { id: 'budget' as Tab, label: 'Budget', emoji: '💰' },
            { id: 'members' as Tab, label: 'Members', emoji: '👥' },
            { id: 'achievements' as Tab, label: 'Trophies', emoji: '🏆' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-600/40 to-rose-600/40 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('goals')}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/15 text-xs font-medium text-emerald-200 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all"
          >
            🎯 Add Goal
          </button>
          <button
            onClick={() => {
              if (circle.members.length > 1) {
                nudgeMember(circle.id, circle.members[1].id, circle.members[0].id);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600/20 to-rose-600/20 border border-pink-500/15 text-xs font-medium text-pink-200 hover:from-pink-500/30 hover:to-rose-500/30 transition-all"
          >
            💕 Nudge
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border border-amber-500/15 text-xs font-medium text-amber-200 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all"
          >
            💵 Log Expense
          </button>
        </div>
      </div>

      {/* Today's Activity Feed */}
      <div className="px-4 mb-4">
        <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Today's Activity</h3>
        <div className="space-y-2">
          {todayActivity.length > 0 ? todayActivity.slice(0, 6).map(a => (
            <ActivityItem key={a.id} entry={a} />
          )) : (
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
              <span className="text-2xl block mb-1">🌅</span>
              <p className="text-xs text-white/30">No activity yet today. Be the first to log something!</p>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-24">
        {activeTab === 'overview' && <CircleDashboard />}
        {activeTab === 'goals' && <SharedGoalsPanel />}
        {activeTab === 'budget' && <SharedBudgetPanel />}
        {activeTab === 'members' && <MemberManager />}
        {activeTab === 'achievements' && <FamilyAchievements />}
      </div>
    </div>
  );
}

function ActivityItem({ entry }: { entry: { type: string; memberName: string; description: string; timestamp: string } }) {
  const typeEmojis: Record<string, string> = {
    habit: '✅',
    goal: '🎯',
    budget: '💵',
    nudge: '💕',
    achievement: '🏆',
    member: '👋',
  };
  const timeAgo = getTimeAgo(entry.timestamp);

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
      <span className="text-sm mt-0.5">{typeEmojis[entry.type] || '•'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70">
          <span className="font-medium text-amber-100">{entry.memberName || 'Family'}</span>
          {' '}{entry.description}
        </p>
        <span className="text-[9px] text-white/25">{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}