/**
 * BlacksmithForge — Multi-step goal creation flow via the Blacksmith NPC.
 * State machine: menu → forge_title → forge_parent → forge_confirm → forging → forge_done
 *                menu → progress | suggestions
 */

import { useState, useCallback, useEffect } from 'react';
import { GoalService } from '../../lib/services/goal-service';
import { getLifeContext } from '../../lib/services';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useGamification } from '../../hooks/useGamification';
import { localDateStr } from '../../utils/date';

type ForgeStep =
  | 'menu'
  | 'forge_title'
  | 'forge_parent'
  | 'forge_confirm'
  | 'forging'
  | 'forge_done'
  | 'progress'
  | 'suggestions';

interface BlacksmithForgeProps {
  greetingLines: string[];
  onClose: () => void;
}

type DurationKey = 'week' | 'month' | 'quarter' | 'none';

function getTargetDate(key: DurationKey): string | null {
  if (key === 'none') return null;
  const now = new Date();
  if (key === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return localDateStr(d);
  }
  if (key === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return localDateStr(d);
  }
  // quarter
  const qMonth = Math.ceil((now.getMonth() + 1) / 3) * 3;
  const d = new Date(now.getFullYear(), qMonth, 0);
  return localDateStr(d);
}

export function BlacksmithForge({ greetingLines, onClose }: BlacksmithForgeProps) {
  const [step, setStep] = useState<ForgeStep>('menu');
  const [title, setTitle] = useState('');
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [duration, setDuration] = useState<DurationKey>('none');
  const [createdGoalId, setCreatedGoalId] = useState<string | null>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [error, setError] = useState('');

  // Progress data
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [goalStats, setGoalStats] = useState<any>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<{ title: string; reason: string }[]>([]);

  const { awardXP } = useGamification();
  const objectives = useGoalsStore.getState().getObjectives();

  // ── Menu ──
  const renderMenu = () => (
    <>
      <div className="npc-panel-narration">
        {greetingLines[0] || 'The forge burns bright. What brings you here, adventurer?'}
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={() => setStep('forge_title')}>
          ⚒️ Forge a New Goal
        </button>
        <button className="forge-button forge-button--secondary" onClick={handleProgress}>
          📊 Check My Progress
        </button>
        <button className="forge-button forge-button--secondary" onClick={handleSuggestions}>
          💡 What Should I Work On?
        </button>
      </div>
    </>
  );

  // ── Forge: Title ──
  const renderForgeTitle = () => (
    <>
      <div className="npc-panel-narration">
        Every great weapon needs a name. What shall we call this goal?
      </div>
      <input
        className="forge-input"
        type="text"
        placeholder="Enter your goal..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        maxLength={100}
      />
      <div className="npc-panel-actions" style={{ marginTop: 12 }}>
        <button
          className="forge-button"
          disabled={title.trim().length < 3}
          onClick={() => setStep('forge_parent')}
        >
          Next →
        </button>
        <button className="forge-button forge-button--secondary" onClick={() => setStep('menu')}>
          ← Back
        </button>
      </div>
    </>
  );

  // ── Forge: Parent ──
  const renderForgeParent = () => (
    <>
      <div className="npc-panel-narration">
        Should this serve a greater purpose? Link it to an objective, or let it stand alone.
      </div>
      <div className="npc-panel-actions">
        <button
          className={`forge-objective-card${selectedParent === null ? ' forge-objective-card--selected' : ''}`}
          onClick={() => setSelectedParent(null)}
        >
          ⚔️ Standalone Goal
        </button>
        {objectives.map(obj => (
          <button
            key={obj.id}
            className={`forge-objective-card${selectedParent === obj.id ? ' forge-objective-card--selected' : ''}`}
            onClick={() => setSelectedParent(obj.id)}
          >
            {obj.icon || '🎯'} {obj.title}
          </button>
        ))}
      </div>
      <div className="npc-panel-actions" style={{ marginTop: 12 }}>
        <button className="forge-button" onClick={() => setStep('forge_confirm')}>
          Next →
        </button>
        <button className="forge-button forge-button--secondary" onClick={() => setStep('forge_title')}>
          ← Back
        </button>
      </div>
    </>
  );

  // ── Forge: Confirm ──
  const renderForgeConfirm = () => {
    const parentObj = selectedParent ? objectives.find(o => o.id === selectedParent) : null;
    return (
      <>
        <div className="forge-summary">
          <strong>⚒️ {title}</strong>
          {parentObj && <div style={{ marginTop: 4 }}>↳ Serves: {parentObj.icon || '🎯'} {parentObj.title}</div>}
        </div>
        <div className="npc-panel-narration">
          When must this be tempered? Choose a deadline, or let it forge at its own pace.
        </div>
        <div className="forge-duration-btns">
          {([
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['quarter', 'This Quarter'],
            ['none', 'No Rush'],
          ] as [DurationKey, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`forge-duration-btn${duration === key ? ' forge-duration-btn--selected' : ''}`}
              onClick={() => setDuration(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="npc-panel-actions" style={{ marginTop: 14 }}>
          <button className="forge-button" onClick={handleForge}>
            🔥 Begin Forging!
          </button>
          <button className="forge-button forge-button--secondary" onClick={() => setStep('forge_parent')}>
            ← Back
          </button>
        </div>
      </>
    );
  };

  // ── Forging Animation ──
  const handleForge = useCallback(async () => {
    setStep('forging');
    setError('');
    try {
      const targetDate = getTargetDate(duration);
      const goalId = await GoalService.create({
        title: title.trim(),
        parent_goal_id: selectedParent || undefined,
        target_date: targetDate,
        status: 'active',
        icon: '⚒️',
        color: '#F59E0B',
      } as any);

      if (!goalId) throw new Error('Failed to create goal');

      setCreatedGoalId(goalId);

      // Award XP
      try {
        const result = await awardXP('goal_create');
        setXpAwarded(result?.xpAwarded ?? 25);
      } catch {
        setXpAwarded(25);
      }

      setStep('forge_done');
    } catch (err: any) {
      setError(err?.message || 'The forge sputtered out. Try again.');
      setStep('forge_confirm');
    }
  }, [title, selectedParent, duration, awardXP]);

  const renderForging = () => (
    <div className="forge-forging-anim">
      <div style={{ fontSize: 48 }}>⚒️</div>
      <p>The Blacksmith hammers your goal into existence...</p>
    </div>
  );

  // ── Forge Done ──
  const renderForgeDone = () => (
    <>
      <div className="npc-panel-narration">
        It is done! A fine piece of work. Now go forth and temper it with action!
      </div>
      <div className="forge-summary">
        <strong>⚒️ {title}</strong>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span className="forge-xp-badge">+{xpAwarded} XP</span>
      </div>
      <div className="npc-panel-actions">
        <button className="forge-button" onClick={resetForge}>
          Back to Menu
        </button>
        <button className="forge-button forge-button--secondary" onClick={onClose}>
          Leave Forge
        </button>
      </div>
    </>
  );

  const resetForge = useCallback(() => {
    setTitle('');
    setSelectedParent(null);
    setDuration('none');
    setCreatedGoalId(null);
    setXpAwarded(0);
    setError('');
    setStep('menu');
  }, []);

  // ── Progress ──
  const handleProgress = useCallback(() => {
    const active = GoalService.getActive();
    const stats = GoalService.stats();
    setActiveGoals(active);
    setGoalStats(stats);
    setStep('progress');
  }, []);

  const renderProgress = () => {
    if (!goalStats) return null;
    const { total, active, completed, avgProgress } = goalStats;

    let narration: string;
    if (total === 0) {
      narration = 'The forge is cold... No goals have been set. Shall we change that?';
    } else if (avgProgress > 70) {
      narration = 'Nearly tempered! Your goals are close to completion. Keep the hammer swinging!';
    } else if (avgProgress > 30) {
      narration = 'The iron is warming. Steady progress — keep at it, adventurer.';
    } else {
      narration = 'Still raw iron... Your goals need more work. Every small step heats the forge.';
    }

    return (
      <>
        <div className="npc-panel-narration">{narration}</div>
        <div className="forge-summary">
          Total: {total} | Active: {active} | Completed: {completed} | Avg Progress: {Math.round(avgProgress)}%
        </div>
        {activeGoals.map(g => (
          <div key={g.id} className="forge-goal-card">
            <div className="forge-goal-card-title">{g.icon || '🎯'} {g.title}</div>
            <div className="forge-progress-bar">
              <div className="forge-progress-bar-fill" style={{ width: `${g.progress ?? 0}%` }} />
            </div>
          </div>
        ))}
        <div className="npc-panel-actions" style={{ marginTop: 12 }}>
          <button className="forge-button forge-button--secondary" onClick={() => setStep('menu')}>
            ← Back
          </button>
        </div>
      </>
    );
  };

  // ── Suggestions ──
  const handleSuggestions = useCallback(() => {
    try {
      const ctx = getLifeContext();
      const generated: { title: string; reason: string }[] = [];

      // Analyze gaps
      const goalCtx = ctx.goals;
      if (goalCtx.active === 0) {
        generated.push({ title: 'Set My First Active Goal', reason: 'You have no active goals — time to ignite the forge!' });
      }
      if (goalCtx.avgProgress > 80 && goalCtx.active > 0) {
        generated.push({ title: 'Plan My Next Challenge', reason: 'Your current goals are nearly done. Think bigger!' });
      }

      // Check health
      const healthCtx = ctx.health;
      if (healthCtx && typeof healthCtx === 'object' && ('logged' in healthCtx) && !healthCtx.logged) {
        generated.push({ title: 'Build a Health Tracking Habit', reason: 'Your health metrics are untracked — the body is a weapon too.' });
      }

      // Check finance
      const finCtx = ctx.finance;
      if (finCtx && typeof finCtx === 'object' && ('total' in finCtx) && finCtx.total === 0) {
        generated.push({ title: 'Start Tracking My Finances', reason: 'No financial entries yet — gold management is an art.' });
      }

      // Fallbacks
      if (generated.length === 0) {
        generated.push(
          { title: 'Level Up a Key Skill', reason: 'Growth never stops. Pick a skill to sharpen.' },
          { title: 'Build a Weekly Review Habit', reason: 'Reflection strengthens the blade.' },
        );
      }

      setSuggestions(generated.slice(0, 3));
    } catch {
      setSuggestions([
        { title: 'Set a Personal Goal', reason: 'The forge awaits your ambition.' },
      ]);
    }
    setStep('suggestions');
  }, []);

  const renderSuggestions = () => (
    <>
      <div className="npc-panel-narration">
        I've studied the patterns of your journey. Here's what the forge whispers...
      </div>
      {suggestions.map((s, i) => (
        <div key={i} className="forge-suggestion-card">
          <div style={{ flex: 1 }}>
            <span>{s.title}</span>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#8BA4BE', marginTop: 4 }}>{s.reason}</div>
          </div>
          <button
            className="forge-button"
            style={{ padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap' }}
            onClick={() => {
              setTitle(s.title);
              setStep('forge_title');
            }}
          >
            Forge This
          </button>
        </div>
      ))}
      <div className="npc-panel-actions" style={{ marginTop: 12 }}>
        <button className="forge-button forge-button--secondary" onClick={() => setStep('menu')}>
          ← Back
        </button>
      </div>
    </>
  );

  // ── Render ──
  return (
    <>
      {error && (
        <div style={{ color: '#FF6B6B', fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>{error}</div>
      )}
      {step === 'menu' && renderMenu()}
      {step === 'forge_title' && renderForgeTitle()}
      {step === 'forge_parent' && renderForgeParent()}
      {step === 'forge_confirm' && renderForgeConfirm()}
      {step === 'forging' && renderForging()}
      {step === 'forge_done' && renderForgeDone()}
      {step === 'progress' && renderProgress()}
      {step === 'suggestions' && renderSuggestions()}
    </>
  );
}
