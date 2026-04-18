/**
 * NLPDecomposer — AI-powered objective planning wizard
 *
 * User types a natural language vision, AI generates a full hierarchy,
 * user reviews/edits, then bulk-creates all goals + tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Loader2, ArrowRight, Check } from 'lucide-react';
import { decomposeObjective, countHierarchyItems, type DecomposedHierarchy } from '../../lib/llm/objective-decomposer';
import { HierarchyPreview } from './HierarchyPreview';
import { useGoalsStore, type GoalNode } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useUserStore } from '../../stores/useUserStore';
import { showToast } from '../Toast';
import { genId } from '../../utils/date';
import { getEffectiveUserId } from '../../lib/local-db';
import { logger } from '../../utils/logger';
// Tasks are now assigned due_dates programmatically — no separate schedule_events needed.
import { supabase } from '../../lib/data-access';
import './NLPDecomposer.css';

interface NLPDecomposerProps {
  onClose: () => void;
  onCreated?: () => void;
}

type WizardStep = 'input' | 'loading' | 'preview' | 'creating';

const PLACEHOLDER_EXAMPLES = [
  'Start a cleaning business this year',
  'Run a marathon by December',
  'Learn electronics engineering',
  'Save $10,000 for an emergency fund',
  'Build a personal website and portfolio',
  'Get my driver\'s license',
];

export function NLPDecomposer({ onClose, onCreated }: NLPDecomposerProps) {
  const user = useUserStore(s => s.user);
  const goals = useGoalsStore(s => s.goals);
  const createGoalBatch = useGoalsStore(s => s.createGoalBatch);
  const createTask = useScheduleStore(s => s.createTask);

  const [step, setStep] = useState<WizardStep>('input');
  const [input, setInput] = useState('');
  const [hierarchy, setHierarchy] = useState<DecomposedHierarchy | null>(null);
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) return;
    setStep('loading');
    setError(null);

    try {
      const existingObjectives = goals
        .filter(g => !g.parent_goal_id || g.category === 'objective')
        .map(g => g.title);

      const today = new Date().toISOString().split('T')[0];
      const result = await decomposeObjective(input.trim(), existingObjectives, today);
      setHierarchy(result);
      setExcludedPaths(new Set());
      setStep('preview');
    } catch (err) {
      logger.error('[NLPDecomposer] Generation failed:', err);
      setError('Failed to generate plan. Please try again.');
      setStep('input');
    }
  }, [input, goals]);

  const handleToggleNode = useCallback((path: string) => {
    setExcludedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleEditTitle = useCallback((path: string, newTitle: string) => {
    if (!hierarchy) return;

    // Deep clone and update
    const h = JSON.parse(JSON.stringify(hierarchy)) as DecomposedHierarchy;

    if (path === 'objective') {
      h.objective.title = newTitle;
    } else {
      const parts = path.split('.');
      const epicIdx = parseInt(parts[0].replace('epic-', ''));

      if (parts.length === 1) {
        h.epics[epicIdx].title = newTitle;
      } else if (parts.length === 2) {
        const goalIdx = parseInt(parts[1].replace('goal-', ''));
        h.epics[epicIdx].goals[goalIdx].title = newTitle;
      } else if (parts.length === 3) {
        const goalIdx = parseInt(parts[1].replace('goal-', ''));
        const taskIdx = parseInt(parts[2].replace('task-', ''));
        h.epics[epicIdx].goals[goalIdx].tasks[taskIdx].title = newTitle;
      }
    }

    setHierarchy(h);
  }, [hierarchy]);

  const handleCreate = useCallback(async () => {
    if (!hierarchy) return;
    setStep('creating');

    try {
      const userId = getEffectiveUserId();
      const { objective, epics } = hierarchy;

      // 1. Create objective
      const objectiveId = genId();
      const goalBatch: Partial<GoalNode>[] = [{
        id: objectiveId,
        user_id: userId,
        title: objective.title,
        description: objective.description,
        icon: objective.icon || '🎯',
        category: 'objective',
        domain: objective.domain,
        target_date: objective.targetDate,
        status: 'active',
        progress: 0,
        sort_order: 0,
        priority: 'high',
        color: '#00D4FF',
        decomposition_source: 'nlp',
      }];

      // 2. Create epics and goals
      const taskQueue: { goalId: string; tasks: typeof epics[0]['goals'][0]['tasks'] }[] = [];

      for (let ei = 0; ei < epics.length; ei++) {
        const epicPath = `epic-${ei}`;
        if (excludedPaths.has(epicPath)) continue;

        const epicId = genId();
        goalBatch.push({
          id: epicId,
          user_id: userId,
          title: epics[ei].title,
          description: epics[ei].description,
          icon: epics[ei].icon || '📋',
          category: 'epic',
          parent_goal_id: objectiveId,
          status: 'active',
          progress: 0,
          sort_order: ei,
          priority: 'high',
          color: '#A855F7',
          decomposition_source: 'nlp',
        });

        for (let gi = 0; gi < epics[ei].goals.length; gi++) {
          const goalPath = `${epicPath}.goal-${gi}`;
          if (excludedPaths.has(goalPath)) continue;

          const goal = epics[ei].goals[gi];
          const goalId = genId();
          goalBatch.push({
            id: goalId,
            user_id: userId,
            title: goal.title,
            description: goal.description,
            icon: goal.icon || '⚡',
            category: 'goal',
            parent_goal_id: epicId,
            target_date: goal.targetDate,
            status: 'active',
            progress: 0,
            sort_order: gi,
            priority: 'medium',
            color: '#39FF14',
            decomposition_source: 'nlp',
          });

          // Collect non-excluded tasks
          const filteredTasks = goal.tasks.filter((_, ti) => !excludedPaths.has(`${goalPath}.task-${ti}`));
          if (filteredTasks.length > 0) {
            taskQueue.push({ goalId, tasks: filteredTasks });
          }
        }
      }

      // 3. Bulk create goals
      await createGoalBatch(goalBatch);

      // 4. Create tasks with programmatic due_date spread across objective timeline
      // Instead of relying on LLM suggestedWeek or creating separate schedule_events,
      // we assign due_dates that spread tasks evenly across the objective's timeline.
      let taskCount = 0;
      const allTasks: Array<{ goalId: string; task: typeof taskQueue[0]['tasks'][0]; index: number }> = [];
      for (const { goalId, tasks } of taskQueue) {
        for (const task of tasks) {
          allTasks.push({ goalId, task, index: allTasks.length });
        }
      }

      // Calculate the timeline span from objective's target date
      const today = new Date();
      const targetDate = objective.targetDate ? new Date(objective.targetDate + 'T12:00:00') : null;
      const totalDays = targetDate
        ? Math.max(14, Math.round((targetDate.getTime() - today.getTime()) / 86400000))
        : 90; // Default 3 months if no target date

      // Spread tasks evenly: each task gets a due_date spaced across the full timeline
      // High priority tasks get earlier dates, low priority later
      const priorityOrder = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...allTasks].sort((a, b) => {
        const pa = priorityOrder[a.task.priority as keyof typeof priorityOrder] ?? 2;
        const pb = priorityOrder[b.task.priority as keyof typeof priorityOrder] ?? 2;
        return pa - pb || a.index - b.index;
      });

      const createdTaskIdMap: Record<number, string> = {}; // originalIndex → taskId

      for (let i = 0; i < sorted.length; i++) {
        const { goalId, task, index: originalIndex } = sorted[i];
        const taskId = genId();
        createdTaskIdMap[originalIndex] = taskId;

        // Spread due_date across the timeline: first task starts today, last at ~90% of timeline
        const dayOffset = Math.round((i / Math.max(sorted.length - 1, 1)) * totalDays * 0.9);
        const dueDate = new Date(today.getTime() + dayOffset * 86400000);
        const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

        // Calculate suggested_week from the due_date offset
        const suggestedWeek = Math.max(1, Math.ceil(dayOffset / 7));

        // Resolve dependsOnIndex to actual task ID
        let dependsOn: string | undefined;
        if (task.dependsOnIndex !== undefined && task.dependsOnIndex >= 0) {
          dependsOn = createdTaskIdMap[task.dependsOnIndex];
        }

        await createTask(userId, task.title, task.priority, {
          id: taskId,
          goal_id: goalId,
          due_date: dueDateStr,
          estimated_duration: task.estimatedMinutes || 60,
          domain: task.domain,
          suggested_week: suggestedWeek,
          depends_on_task_id: dependsOn,
          source: 'onboarding_ai',
        });
        taskCount++;
      }

      // 6. Force immediate sync to persist goals/tasks to Supabase
      try {
        const { syncNowImmediate } = await import('../../lib/sync-engine');
        await syncNowImmediate(userId);
      } catch { /* non-critical — debounced sync will catch up */ }

      // 7. Refresh
      window.dispatchEvent(new Event('lifeos-refresh'));
      useGoalsStore.getState().invalidate();

      const counts = countHierarchyItems(hierarchy, excludedPaths);
      const weeksSpan = Math.ceil(totalDays / 7);
      showToast(`Created "${objective.title}" — ${taskCount} tasks spread across ${weeksSpan} weeks`, '✨', '#39FF14');

      onCreated?.();
      onClose();
    } catch (err) {
      logger.error('[NLPDecomposer] Creation failed:', err);
      showToast('Failed to create goals. Please try again.', '⚠️', '#F43F5E');
      setStep('preview');
    }
  }, [hierarchy, excludedPaths, user, createGoalBatch, createTask, onClose, onCreated]);

  const counts = hierarchy ? countHierarchyItems(hierarchy, excludedPaths) : { goals: 0, tasks: 0 };

  return createPortal(
    <div className="nlp-overlay" onClick={e => { if (e.target === e.currentTarget && step !== 'creating') onClose(); }}>
      <div className="nlp-modal">
        {/* Header */}
        <div className="nlp-header">
          <div className="nlp-header-title">
            <Sparkles size={18} className="nlp-sparkle" />
            <h2>AI Goal Planner</h2>
          </div>
          {step !== 'creating' && (
            <button className="nlp-close" onClick={onClose} aria-label="Close AI goal planner"><X size={18} /></button>
          )}
        </div>

        {/* Step: Input */}
        {step === 'input' && (
          <div className="nlp-step nlp-step-input">
            <p className="nlp-prompt">What do you want to achieve?</p>
            <textarea
              className="nlp-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
              rows={3}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
            />
            {error && <p className="nlp-error">{error}</p>}
            <div className="nlp-actions">
              <button className="nlp-btn-primary" onClick={handleGenerate} disabled={!input.trim()}>
                <Sparkles size={14} /> Generate Plan <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div className="nlp-step nlp-step-loading">
            <Loader2 size={32} className="nlp-spinner" />
            <p className="nlp-loading-text">Analyzing your vision...</p>
            <p className="nlp-loading-sub">Creating objective, epics, goals, and tasks</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && hierarchy && (
          <div className="nlp-step nlp-step-preview">
            <div className="nlp-preview-header">
              <p className="nlp-preview-count">
                Will create <strong>{counts.goals}</strong> goals and <strong>{counts.tasks}</strong> tasks
              </p>
              <p className="nlp-preview-hint">Toggle checkboxes to include/exclude items. Click titles to edit.</p>
            </div>
            <div className="nlp-preview-scroll">
              <HierarchyPreview
                hierarchy={hierarchy}
                excludedPaths={excludedPaths}
                onToggleNode={handleToggleNode}
                onEditTitle={handleEditTitle}
              />
            </div>
            <div className="nlp-actions">
              <button className="nlp-btn-secondary" onClick={() => setStep('input')}>
                Back
              </button>
              <button className="nlp-btn-primary" onClick={handleCreate} disabled={counts.goals === 0}>
                <Check size={14} /> Create All ({counts.goals + counts.tasks} items)
              </button>
            </div>
          </div>
        )}

        {/* Step: Creating */}
        {step === 'creating' && (
          <div className="nlp-step nlp-step-loading">
            <Loader2 size={32} className="nlp-spinner" />
            <p className="nlp-loading-text">Creating your goals...</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
