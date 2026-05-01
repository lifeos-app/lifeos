/**
 * MemberManager.tsx — Member management
 *
 * Add/remove members, role assignment with permission controls,
 * invite code display and sharing (QR code + link), member activity
 * summary, permission matrix, and leave circle option.
 */

import { useState, useMemo } from 'react';
import { useFamilyCircles } from './useFamilyCircles';
import type { MemberRole, MemberPermission } from '../../stores/familyStore';

const ROLE_BADGES: Record<MemberRole, { label: string; color: string; bg: string; border: string }> = {
  parent: { label: 'Parent', color: '#F59E0B', bg: 'bg-amber-900/40', border: 'border-amber-500/30' },
  partner: { label: 'Partner', color: '#EC4899', bg: 'bg-pink-900/40', border: 'border-pink-500/30' },
  child: { label: 'Child', color: '#3B82F6', bg: 'bg-blue-900/40', border: 'border-blue-500/30' },
  guardian: { label: 'Guardian', color: '#10B981', bg: 'bg-emerald-900/40', border: 'border-emerald-500/30' },
  other: { label: 'Member', color: '#8B5CF6', bg: 'bg-violet-900/40', border: 'border-violet-500/30' },
};

const PERMISSION_LABELS: Record<MemberPermission, { label: string; icon: string }> = {
  view_budget: { label: 'View Budget', icon: '👁️' },
  edit_budget: { label: 'Edit Budget', icon: '✏️' },
  view_goals: { label: 'View Goals', icon: '👁️' },
  edit_goals: { label: 'Edit Goals', icon: '✏️' },
  view_habits: { label: 'View Habits', icon: '👁️' },
  edit_habits: { label: 'Log Habits', icon: '✏️' },
  manage_members: { label: 'Manage Members', icon: '👥' },
  nudge: { label: 'Nudge Members', icon: '💕' },
  view_schedule: { label: 'View Schedule', icon: '📅' },
  manage_allowance: { label: 'Manage Allowance', icon: '💵' },
};

const ALL_PERMISSIONS: MemberPermission[] = [
  'view_budget', 'edit_budget', 'view_goals', 'edit_goals',
  'view_habits', 'edit_habits', 'manage_members', 'nudge',
  'view_schedule', 'manage_allowance',
];

