/**
 * MentorMatching — Smart matching view for finding a mentor
 *
 * Filter by specialization, availability, rating.
 * Shows compatibility score per mentor with "Why this match?" explanation.
 * Quick apply button.
 */

import { useState, useMemo } from 'react';
import { useMentorship } from './useMentorship';
import type { MentorProfile } from '../../stores/mentorshipStore';

const SPECIALIZATIONS = ['habits', 'goals', 'health', 'finance', 'discipline', 'meditation', 'productivity', 'planning'];

export function MentorMatching() {
  const {
    recommendedMentors,
    mentorProfiles,
    applyToMentor,
    getCompatibility,
  } = useMentorship();

  const [filterSpec, setFilterSpec] = useState<string | null>(null);
  const [filterRating, setFilterRating] = useState<number>(0);
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'available' | 'limited'>('all');
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [showWhyMatch, setShowWhyMatch] = useState<string | null>(null);
  const [appliedMentors, setAppliedMentors] = useState<Set<string>>(new Set());

  const filteredMentors = useMemo(() => {
    let mentors = filterSpec
      ? mentorProfiles.filter(m => m.specializations.includes(filterSpec))
      : mentorProfiles;

    if (filterRating > 0) {
      mentors = mentors.filter(m => m.rating >= filterRating);
    }
    if (filterAvailability !== 'all') {
      mentors = mentors.filter(m => m.availability === filterAvailability);
    }

    return mentors.filter(m => m.availability !== 'full');
  }, [mentorProfiles, filterSpec, filterRating, filterAvailability]);

  const availabilityColor = (avail: string) => {
    if (avail === 'available') return 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30';
    if (avail === 'limited') return 'bg-amber-600/20 text-amber-300 border-amber-500/30';
    return 'bg-stone-600/20 text-stone-400 border-stone-500/30';
  };

  const handleApply = (mentorId: string) => {
    applyToMentor(mentorId, applyMessage || 'I would love to learn from you!');
    setAppliedMentors(prev => new Set(prev).add(mentorId));
    setShowApply(false);
    setApplyMessage('');
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-stone-900/60 rounded-xl p-4 border border-amber-700/30 space-y-3">
        <h3 className="text-amber-200 font-semibold text-sm">🔍 Filter Mentors</h3>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSpec(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                !filterSpec
                  ? 'bg-amber-600/50 text-amber-100 border border-amber-500/50'
                  : 'bg-stone-800 text-stone-400 border border-stone-700'
              }`}
            >
              All
            </button>
            {SPECIALIZATIONS.map(spec => (
              <button
                key={spec}
                onClick={() => setFilterSpec(spec === filterSpec ? null : spec)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                  filterSpec === spec
                    ? 'bg-amber-600/50 text-amber-100 border border-amber-500/50'
                    : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-stone-400 text-xs">Min Rating:</label>
            <div className="flex gap-1">
              {[0, 4, 4.5, 4.8].map(r => (
                <button
                  key={r}
                  onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1 rounded text-xs transition-all ${
                    filterRating === r
                      ? 'bg-amber-600/40 text-amber-200'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {r === 0 ? 'Any' : `⭐${r}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-stone-400 text-xs">Availability:</label>
            <div className="flex gap-1">
              {(['all', 'available', 'limited'] as const).map(avail => (
                <button
                  key={avail}
                  onClick={() => setFilterAvailability(avail)}
                  className={`px-3 py-1 rounded text-xs transition-all capitalize ${
                    filterAvailability === avail
                      ? 'bg-amber-600/40 text-amber-200'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {avail}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mentor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMentors.map(mentor => {
          const compat = getCompatibility(mentor.userId);
          const rec = recommendedMentors.find(r => r.mentor.userId === mentor.userId);

          return (
            <div
              key={mentor.userId}
              className="bg-stone-900/60 rounded-xl p-4 border border-stone-700/50 hover:border-amber-700/50 transition-all space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600/30 to-amber-800/30 flex items-center justify-center text-xl border border-amber-500/20">
                    🧙
                  </div>
                  <div>
                    <h4 className="text-amber-200 font-semibold">{mentor.username}</h4>
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <span className="text-amber-400">Lv. {mentor.level}</span>
                      <span>⭐ {mentor.rating.toFixed(1)}</span>
                      <span>({mentor.ratingCount})</span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${availabilityColor(mentor.availability)}`}>
                  {mentor.availability}
                </span>
              </div>

              {/* Compatibility Score */}
              {(rec || compat.score > 0) && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        compat.score >= 70 ? 'bg-emerald-500' :
                        compat.score >= 40 ? 'bg-amber-500' : 'bg-stone-500'
                      }`}
                      style={{ width: `${compat.score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    compat.score >= 70 ? 'text-emerald-400' :
                    compat.score >= 40 ? 'text-amber-400' : 'text-stone-400'
                  }`}>
                    {compat.score}%
                  </span>
                  <button
                    onClick={() => setShowWhyMatch(showWhyMatch === mentor.userId ? null : mentor.userId)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Why?
                  </button>
                </div>
              )}

              {/* Why match explanation */}
              {showWhyMatch === mentor.userId && compat.reasons.length > 0 && (
                <div className="bg-stone-800/50 rounded-lg p-2.5 space-y-1">
                  {compat.reasons.map((reason, i) => (
                    <div key={i} className="text-xs text-stone-400 flex items-start gap-1.5">
                      <span className="text-amber-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Specializations */}
              <div className="flex flex-wrap gap-1.5">
                {mentor.specializations.map(spec => (
                  <span key={spec} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-600/20 text-amber-300 border border-amber-600/20 capitalize">
                    {spec}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-stone-400">
                <span>{mentor.menteeCount}/{mentor.maxMentees} mentees</span>
                <span>{mentor.completedMentorships} completed</span>
              </div>

              {/* Bio */}
              {mentor.bio && (
                <p className="text-stone-400 text-xs italic">"{mentor.bio}"</p>
              )}

              {/* Apply button */}
              <button
                onClick={() => { setSelectedMentor(mentor); setShowApply(true); }}
                disabled={appliedMentors.has(mentor.userId) || mentor.availability === 'full'}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                  appliedMentors.has(mentor.userId)
                    ? 'bg-stone-800 text-stone-400 border border-stone-700 cursor-not-allowed'
                    : mentor.availability === 'full'
                    ? 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 hover:from-amber-500 hover:to-amber-600'
                }`}
              >
                {appliedMentors.has(mentor.userId) ? '✅ Applied' : mentor.availability === 'full' ? '🔒 Full' : '🌟 Apply to Mentor'}
              </button>
            </div>
          );
        })}
      </div>

      {filteredMentors.length === 0 && (
        <div className="text-center py-12 text-stone-400 space-y-2">
          <div className="text-4xl">🔍</div>
          <p>No mentors match your filters. Try adjusting your criteria.</p>
        </div>
      )}

      {/* Apply Modal */}
      {showApply && selectedMentor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowApply(false)}>
          <div className="bg-stone-900 rounded-2xl p-6 border border-amber-700/30 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600/30 to-amber-800/30 flex items-center justify-center text-xl border border-amber-500/20">
                🧙
              </div>
              <div>
                <h3 className="text-amber-200 font-semibold text-lg">Apply to {selectedMentor.username}</h3>
                <p className="text-stone-400 text-sm">Level {selectedMentor.level} • ⭐ {selectedMentor.rating.toFixed(1)}</p>
              </div>
            </div>

            <div>
              <label className="text-stone-400 text-sm">Your message</label>
              <textarea
                value={applyMessage}
                onChange={e => setApplyMessage(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm h-24 resize-none"
                placeholder="Tell them why you'd like their mentorship and what you hope to learn..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApply(false)}
                className="flex-1 py-2.5 rounded-lg border border-stone-700 text-stone-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApply(selectedMentor.userId)}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-semibold"
              >
                Send Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}