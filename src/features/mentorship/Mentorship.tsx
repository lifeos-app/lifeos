/**
 * Mentorship — Hub page for the Mentorship system
 *
 * Toggle between "Find a Mentor" and "Become a Mentor".
 * Shows mentor/mentee listings, my mentorship progress, and matching.
 * Warm, supportive aesthetic.
 */

import { useState } from 'react';
import { useMentorship } from './useMentorship';
import { MentorMatching } from './MentorMatching';
import { MentorDashboard } from './MentorDashboard';
import { MenteeDashboard } from './MenteeDashboard';

export function Mentorship() {
  const {
    myActivePairs,
    myActiveMentorships,
    myActiveMentorshipsAsMentee,
    isMentor,
    mentorProfiles,
    canBeMentor,
    activeTab,
    setActiveTab,
    MIN_MENTOR_LEVEL,
    MAX_MENTEES,
    registerAsMentor,
    registerAsMentee,
    applyToMentor,
  } = useMentorship();

  const [showRegistration, setShowRegistration] = useState(false);
  const [regForm, setRegForm] = useState({
    username: '',
    level: 1,
    specializations: [] as string[],
    maxMentees: 3,
    availability: 'available' as 'available' | 'limited' | 'full',
    bio: '',
    rating: 0,
  });

  const ALL_SPECIALIZATIONS = ['habits', 'goals', 'health', 'finance', 'discipline', 'meditation', 'productivity', 'planning'];

  const toggleSpecialization = (spec: string) => {
    setRegForm(f => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter(s => s !== spec)
        : [...f.specializations, spec],
    }));
  };

  // If user has active mentorship, show the dashboard
  const hasActiveMentorship = myActiveMentorshipsAsMentee.length > 0;
  const hasActiveMentees = myActiveMentorships.length > 0;

  if (hasActiveMentees) return <MentorDashboard />;
  if (hasActiveMentorship) return <MenteeDashboard />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/30 via-stone-950/50 to-stone-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl">🤝</div>
        <h1 className="text-2xl font-bold text-amber-200">Mentorship Guild</h1>
        <p className="text-stone-400 text-sm max-w-md mx-auto">
          Learn from veterans, guide newcomers. Together we grow stronger.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex justify-center">
        <div className="flex bg-stone-900/80 rounded-xl p-1 border border-stone-700/50">
          <button
            onClick={() => { setActiveTab('find'); setShowRegistration(false); }}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'find'
                ? 'bg-amber-600/80 text-amber-100 shadow-lg shadow-amber-900/30'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            🔍 Find a Mentor
          </button>
          <button
            onClick={() => { setActiveTab('become'); setShowRegistration(false); }}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'become'
                ? 'bg-amber-600/80 text-amber-100 shadow-lg shadow-amber-900/30'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            🌟 Become a Mentor
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'find' && !showRegistration && (
        <MentorMatching />
      )}

      {activeTab === 'become' && !showRegistration && (
        <div className="max-w-lg mx-auto space-y-4">
          {isMentor ? (
            <div className="bg-stone-900/60 rounded-xl p-6 border border-amber-700/30 text-center space-y-3">
              <div className="text-3xl">✨</div>
              <h3 className="text-amber-200 font-semibold text-lg">You're a Mentor!</h3>
              <p className="text-stone-400 text-sm">
                You're already registered as a mentor. Check your dashboard for mentee requests.
              </p>
              {myActiveMentees.length > 0 && <MentorDashboard />}
            </div>
          ) : (
            <div className="bg-stone-900/60 rounded-xl p-6 border border-amber-700/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🌟</div>
                <div>
                  <h3 className="text-amber-200 font-semibold text-lg">Share Your Wisdom</h3>
                  <p className="text-stone-400 text-sm">Help new adventurers on their journey</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-stone-300">
                  <span className="text-amber-400">•</span>
                  <span>Must be Level {MIN_MENTOR_LEVEL}+ to mentor</span>
                </div>
                <div className="flex items-start gap-2 text-stone-300">
                  <span className="text-amber-400">•</span>
                  <span>Maximum {MAX_MENTEES} mentees at a time</span>
                </div>
                <div className="flex items-start gap-2 text-stone-300">
                  <span className="text-amber-400">•</span>
                  <span>Both you and your mentee earn XP through milestones</span>
                </div>
                <div className="flex items-start gap-2 text-stone-300">
                  <span className="text-amber-400">•</span>
                  <span>Structured 30-day program with guided milestones</span>
                </div>
              </div>

              {!canBeMentor && (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-amber-300 text-sm">
                  ⚠️ You've reached the maximum of {MAX_MENTEES} active mentees. Complete a mentorship to take on new mentees.
                </div>
              )}

              <button
                onClick={() => setShowRegistration(true)}
                disabled={!canBeMentor}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Register as Mentor
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registration form */}
      {showRegistration && (
        <div className="max-w-lg mx-auto bg-stone-900/60 rounded-xl p-6 border border-amber-700/30 space-y-4">
          <h3 className="text-amber-200 font-semibold text-lg">Mentor Registration</h3>

          <div className="space-y-3">
            <div>
              <label className="text-stone-400 text-sm">Display Name</label>
              <input
                value={regForm.username}
                onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm"
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm">Your Level</label>
              <input
                type="number"
                min={MIN_MENTOR_LEVEL}
                value={regForm.level}
                onChange={e => setRegForm(f => ({ ...f, level: parseInt(e.target.value) || MIN_MENTOR_LEVEL }))}
                className="w-full mt-1 px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm mb-2 block">Specializations</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SPECIALIZATIONS.map(spec => (
                  <button
                    key={spec}
                    onClick={() => toggleSpecialization(spec)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      regForm.specializations.includes(spec)
                        ? 'bg-amber-600/60 text-amber-100 border border-amber-500/50'
                        : 'bg-stone-800 text-stone-400 border border-stone-700 hover:border-amber-600/50'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-stone-400 text-sm">Availability</label>
              <div className="flex gap-2 mt-1">
                {(['available', 'limited'] as const).map(avail => (
                  <button
                    key={avail}
                    onClick={() => setRegForm(f => ({ ...f, availability: avail }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      regForm.availability === avail
                        ? 'bg-amber-600/60 text-amber-100 border border-amber-500/50'
                        : 'bg-stone-800 text-stone-400 border border-stone-700'
                    }`}
                  >
                    {avail.charAt(0).toUpperCase() + avail.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-stone-400 text-sm">Bio</label>
              <textarea
                value={regForm.bio}
                onChange={e => setRegForm(f => ({ ...f, bio: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm h-20 resize-none"
                placeholder="Tell potential mentees about yourself and your mentoring style..."
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowRegistration(false)}
              className="flex-1 py-2.5 rounded-lg border border-stone-700 text-stone-400 hover:text-stone-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                registerAsMentor({
                  username: regForm.username || 'Mentor',
                  level: regForm.level,
                  specializations: regForm.specializations,
                  maxMentees: MAX_MENTEES,
                  availability: regForm.availability,
                  bio: regForm.bio,
                  rating: 0,
                });
                setShowRegistration(false);
              }}
              disabled={regForm.specializations.length === 0}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50"
            >
              Register
            </button>
          </div>
        </div>
      )}

      {/* My Mentorship Overview */}
      {myActivePairs.length > 0 && (
        <div className="bg-stone-900/60 rounded-xl p-5 border border-amber-700/30 space-y-3">
          <h3 className="text-amber-200 font-semibold">My Mentorships</h3>
          {myActivePairs.map(pair => (
            <div key={pair.id} className="flex items-center justify-between bg-stone-800/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{pair.mentor_id === 'current-user' ? '🎓' : '🧙'}</div>
                <div>
                  <div className="text-stone-200 text-sm font-medium">
                    {pair.mentor_id === 'current-user' ? 'Mentoring' : 'Your Mentor'}
                  </div>
                  <div className="text-stone-400 text-xs">
                    {pair.milestones.filter(m => m.completed).length}/{pair.milestones.length} milestones
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-amber-400 text-sm font-semibold">{pair.mentee_progress}%</div>
                <div className={`text-xs ${pair.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {pair.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}