export function MemberManager() {
  const {
    activeCircle, addMember, removeMember,
    updateRole, updatePermissions, leaveCircle,
  } = useFamilyCircles();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showInviteShare, setShowInviteShare] = useState(false);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Add member form
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('child');

  // Expanded member for permission editing
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const circle = activeCircle;
  if (!circle) return null;

  const inviteLink = `https://lifeos.app/family/join/${circle.inviteCode}`;

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMember(circle.id, {
      name: newName.trim(),
      avatar: '👤',
      role: newRole,
    });
    setNewName('');
    setNewRole('child');
    setShowAddForm(false);
  };

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText(inviteLink).catch(() => {});
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(circle.inviteCode).catch(() => {});
  };

  // Member activity summary
  const memberSummary = useMemo(() => {
    return circle.members.map(member => {
      const goalCount = circle.sharedGoals.filter(g => g.assignedTo.includes(member.id)).length;
      const habitCount = circle.sharedHabits.filter(h => h.assignedTo.includes(member.id)).length;
      return { member, goalCount, habitCount };
    });
  }, [circle]);

  return (
    <div className="space-y-4">
      {/* Invite Code Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 to-rose-900/20 border border-amber-500/15">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔗</span>
          <h3 className="text-sm font-semibold text-amber-100">Invite Code</h3>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-amber-500/20 font-mono text-2xl tracking-[0.3em] text-center text-amber-100">
            {circle.inviteCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-3 rounded-xl bg-amber-600/30 border border-amber-500/20 text-xs font-medium text-amber-100 hover:bg-amber-500/40 transition-all"
          >
            📋
          </button>
        </div>
        <button
          onClick={() => setShowInviteShare(!showInviteShare)}
          className="w-full py-2 rounded-lg text-xs text-amber-200/50 hover:text-amber-200/70 transition-all"
        >
          {showInviteShare ? 'Hide' : 'Show'} invite link & sharing options
        </button>
        {showInviteShare && (
          <div className="mt-3 pt-3 border-t border-amber-500/10 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/50 truncate"
              />
              <button
                onClick={handleCopyInvite}
                className="px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/15 text-xs text-amber-200 hover:bg-amber-500/30 transition-all"
              >
                Copy
              </button>
            </div>
            {/* QR Code Placeholder */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="w-32 h-32 mx-auto bg-white rounded-lg flex items-center justify-center mb-2">
                <div className="grid grid-cols-8 gap-0.5 w-24 h-24">
                  {Array.from({ length: 64 }, (_, i) => (
                    <div
                      key={i}
                      className={`rounded-[1px] ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-white/30">QR Code — scan to join</p>
            </div>
          </div>
        )}
      </div>

      {/* Members List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50">Members ({circle.members.length})</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-amber-600/20 border border-amber-500/15 text-amber-200 hover:bg-amber-500/30 transition-all"
          >
            + Add
          </button>
        </div>

        {/* Add Member Form */}
        {showAddForm && (
          <div className="mb-3 p-3 rounded-xl bg-gradient-to-b from-amber-900/20 to-rose-900/20 border border-amber-500/15 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Member's name"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
            />
            <div className="flex gap-1.5">
              {(['parent', 'partner', 'child', 'guardian', 'other'] as MemberRole[]).map(role => {
                const badge = ROLE_BADGES[role];
                return (
                  <button
                    key={role}
                    onClick={() => setNewRole(role)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                      newRole === role ? badge.bg + ' ' + badge.border + ' text-white' : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    {badge.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-500 to-rose-500 text-black disabled:opacity-40 transition-all"
              >
                Add Member
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Member Cards */}
        <div className="space-y-2">
          {memberSummary.map(({ member, goalCount, habitCount }) => {
            const badge = ROLE_BADGES[member.role];
            const isExpanded = expandedMember === member.id;

            return (
              <div key={member.id} className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                {/* Member Header */}
                <button
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600/30 to-rose-600/30 flex items-center justify-center text-lg border border-amber-400/15">
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-amber-100 truncate">{member.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold border ${badge.bg} ${badge.border}`} style={{ color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/30 mt-0.5">
                      <span>🎯 {goalCount} goals</span>
                      <span>✅ {habitCount} habits</span>
                      <span>🔥 {member.streakContribution} streak</span>
                    </div>
                  </div>
                  <span className="text-white/20 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded: Role + Permissions */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-3">
                    {/* Role Selector */}
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/30 mb-1.5 block">Role</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['parent', 'partner', 'child', 'guardian', 'other'] as MemberRole[]).map(role => {
                          const rb = ROLE_BADGES[role];
                          return (
                            <button
                              key={role}
                              onClick={() => updateRole(circle.id, member.id, role)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                                member.role === role ? rb.bg + ' ' + rb.border + ' text-white' : 'bg-white/5 border-white/10 text-white/40'
                              }`}
                            >
                              {rb.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Permissions */}
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/30 mb-1.5 block">Permissions</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ALL_PERMISSIONS.map(perm => {
                          const has = member.permissions.includes(perm);
                          const info = PERMISSION_LABELS[perm];
                          return (
                            <button
                              key={perm}
                              onClick={() => {
                                const newPerms = has
                                  ? member.permissions.filter(p => p !== perm)
                                  : [...member.permissions, perm];
                                updatePermissions(circle.id, member.id, newPerms);
                              }}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border text-left ${
                                has
                                  ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-200'
                                  : 'bg-white/[0.02] border-white/5 text-white/30'
                              }`}
                            >
                              <span>{has ? '✅' : '⬜'}</span>
                              {info.icon} {info.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Remove */}
                    {circle.members.length > 1 && (
                      <button
                        onClick={() => {
                          removeMember(circle.id, member.id);
                          setExpandedMember(null);
                        }}
                        className="w-full py-2 rounded-lg text-xs text-red-300/60 bg-red-900/10 border border-red-500/10 hover:bg-red-900/20 hover:text-red-300 transition-all"
                      >
                        Remove from Circle
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Permission Matrix */}
      <div>
        <button
          onClick={() => setShowPermissionMatrix(!showPermissionMatrix)}
          className="w-full text-left py-2 text-[10px] uppercase tracking-widest text-amber-300/50 hover:text-amber-300/70 transition-all"
        >
          {showPermissionMatrix ? '▼' : '▶'} Permission Matrix
        </button>
        {showPermissionMatrix && (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-[9px] min-w-[400px]">
              <thead>
                <tr>
                  <th className="text-left text-white/30 py-1 px-1">Permission</th>
                  {(['parent', 'partner', 'guardian', 'child', 'other'] as MemberRole[]).map(role => (
                    <th key={role} className="text-center py-1 px-1" style={{ color: ROLE_BADGES[role].color }}>
                      {ROLE_BADGES[role].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map(perm => {
                  const info = PERMISSION_LABELS[perm];
                  const roleDefaults: Record<MemberRole, MemberPermission[]> = {
                    parent: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule', 'manage_allowance'],
                    partner: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule'],
                    guardian: ['view_budget', 'edit_budget', 'view_goals', 'edit_goals', 'view_habits', 'edit_habits', 'manage_members', 'nudge', 'view_schedule', 'manage_allowance'],
                    child: ['view_budget', 'view_goals', 'view_habits', 'edit_habits', 'view_schedule'],
                    other: ['view_goals', 'view_habits'],
                  };
                  return (
                    <tr key={perm} className="border-t border-white/5">
                      <td className="py-1 px-1 text-white/50">{info.icon} {info.label}</td>
                      {(['parent', 'partner', 'guardian', 'child', 'other'] as MemberRole[]).map(role => (
                        <td key={role} className="text-center py-1 px-1">
                          {roleDefaults[role].includes(perm) ? '✅' : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Circle */}
      <div className="pt-4 border-t border-white/5">
        {showLeaveConfirm ? (
          <div className="p-4 rounded-xl bg-red-900/15 border border-red-500/15 space-y-2">
            <p className="text-xs text-red-200/70">Are you sure you want to leave "{circle.name}"? You'll lose access to all shared data.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { leaveCircle(circle.id); setShowLeaveConfirm(false); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600/40 border border-red-500/30 text-red-200 hover:bg-red-500/50 transition-all"
              >
                Yes, Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full py-2.5 rounded-xl text-xs text-red-300/40 bg-red-900/5 border border-red-500/10 hover:text-red-300/70 hover:bg-red-900/10 transition-all"
          >
            Leave Circle
          </button>
        )}
      </div>
    </div>
  );
}