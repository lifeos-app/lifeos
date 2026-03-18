/**
 * HealerConsult — Health assessment & remedy flow via the Healer NPC.
 * State machine: greeting → assessment → remedy → acting → farewell
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HealthService } from '../../lib/services/health-service';
import { createScheduleEvent } from '../../lib/schedule-events';
import { supabase } from '../../lib/supabase';
import { useGamification } from '../../hooks/useGamification';
import { useUserStore } from '../../stores/useUserStore';

type HealerStep = 'greeting' | 'assessment' | 'remedy' | 'acting' | 'farewell';

interface HealerConsultProps {
  greetingLines: string[];
  onClose: () => void;
}

type RemedyKind = 'sleep' | 'journal' | 'hydration' | 'healthy' | null;

export function HealerConsult({ greetingLines, onClose }: HealerConsultProps) {
  const [step, setStep] = useState<HealerStep>('greeting');
  const [stats, setStats] = useState<ReturnType<typeof HealthService.stats> | null>(null);
  const [remedyKind, setRemedyKind] = useState<RemedyKind>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [error, setError] = useState('');

  const { awardXP } = useGamification();
  const navigate = useNavigate();

  // ── Greeting ──
  const renderGreeting = () => (
    <>
      <div className="npc-panel-narration">
        {greetingLines[0] || 'Welcome to my sanctuary. Let me tend to your wellbeing.'}
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={handleAssessment}>
          🩺 Check My Vitals
        </button>
      </div>
    </>
  );

  // ── Assessment ──
  const handleAssessment = useCallback(() => {
    const s = HealthService.stats();
    setStats(s);
    setStep('assessment');
  }, []);

  const renderAssessment = () => {
    if (!stats) return null;

    const allNull = stats.mood === null && stats.energy === null
      && stats.sleep === null && stats.exercise === null && stats.water === null;

    if (allNull) {
      return (
        <>
          <div className="npc-panel-narration">
            I cannot read what isn't written... Log some health metrics and return to me, adventurer.
          </div>
          <div className="npc-panel-actions">
            <button className="forge-button forge-button--secondary" onClick={onClose}>
              Leave Sanctuary
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="npc-panel-narration">
          Let me see... Your body speaks volumes, if one knows how to listen.
        </div>
        <div className="healer-stats-grid">
          <div className="healer-stat-card">
            <span className="healer-stat-icon">😴</span>
            <span className="healer-stat-value">{stats.sleep !== null ? `${stats.sleep}h` : '—'}</span>
            <span className="healer-stat-label">Sleep</span>
          </div>
          <div className="healer-stat-card">
            <span className="healer-stat-icon">😊</span>
            <span className="healer-stat-value">{stats.mood !== null ? `${stats.mood}/5` : '—'}</span>
            <span className="healer-stat-label">Mood</span>
          </div>
          <div className="healer-stat-card">
            <span className="healer-stat-icon">⚡</span>
            <span className="healer-stat-value">{stats.energy !== null ? `${stats.energy}/5` : '—'}</span>
            <span className="healer-stat-label">Energy</span>
          </div>
          <div className="healer-stat-card">
            <span className="healer-stat-icon">💧</span>
            <span className="healer-stat-value">{stats.water !== null ? `${stats.water}` : '—'}</span>
            <span className="healer-stat-label">Water</span>
          </div>
        </div>
        <div className="npc-panel-actions" style={{ marginTop: 12 }}>
          <button className="forge-button" onClick={handleRemedy}>
            💊 What's Your Remedy?
          </button>
          <button className="forge-button forge-button--secondary" onClick={() => setStep('greeting')}>
            ← Back
          </button>
        </div>
      </>
    );
  };

  // ── Remedy ──
  const handleRemedy = useCallback(() => {
    if (!stats) return;
    if (stats.sleep === null || (stats.sleep !== null && stats.sleep < 7)) {
      setRemedyKind('sleep');
    } else if (stats.mood === null || (stats.mood !== null && stats.mood < 3)) {
      setRemedyKind('journal');
    } else if (stats.water === null || (stats.water !== null && stats.water < 6)) {
      setRemedyKind('hydration');
    } else {
      setRemedyKind('healthy');
    }
    setStep('remedy');
  }, [stats]);

  const renderRemedy = () => {
    const remedies: Record<Exclude<RemedyKind, null>, { narration: string; action: string; emoji: string }> = {
      sleep: {
        narration: 'Rest is the body\'s forge. Your sleep needs tending — let me prescribe an evening rest.',
        action: 'Set a Sleep Event Tonight',
        emoji: '🌙',
      },
      journal: {
        narration: 'Your spirit needs tending. A journal entry can clear the storm clouds in your mind.',
        action: 'Open Journal',
        emoji: '📖',
      },
      hydration: {
        narration: 'Water is life\'s simplest medicine. You need more of it.',
        action: 'Set a Hydration Reminder',
        emoji: '💧',
      },
      healthy: {
        narration: 'Your vitals look strong! The body is well-tempered. Continue your good practices, adventurer.',
        action: '',
        emoji: '✨',
      },
    };

    const r = remedies[remedyKind || 'healthy'];

    return (
      <>
        <div className="npc-panel-narration">{r.narration}</div>
        <div className="npc-panel-actions">
          {remedyKind !== 'healthy' && (
            <button className="forge-button" onClick={handleRemedyAction}>
              {r.emoji} {r.action}
            </button>
          )}
          <button
            className={remedyKind === 'healthy' ? 'forge-button' : 'forge-button forge-button--secondary'}
            onClick={handleFarewell}
          >
            {remedyKind === 'healthy' ? '✨ Thank You, Healer' : 'Skip Remedy'}
          </button>
        </div>
      </>
    );
  };

  // ── Execute Remedy Action ──
  const handleRemedyAction = useCallback(async () => {
    if (remedyKind === 'journal') {
      await handleFarewell();
      navigate('/journal');
      return;
    }

    setStep('acting');
    setError('');
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) throw new Error('Not signed in');

      if (remedyKind === 'sleep') {
        const tonight = new Date();
        tonight.setHours(22, 0, 0, 0);
        if (tonight.getTime() < Date.now()) tonight.setDate(tonight.getDate() + 1);

        await createScheduleEvent(supabase, {
          userId,
          title: 'Sleep — Healer Rx',
          startTime: tonight.toISOString(),
          endTime: new Date(tonight.getTime() + 8 * 60 * 60 * 1000).toISOString(),
          eventType: 'sleep',
        });
      } else if (remedyKind === 'hydration') {
        const now = new Date();
        const reminder = new Date(now);
        reminder.setMinutes(reminder.getMinutes() + 30);

        await createScheduleEvent(supabase, {
          userId,
          title: 'Hydration — Healer Rx',
          startTime: reminder.toISOString(),
          eventType: 'hydration',
          scheduleLayer: 'operations',
        });
      }

      await handleFarewell();
    } catch (err: any) {
      setError(err?.message || 'The remedy faltered... Try again.');
      setStep('remedy');
    }
  }, [remedyKind, navigate]);

  const renderActing = () => (
    <div className="healer-acting-anim">
      <div style={{ fontSize: 48 }}>🩺</div>
      <p>The Healer prepares your remedy...</p>
    </div>
  );

  // ── Farewell ──
  const handleFarewell = useCallback(async () => {
    try {
      const result = await awardXP('healer_consult');
      setXpAwarded(result?.xpAwarded ?? 10);
    } catch {
      setXpAwarded(10);
    }
    setStep('farewell');
  }, [awardXP]);

  const renderFarewell = () => (
    <>
      <div className="npc-panel-narration">
        Go well, adventurer. Remember — the body is a temple, and you are its keeper.
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span className="forge-xp-badge">+{xpAwarded} XP</span>
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={resetConsult}>
          Back to Menu
        </button>
        <button className="forge-button forge-button--secondary" onClick={onClose}>
          Leave Sanctuary
        </button>
      </div>
    </>
  );

  const resetConsult = useCallback(() => {
    setStats(null);
    setRemedyKind(null);
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
      {step === 'assessment' && renderAssessment()}
      {step === 'remedy' && renderRemedy()}
      {step === 'acting' && renderActing()}
      {step === 'farewell' && renderFarewell()}
    </>
  );
}
