/**
 * MentorDashboard — Mentor's view of active mentees
 *
 * Shows mentees with progress cards, milestone tracker,
 * nudge button, session scheduler, and mentorship tips.
 */

import { useState } from 'react';
import { useMentorship } from './useMentorship';
import type { MentorshipPair, MentorshipMilestone } from '../../stores/mentorshipStore';

export function MentorDashboard() {
  const {
    myActiveMentorships,
    completeMilestone,
    updateNotes,
    pauseMentorship,
    resumeMentorship,
  } = useMentorship();

  const [selectedMentee, setSelectedMentee] = useState<string | null>(
    myActiveMentorships[0]?.id ?? null
  );
  const [notesValue, setNotesValue] = useState('');
  const [showNudge, setShowNudge] = useState<string | null>(null);

  const activePair = myActiveMentorships.find(p => p.id === selectedMentee);

  const TIPS = [
    '🎯 Start with small, achievable goals for your mentee.',
    '👏 Celebrate every milestone — consistency beats intensity.',
    '📝 Leave notes after each session to track progress.',
    '⏰ Use the "Nudge" feature gently — encouragement, not pressure.',
    '🌟 Share your own challenges — vulnerability builds trust.',
    '📊 Focus on progress, not perfection.',
    '🔄 Review milestones weekly and adjust as needed.',
  ];

  const [tipIndex, setTipIndex] = useState(0);

  const handleNudge = (menteeId: string) => {
    setShowNudge(menteeId);
    setTimeout(() => setShowNudge(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/30 via-stone-950/50 to-stone-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🧙</div>
          <div>
            <h1 className="text-xl font-bold text-amber-200">Mentor Dashboard</h1>
            <p className="text-stone-400 text-sm">{myActiveMentorships.length} active mentee{myActiveMentorships.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="bg-amber-600/20 px-3 py-1.5 rounded-full text-amber-300 text-xs font-medium border border-amber-600/30">
          🌟 Mentor Mode
        </div>
      </div>

      {/* Mentee cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myActiveMentorships.map(pair => (
          <button
            key={pair.id}
            onClick={() => setSelectedMentee(pair.id)}
            className={`text-left bg-stone-900/60 rounded-xl p-4 border transition-all ${
              selectedMentee === pair.id
                ? 'border-amber-500/50 bg-amber-950/20'
                : 'border-stone-700/50 hover:border-amber-700/50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center text-lg">
                  🎓
                </div>
                <div>
                  <div className="text-stone-200 font-medium text-sm">{pair.mentee_id === 'current-user' ? 'You' : 'Mentee'}</div>
                  <div className="text-stone-400 text-xs">{pair.specializations.join(', ')}</div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                pair.status === 'active'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                  : pair.status === 'paused'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                  : 'bg-stone-600/20 text-stone-300 border border-stone-500/30'
              }`}>
                {pair.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-400">Progress</span>
                <span className="text-amber-300 font-medium">{pair.mentee_progress}%</span>
              </div>
              <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                  style={{ width: `${pair.mentee_progress}%` }}
                />
              </div>
            </div>

            {/* Milestone summary */}
            <div className="flex justify-between mt-2 text-xs text-stone-400">
              <span>{pair.milestones.filter(m => m.completed).length}/{pair.milestones.length} milestones</span>
              <span>{pair.sessions_completed} sessions</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected mentee details */}
      {activePair && (
        <div className="bg-stone-900/60 rounded-xl border border-amber-700/30 overflow-hidden space-y-0">
          {/* Milestones */}
          <div className="p-5 space-y-4">
            <h3 className="text-amber-200 font-semibold flex items-center gap-2">
              🏆 Milestones
            </h3>
            <div className="space-y-2">
              {activePair.milestones.map((milestone, idx) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  index={idx}
                  onComplete={() => completeMilestone(activePair.id, milestone.id)}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-stone-700/50 p-5 space-y-4">
            <h3 className="text-amber-200 font-semibold flex items-center gap-2">
              ⚡ Quick Actions
            </h3>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleNudge(activePair.mentee_id)}
                className="px-4 py-2 bg-amber-600/20 text-amber-300 rounded-lg text-sm font-medium border border-amber-600/30 hover:bg-amber-600/30 transition-all"
              >
                {showNudge === activePair.mentee_id ? '✅ Nudge sent!' : '🔔 Nudge Mentee'}
              </button>

              {activePair.status === 'active' && (
                <button
                  onClick={() => pauseMentorship(activePair.id)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-lg text-sm border border-stone-700 hover:border-amber-600/50 transition-all"
                >
                  ⏸️ Pause
                </button>
              )}
              {activePair.status === 'paused' && (
                <button
                  onClick={() => resumeMentorship(activePair.id)}
                  className="px-4 py-2 bg-emerald-600/20 text-emerald-300 rounded-lg text-sm border border-emerald-600/30 hover:bg-emerald-600/30 transition-all"
                >
                  ▶️ Resume
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-stone-400 text-sm">Session Notes</label>
              <textarea
                value={notesValue || activePair.mentor_notes || ''}
                onChange={e => setNotesValue(e.target.value)}
                onBlur={() => updateNotes(activePair.id, notesValue || activePair.mentor_notes || '')}
                className="w-full px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm h-24 resize-none"
                placeholder="Write session notes, feedback, goals for next session..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Mentorship Tips */}
      <div className="bg-stone-900/40 rounded-xl p-4 border border-stone-700/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-stone-300 font-medium text-sm">💡 Mentorship Tip</h3>
          <button
            onClick={() => setTipIndex(i => (i + 1) % TIPS.length)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Next tip →
          </button>
        </div>
        <p className="text-stone-400 text-sm">{TIPS[tipIndex]}</p>
      </div>
    </div>
  );
}

function MilestoneCard({ milestone, index, onComplete }: {
  milestone: MentorshipMilestone;
  index: number;
  onComplete: () => void;
}) {
  const icon = milestone.completed
    ? '✅'
    : index === 0 || milestone.completed
    ? '⬜'
    : '🔒';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      milestone.completed
        ? 'bg-emerald-900/20 border border-emerald-700/30'
        : 'bg-stone-800/50 border border-stone-700/30'
    }`}>
      <div className="text-xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${milestone.completed ? 'text-emerald-300' : 'text-stone-300'}`}>
          {milestone.title}
        </div>
        <div className="text-xs text-stone-500">{milestone.description}</div>
        <div className="text-xs text-amber-400 mt-0.5">+{milestone.xpReward} XP each</div>
      </div>
      {!milestone.completed && (
        <button
          onClick={onComplete}
          className="px-3 py-1.5 bg-amber-600/20 text-amber-300 rounded-md text-xs font-medium border border-amber-600/30 hover:bg-amber-600/30 transition-all"
        >
          Complete
        </button>
      )}
      {milestone.completed && milestone.completedAt && (
        <span className="text-xs text-emerald-400">Done!</span>
      )}
    </div>
  );
}