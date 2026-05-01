/**
 * SharedGoalsPanel.tsx — Shared goal management
 *
 * Create shared goals with member assignment, per-member progress,
 * categories, deadline tracking, "who's falling behind" alerts,
 * and goal completion celebration animation.
 */

import { useState, useMemo } from 'react';
import { useFamilyCircles } from './useFamilyCircles';
import type { SharedGoal } from '../../stores/familyStore';

const CATEGORIES: { value: SharedGoal['category']; label: string; emoji: string; color: string }[] = [
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦', color: '#F59E0B' },
  { value: 'health', label: 'Health', emoji: '💪', color: '#10B981' },
  { value: 'finance', label: 'Finance', emoji: '💰', color: '#06B6D4' },
  { value: 'education', label: 'Education', emoji: '📚', color: '#8B5CF6' },
  { value: 'household', label: 'Household', emoji: '🏠', color: '#F97316' },
];

export function SharedGoalsPanel() {
  const {
    activeCircle, addSharedGoal, updateGoalProgress,
    removeSharedGoal, fallingBehind,
  } = useFamilyCircles();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<SharedGoal['category']>('family');
  const [newDeadline, setNewDeadline] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [celebratingGoal, setCelebratingGoal] = useState<string | null>(null);
  const [filter, setFilter] = useState<SharedGoal['category'] | 'all'>('all');

  const circle = activeCircle;
  if (!circle) return null;

  const goals = circle.sharedGoals;

  const filteredGoals = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter(g => g.category === filter);
  }, [goals, filter]);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    addSharedGoal(circle.id, {
      title: newTitle.trim(),
      assignedTo: Array.from(selectedMembers),
      deadline: newDeadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      category: newCategory,
    });
    setNewTitle('');
    setNewDeadline('');
    setSelectedMembers(new Set());
    setShowCreateForm(false);
  };

  const handleProgressUpdate = (goalId: string, memberId: string, progress: number) => {
    updateGoalProgress(circle.id, goalId, memberId, progress);
    if (progress >= 100) {
      // Check if all members are at 100%
      const goal = circle.sharedGoals.find(g => g.id === goalId);
      if (goal && goal.assignedTo.every(id => {
        const current = id === memberId ? 100 : (goal.progressByMember[id] ?? 0);
        return current >= 100;
      })) {
        setCelebratingGoal(goalId);
        setTimeout(() => setCelebratingGoal(null), 3000);
      }
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDaysRemaining = (deadline: string): number => {
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const getGoalAvgProgress = (goal: SharedGoal): number => {
    if (goal.assignedTo.length === 0) return 0;
    return Math.round(
      goal.assignedTo.reduce((sum, id) => sum + (goal.progressByMember[id] ?? 0), 0) / goal.assignedTo.length
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + Create Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-100">Shared Goals</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-600/40 to-rose-600/40 border border-amber-500/20 text-amber-100 hover:from-amber-500/50 hover:to-rose-500/50 transition-all"
        >
          + New Goal
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-4 rounded-xl bg-gradient-to-b from-amber-900/20 to-rose-900/20 border border-amber-500/15 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1.5 block">Goal Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="What are we working toward?"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setNewCategory(cat.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    newCategory === cat.value
                      ? 'text-white scale-105'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                  }`}
                  style={newCategory === cat.value ? {
                    backgroundColor: cat.color + '30',
                    borderColor: cat.color + '60',
                  } : {}}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1.5 block">Deadline</label>
            <input
              type="date"
              value={newDeadline}
              onChange={e => setNewDeadline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white text-sm outline-none focus:border-amber-400/50 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1.5 block">Assign To</label>
            <div className="flex flex-wrap gap-2">
              {circle.members.map(member => (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedMembers.has(member.id)
                      ? 'bg-amber-600/30 border-amber-400/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                  }`}
                >
                  <span className="text-sm">{member.avatar}</span>
                  {member.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || selectedMembers.size === 0}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              🎯 Create Goal
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
            filter === 'all' ? 'bg-amber-600/30 border border-amber-400/30 text-white' : 'bg-white/5 border border-white/5 text-white/40'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              filter === cat.value ? 'text-white' : 'bg-white/5 border border-white/5 text-white/40'
            }`}
            style={filter === cat.value ? {
              backgroundColor: cat.color + '30',
              borderColor: cat.color + '50',
            } : {}}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Celebration Animation */}
      {celebratingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-bounce">
            <span className="text-7xl block mb-4">🎉</span>
            <h2 className="text-2xl font-bold text-amber-100 mb-2">Goal Complete!</h2>
            <p className="text-sm text-amber-200/70">
              {circle.sharedGoals.find(g => g.id === celebratingGoal)?.title}
            </p>
            <div className="mt-4 text-4xl animate-pulse">🏆✨🎯</div>
          </div>
        </div>
      )}

      {/* Goals List */}
      {filteredGoals.length > 0 ? (
        <div className="space-y-3">
          {filteredGoals.map(goal => {
            const avgProgress = getGoalAvgProgress(goal);
            const daysLeft = getDaysRemaining(goal.deadline);
            const catInfo = CATEGORIES.find(c => c.value === goal.category);
            const isComplete = avgProgress >= 100;
            const isUrgent = daysLeft <= 3 && !isComplete;
            const isOverdue = daysLeft === 0 && !isComplete;

            return (
              <div
                key={goal.id}
                className={`p-4 rounded-xl border transition-all ${
                  isComplete
                    ? 'bg-emerald-900/15 border-emerald-500/20'
                    : isOverdue
                      ? 'bg-red-900/10 border-red-500/20'
                      : isUrgent
                        ? 'bg-amber-900/10 border-amber-500/15'
                        : 'bg-white/[0.03] border-white/5'
                }`}
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{catInfo?.emoji || '🎯'}</span>
                      <h4 className={`text-sm font-semibold ${isComplete ? 'text-emerald-200' : 'text-amber-100'}`}>
                        {goal.title}
                      </h4>
                      {isComplete && <span className="text-xs">✅</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                      <span>{goal.assignedTo.length} member{goal.assignedTo.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span className={isOverdue ? 'text-red-400/70' : isUrgent ? 'text-amber-400/70' : ''}>
                        {isComplete ? 'Completed!' : isOverdue ? 'Overdue!' : `${daysLeft} days left`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeSharedGoal(circle.id, goal.id)}
                    className="text-white/20 hover:text-red-400 transition-all text-xs p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Overall Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-white/30">Overall</span>
                    <span className="text-xs font-mono" style={{ color: catInfo?.color || '#F59E0B' }}>{avgProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${avgProgress}%`,
                        background: isComplete
                          ? 'linear-gradient(90deg, #10B981, #34D399)'
                          : `linear-gradient(90deg, ${catInfo?.color || '#F59E0B'}80, ${catInfo?.color || '#F59E0B'})`,
                      }}
                    />
                  </div>
                </div>

                {/* Per-Member Progress */}
                <div className="space-y-2">
                  {goal.assignedTo.map(memberId => {
                    const member = circle.members.find(m => m.id === memberId);
                    const progress = goal.progressByMember[memberId] ?? 0;
                    return (
                      <div key={memberId} className="flex items-center gap-2">
                        <span className="text-sm">{member?.avatar || '👤'}</span>
                        <span className="text-[10px] text-white/40 w-16 truncate">{member?.name || 'Unknown'}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: progress >= 100 ? '#10B981' : progress >= 50 ? '#F59E0B' : (catInfo?.color || '#3B82F6'),
                            }}
                          />
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={progress}
                          onChange={e => handleProgressUpdate(goal.id, memberId, Math.min(100, Math.max(0, Number(e.target.value))))}
                          className="w-12 text-[10px] text-center bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white/70 outline-none"
                        />
                        <span className="text-[9px] text-white/20">%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Deadline Countdown */}
                {!isComplete && (
                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]">📅</span>
                      <span className="text-[10px] text-white/30">{goal.deadline}</span>
                    </div>
                    {daysLeft <= 7 && daysLeft > 0 && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300/70 border border-amber-500/20">
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} left!
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center">
          <span className="text-4xl block mb-2">🎯</span>
          <p className="text-sm text-white/30">No shared goals yet</p>
          <p className="text-xs text-white/20 mt-1">Create one to start tracking together!</p>
        </div>
      )}

      {/* Falling Behind Alerts */}
      {fallingBehind.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">⚠️ Who's Falling Behind</h3>
          <div className="space-y-1.5">
            {fallingBehind.map((fb, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-900/10 border border-amber-500/10">
                <span className="text-lg">💛</span>
                <p className="text-xs text-amber-100/70 flex-1">
                  <span className="font-medium">{fb.name}</span> — "{fb.goalTitle}" at {fb.progress}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}