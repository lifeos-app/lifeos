/**
 * MenteeDashboard — Mentee's view of their mentorship
 *
 * Shows mentor profile, milestones, ask-for-help, session notes,
 * rate mentor, and graduate option.
 */

import { useState } from 'react';
import { useMentorship } from './useMentorship';

export function MenteeDashboard() {
  const {
    myActiveMentorshipsAsMentee,
    mentorProfiles,
    completeMilestone,
    rateMentor,
    graduateMentorship,
    endMentorship,
  } = useMentorship();

  const [ratingValue, setRatingValue] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [showHelpMessage, setShowHelpMessage] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [showGraduateConfirm, setShowGraduateConfirm] = useState(false);

  const activePair = myActiveMentorshipsAsMentee[0];
  if (!activePair) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400">
        No active mentorship found.
      </div>
    );
  }

  const mentor = mentorProfiles.find(m => m.userId === activePair.mentor_id);
  const completedMilestones = activePair.milestones.filter(m => m.completed).length;
  const totalMilestones = activePair.milestones.length;
  const hasCompletedHalf = completedMilestones >= Math.ceil(totalMilestones / 2);

  const handleRateMentor = () => {
    if (ratingValue > 0) {
      rateMentor(activePair.id, ratingValue);
      setShowRating(false);
    }
  };

  const handleSendHelp = () => {
    // In a real app, this would send a notification
    setShowHelpMessage(false);
    setHelpMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/30 via-stone-950/50 to-stone-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🧙</div>
          <div>
            <h1 className="text-xl font-bold text-amber-200">My Mentorship</h1>
            <p className="text-stone-400 text-sm">{activePair.status === 'active' ? 'In progress' : activePair.status}</p>
          </div>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
          activePair.status === 'active'
            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
        }`}>
          {activePair.status}
        </span>
      </div>

      {/* Mentor Profile Card */}
      {mentor && (
        <div className="bg-stone-900/60 rounded-xl p-5 border border-amber-700/30 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600/40 to-amber-800/40 flex items-center justify-center text-2xl border-2 border-amber-500/30">
              🧙
            </div>
            <div className="flex-1">
              <h3 className="text-amber-200 font-semibold text-lg">{mentor.username}</h3>
              <div className="flex items-center gap-3 text-sm text-stone-400">
                <span className="text-amber-400">Level {mentor.level}</span>
                <span>•</span>
                <span>{mentor.completedMentorships} mentored</span>
                <span>•</span>
                <span>⭐ {mentor.rating.toFixed(1)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {mentor.specializations.map(spec => (
                  <span key={spec} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-600/20 text-amber-300 border border-amber-600/20">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {mentor.bio && (
            <p className="text-stone-400 text-sm italic">"{mentor.bio}"</p>
          )}
          {mentor.availability !== 'available' && (
            <div className="text-xs text-amber-400">
              ⏰ Availability: {mentor.availability}
            </div>
          )}
        </div>
      )}

      {/* Progress Overview */}
      <div className="bg-stone-900/60 rounded-xl p-5 border border-amber-700/30 space-y-3">
        <h3 className="text-amber-200 font-semibold">📊 Progress</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-stone-400">Overall</span>
              <span className="text-amber-300 font-medium">{activePair.mentee_progress}%</span>
            </div>
            <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${activePair.mentee_progress}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-300">{completedMilestones}/{totalMilestones}</div>
            <div className="text-xs text-stone-500">Milestones</div>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-stone-900/60 rounded-xl p-5 border border-amber-700/30 space-y-3">
        <h3 className="text-amber-200 font-semibold">🏆 My Milestones</h3>
        <div className="space-y-2">
          {activePair.milestones.map((milestone, idx) => (
            <div
              key={milestone.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                milestone.completed
                  ? 'bg-emerald-900/20 border border-emerald-700/30'
                  : 'bg-stone-800/50 border border-stone-700/30'
              }`}
            >
              <div className="text-lg">{milestone.completed ? '✅' : idx === 0 || (activePair.milestones[idx - 1]?.completed) ? '⬜' : '🔒'}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${milestone.completed ? 'text-emerald-300 line-through' : 'text-stone-200'}`}>
                  {milestone.title}
                </div>
                <div className="text-xs text-stone-500">{milestone.description}</div>
              </div>
              <div className="text-right">
                {milestone.completed ? (
                  <span className="text-xs text-emerald-400">+{milestone.xpReward} XP ✓</span>
                ) : (
                  <span className="text-xs text-amber-400">+{milestone.xpReward} XP</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mark milestone complete button */}
        {(() => {
          const nextMilestone = activePair.milestones.find(m => !m.completed);
          if (nextMilestone) {
            const prevComplete = activePair.milestones.indexOf(nextMilestone) === 0 ||
              activePair.milestones[activePair.milestones.indexOf(nextMilestone) - 1]?.completed;
            if (prevComplete) {
              return (
                <button
                  onClick={() => completeMilestone(activePair.id, nextMilestone.id)}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all text-sm"
                >
                  Complete: {nextMilestone.title} 🎉
                </button>
              );
            }
          }
          return null;
        })()}
      </div>

      {/* Quick Actions */}
      <div className="bg-stone-900/60 rounded-xl p-5 border border-amber-700/30 space-y-3">
        <h3 className="text-amber-200 font-semibold">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowHelpMessage(true)}
            className="px-4 py-3 bg-amber-600/20 text-amber-300 rounded-lg text-sm font-medium border border-amber-600/30 hover:bg-amber-600/30 transition-all"
          >
            🆘 Ask for Help
          </button>
          {hasCompletedHalf && !showRating && activePair.mentor_rating === 0 && (
            <button
              onClick={() => setShowRating(true)}
              className="px-4 py-3 bg-amber-600/20 text-amber-300 rounded-lg text-sm font-medium border border-amber-600/30 hover:bg-amber-600/30 transition-all"
            >
              ⭐ Rate Mentor
            </button>
          )}
          {completedMilestones >= 3 && (
            <button
              onClick={() => setShowGraduateConfirm(true)}
              className="px-4 py-3 bg-emerald-600/20 text-emerald-300 rounded-lg text-sm font-medium border border-emerald-600/30 hover:bg-emerald-600/30 transition-all col-span-2"
            >
              🎓 Graduate from Mentorship
            </button>
          )}
          <button
            onClick={() => endMentorship(activePair.id)}
            className="px-4 py-3 bg-stone-800 text-stone-400 rounded-lg text-sm border border-stone-700 hover:text-red-400 hover:border-red-600/30 transition-all"
          >
            End Mentorship
          </button>
        </div>
      </div>

      {/* Help Message Modal */}
      {showHelpMessage && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowHelpMessage(false)}>
          <div className="bg-stone-900 rounded-2xl p-6 border border-amber-700/30 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-200 font-semibold text-lg">🆘 Ask for Help</h3>
            <p className="text-stone-400 text-sm">Send a quick message to your mentor.</p>
            <textarea
              value={helpMessage}
              onChange={e => setHelpMessage(e.target.value)}
              className="w-full px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm h-24 resize-none"
              placeholder="What do you need help with?"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowHelpMessage(false)}
                className="flex-1 py-2.5 rounded-lg border border-stone-700 text-stone-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSendHelp}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 text-amber-100 font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
          <div className="bg-stone-900 rounded-2xl p-6 border border-amber-700/30 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-amber-200 font-semibold text-lg">⭐ Rate Your Mentor</h3>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className={`text-3xl transition-all ${ratingValue >= star ? 'text-amber-400 scale-110' : 'text-stone-600'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-center text-stone-400 text-sm">
              {ratingValue === 0 ? 'Tap a star to rate' : ratingValue <= 2 ? 'Needs improvement' : ratingValue <= 3 ? 'Good' : ratingValue <= 4 ? 'Great' : 'Excellent!'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRating(false)}
                className="flex-1 py-2.5 rounded-lg border border-stone-700 text-stone-400"
              >
                Cancel
              </button>
              <button
                onClick={handleRateMentor}
                disabled={ratingValue === 0}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 text-amber-100 font-semibold disabled:opacity-50"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graduate Confirmation */}
      {showGraduateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowGraduateConfirm(false)}>
          <div className="bg-stone-900 rounded-2xl p-6 border border-emerald-700/30 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-5xl mb-2">🎓</div>
              <h3 className="text-emerald-200 font-semibold text-lg">Ready to Graduate?</h3>
            </div>
            <p className="text-stone-400 text-sm text-center">
              You've completed {completedMilestones} of {totalMilestones} milestones. Graduating marks your mentorship as complete!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGraduateConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-stone-700 text-stone-400"
              >
                Not Yet
              </button>
              <button
                onClick={() => { graduateMentorship(activePair.id); setShowGraduateConfirm(false); }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-emerald-100 font-semibold"
              >
                🎓 Graduate!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}