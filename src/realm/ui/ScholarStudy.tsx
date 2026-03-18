/**
 * ScholarStudy — Education review & suggestion flow via the Scholar NPC.
 * State machine: greeting → review → suggest → acting → farewell
 */

import { useState, useCallback } from 'react';
import { GoalService } from '../../lib/services/goal-service';
import { createScheduleEvent } from '../../lib/schedule-events';
import { supabase } from '../../lib/supabase';
import { useGamification } from '../../hooks/useGamification';
import { useUserStore } from '../../stores/useUserStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { localDateStr } from '../../utils/date';

type ScholarStep = 'greeting' | 'review' | 'suggest' | 'acting' | 'farewell';

interface ScholarStudyProps {
  greetingLines: string[];
  onClose: () => void;
}

interface EduData {
  goals: { title: string; icon?: string; progress: number }[];
  habits: { title: string; streak: number }[];
  eventsThisWeek: number;
  hoursThisWeek: number;
}

type SuggestKind = 'no_goals' | 'low_progress' | 'strong' | null;

const EDU_KEYWORDS = /learn|study|read|course|education|book|class|lecture|tutorial|knowledge|skill/i;

export function ScholarStudy({ greetingLines, onClose }: ScholarStudyProps) {
  const [step, setStep] = useState<ScholarStep>('greeting');
  const [eduData, setEduData] = useState<EduData | null>(null);
  const [suggestKind, setSuggestKind] = useState<SuggestKind>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [error, setError] = useState('');

  const { awardXP } = useGamification();

  // ── Greeting ──
  const renderGreeting = () => (
    <>
      <div className="npc-panel-narration">
        {greetingLines[0] || 'Ah, a fellow seeker of knowledge. Let us examine your scholarly pursuits.'}
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={handleReview}>
          📚 Review My Studies
        </button>
      </div>
    </>
  );

  // ── Review ──
  const handleReview = useCallback(() => {
    const activeGoals = GoalService.getActive();
    const eduGoals = activeGoals.filter(g =>
      g.category === 'education' || g.domain === 'education' || EDU_KEYWORDS.test(g.title)
    );

    const allHabits = useHabitsStore.getState().habits.filter(h => !h.is_deleted);
    const eduHabits = allHabits.filter(h =>
      h.category === 'learning' || h.category === 'education' || EDU_KEYWORDS.test(h.title)
    );

    // Education events this week
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = localDateStr(weekStart);
    const todayStr = localDateStr(today);

    const events = useScheduleStore.getState().events || [];
    const eduEvents = events.filter(e =>
      e.event_type === 'education'
      && !e.is_deleted
      && e.start_time >= weekStartStr
      && e.start_time <= todayStr + 'T23:59:59'
    );

    let totalMinutes = 0;
    for (const ev of eduEvents) {
      if (ev.start_time && ev.end_time) {
        const ms = new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime();
        if (ms > 0) totalMinutes += ms / 60000;
      }
    }

    setEduData({
      goals: eduGoals.map(g => ({ title: g.title, icon: g.icon, progress: g.progress ?? 0 })),
      habits: eduHabits.map(h => ({ title: h.title, streak: h.streak_current ?? 0 })),
      eventsThisWeek: eduEvents.length,
      hoursThisWeek: Math.round(totalMinutes / 60 * 10) / 10,
    });
    setStep('review');
  }, []);

  const renderReview = () => {
    if (!eduData) return null;

    const isEmpty = eduData.goals.length === 0 && eduData.habits.length === 0 && eduData.eventsThisWeek === 0;

    if (isEmpty) {
      return (
        <>
          <div className="npc-panel-narration">
            Your library shelves are bare... Knowledge awaits, but you must take the first step. Perhaps the Blacksmith can forge a learning goal for you.
          </div>
          <div className="npc-panel-actions">
            <button className="forge-button" onClick={handleFarewell}>
              📜 Thank You, Scholar
            </button>
            <button className="forge-button forge-button--secondary" onClick={onClose}>
              Leave Library
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="npc-panel-narration">
          Fascinating... The scrolls reveal much about your scholarly journey.
        </div>

        {eduData.goals.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="scholar-section-label">📋 Education Goals</div>
            {eduData.goals.map((g, i) => (
              <div key={i} className="forge-goal-card">
                <div className="forge-goal-card-title">{g.icon || '🎯'} {g.title}</div>
                <div className="forge-progress-bar">
                  <div className="forge-progress-bar-fill" style={{ width: `${g.progress}%` }} />
                </div>
                <div className="scholar-progress-text">{Math.round(g.progress)}%</div>
              </div>
            ))}
          </div>
        )}

        {eduData.habits.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="scholar-section-label">🔥 Learning Habits</div>
            {eduData.habits.map((h, i) => (
              <div key={i} className="scholar-habit-row">
                <span>{h.title}</span>
                <span className="scholar-streak">{h.streak} day streak</span>
              </div>
            ))}
          </div>
        )}

        {eduData.eventsThisWeek > 0 && (
          <div className="scholar-week-summary">
            📅 This week: {eduData.eventsThisWeek} session{eduData.eventsThisWeek !== 1 ? 's' : ''} · {eduData.hoursThisWeek}h logged
          </div>
        )}

        <div className="npc-panel-actions" style={{ marginTop: 12 }}>
          <button className="forge-button" onClick={handleSuggest}>
            💡 What Should I Focus On?
          </button>
          <button className="forge-button forge-button--secondary" onClick={() => setStep('greeting')}>
            ← Back
          </button>
        </div>
      </>
    );
  };

  // ── Suggest ──
  const handleSuggest = useCallback(() => {
    if (!eduData) return;

    if (eduData.goals.length === 0) {
      setSuggestKind('no_goals');
    } else {
      const avgProgress = eduData.goals.reduce((sum, g) => sum + g.progress, 0) / eduData.goals.length;
      const hasStrongStreak = eduData.habits.some(h => h.streak >= 7);
      if (avgProgress < 40 && !hasStrongStreak) {
        setSuggestKind('low_progress');
      } else {
        setSuggestKind('strong');
      }
    }
    setStep('suggest');
  }, [eduData]);

  const renderSuggest = () => {
    const suggestions: Record<Exclude<SuggestKind, null>, { narration: string; action: string; emoji: string }> = {
      no_goals: {
        narration: 'You have no learning goals! Visit the Blacksmith to forge one — knowledge without direction is like a library without shelves.',
        action: '',
        emoji: '',
      },
      low_progress: {
        narration: 'Your studies need a dedicated session. Shall I schedule a focused study block for you?',
        action: 'Schedule a Study Session',
        emoji: '📖',
      },
      strong: {
        narration: 'Your dedication to knowledge is truly admirable! The scrolls sing your praises. Continue your excellent work, scholar.',
        action: '',
        emoji: '',
      },
    };

    const s = suggestions[suggestKind || 'strong'];

    return (
      <>
        <div className="npc-panel-narration">{s.narration}</div>
        <div className="npc-panel-actions">
          {suggestKind === 'low_progress' && (
            <button className="forge-button" onClick={handleStudyAction}>
              {s.emoji} {s.action}
            </button>
          )}
          <button
            className={suggestKind === 'low_progress' ? 'forge-button forge-button--secondary' : 'forge-button'}
            onClick={handleFarewell}
          >
            {suggestKind === 'low_progress' ? 'Skip Suggestion' : '📜 Thank You, Scholar'}
          </button>
        </div>
      </>
    );
  };

  // ── Execute Study Action ──
  const handleStudyAction = useCallback(async () => {
    setStep('acting');
    setError('');
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) throw new Error('Not signed in');

      // Schedule a 1-hour study session starting next hour
      const now = new Date();
      const start = new Date(now);
      start.setHours(start.getHours() + 1, 0, 0, 0);

      await createScheduleEvent(supabase, {
        userId,
        title: 'Study Session — Scholar Rx',
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        eventType: 'education',
      });

      await handleFarewell();
    } catch (err: any) {
      setError(err?.message || 'The scrolls faltered... Try again.');
      setStep('suggest');
    }
  }, []);

  const renderActing = () => (
    <div className="scholar-acting-anim">
      <div style={{ fontSize: 48 }}>📚</div>
      <p>The Scholar prepares your study plan...</p>
    </div>
  );

  // ── Farewell ──
  const handleFarewell = useCallback(async () => {
    try {
      const result = await awardXP('scholar_study');
      setXpAwarded(result?.xpAwarded ?? 10);
    } catch {
      setXpAwarded(10);
    }
    setStep('farewell');
  }, [awardXP]);

  const renderFarewell = () => (
    <>
      <div className="npc-panel-narration">
        Knowledge is the truest power, adventurer. Return whenever you seek guidance.
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span className="forge-xp-badge">+{xpAwarded} XP</span>
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={resetStudy}>
          Back to Menu
        </button>
        <button className="forge-button forge-button--secondary" onClick={onClose}>
          Leave Library
        </button>
      </div>
    </>
  );

  const resetStudy = useCallback(() => {
    setEduData(null);
    setSuggestKind(null);
    setXpAwarded(0);
    setError('');
    setStep('greeting');
  }, []);

  // ── Render ──
  return (
    <>
      {error && (
        <div style={{ color: '#FF6B6B', fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>{error}</div>
      )}
      {step === 'greeting' && renderGreeting()}
      {step === 'review' && renderReview()}
      {step === 'suggest' && renderSuggest()}
      {step === 'acting' && renderActing()}
      {step === 'farewell' && renderFarewell()}
    </>
  );
}
