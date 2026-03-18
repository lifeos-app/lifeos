import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Circle, CheckCircle2, ChevronDown, ChevronUp, Plus, Loader2, Save, XCircle, Calendar, Check, DollarSign, TrendingUp, Activity, Zap, MessageCircle, Target, BarChart3, CheckSquare, Wallet, FileText, RefreshCw, HeartPulse } from 'lucide-react';
import { EmojiIcon } from '../lib/emoji-icon';
import { useUserStore } from '../stores/useUserStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useAgentStore } from '../stores/useAgentStore';
import { AIChildGenerator } from './goals/AIChildGenerator';
import { GoalTaskGenerator } from './goals/GoalTaskGenerator';
import './NodeDetail.css';

// ── Types ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoalRecord = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRecord = Record<string, any>;

interface Business {
  id: string;
  name: string;
}

interface KeyResult {
  text: string;
  done: boolean;
}

interface Resource {
  name: string;
  cost: number;
  status: string;
}

interface NodeDetailProps {
  nodeId: string;
  allGoals: GoalRecord[];
  allTasks: TaskRecord[];
  onClose: () => void;
  onNavigate?: (nodeId: string) => void;
  onViewInList?: (nodeId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function NodeDetail({ nodeId, allGoals, allTasks, onClose, onNavigate, onViewInList: _onViewInList }: NodeDetailProps) {
  const node = allGoals.find((g) => g.id === nodeId);

  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const businesses = useGoalsStore(s => s.businesses) as Business[];
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    header: true,
    statusPriority: true,
    description: true,
    timeline: true,
    financial: false,
    success: false,
    resources: false,
    children: true,
    finance: false,
    habits: false,
    health: false,
  });
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState('');
  const [newResource, setNewResource] = useState<Resource>({ name: '', cost: 0, status: 'needed' });
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'progress' | 'resources'>('overview');

  // Touch gesture state
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Store hooks
  const { expenses, budgets } = useFinanceStore();
  const { habits, getLogsForHabit } = useHabitsStore();
  const { todayMetrics } = useHealthStore();
  const { sendMessage } = useAgentStore();

  useEffect(() => {
    if (node) {
      setEditDesc(node.description || '');
      setEditTitle(node.title || '');
      setSectionsOpen(prev => ({
        ...prev,
        financial: !!(node.budget_allocated || node.financial_type || node.business_id),
        success: !!(node.success_criteria || node.key_results),
        finance: !!(node.budget_allocated || node.business_id),
        habits: !!(cat === 'goal'),
        health: !!(cat === 'goal' && node.domain === 'health'),
      }));
    }
    setShowAddChild(false);
    setNewChildTitle('');
  }, [node]);

  const cat = node?.category || 'goal';
  const color = node?.color || '#00D4FF';
  const pct = Math.round((node?.progress || 0) * 100);

  const children = allGoals.filter((g) => g.parent_goal_id === nodeId);
  const linkedTasks = allTasks.filter((t) => t.goal_id === nodeId);
  const activeTasks = linkedTasks.filter((t) => t.status !== 'done');
  const doneTasks = linkedTasks.filter((t) => t.status === 'done');

  const ancestorChain = useMemo(() => {
    const chain: GoalRecord[] = [];
    let currentId: string | null | undefined = node?.parent_goal_id;
    while (currentId) {
      const parent = allGoals.find(g => g.id === currentId);
      if (!parent) break;
      chain.unshift(parent);
      currentId = parent.parent_goal_id;
    }
    return chain;
  }, [node?.parent_goal_id, allGoals]);

  const actualHours = useMemo(() => {
    const getDescendantTasks = (goalId: string): TaskRecord[] => {
      const directTasks = allTasks.filter((t) => t.goal_id === goalId);
      const childGoals = allGoals.filter((g) => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap((c) => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const allDesc = getDescendantTasks(nodeId);
    const totalMins = allDesc.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
    return Math.round(totalMins / 60 * 10) / 10;
  }, [nodeId, allGoals, allTasks]);

  const budgetSpent = useMemo(() => {
    const getDescendantTasks = (goalId: string): TaskRecord[] => {
      const directTasks = allTasks.filter((t) => t.goal_id === goalId);
      const childGoals = allGoals.filter((g) => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap((c) => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const allDesc = getDescendantTasks(nodeId);
    return allDesc
      .filter((t) => t.financial_type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(String(t.financial_amount)) || 0), 0);
  }, [nodeId, allGoals, allTasks]);

  const keyResults = useMemo((): KeyResult[] => {
    try { return node?.key_results ? JSON.parse(node.key_results) : []; }
    catch { return []; }
  }, [node?.key_results]);

  const resources = useMemo((): Resource[] => {
    try { return node?.resources ? JSON.parse(node.resources) : []; }
    catch { return []; }
  }, [node?.resources]);

  // Finance cross-reference
  const relatedExpenses = useMemo(() => {
    if (cat !== 'goal' || !node?.business_id) return [];
    return expenses.filter(e => e.business_id === node.business_id).slice(0, 5);
  }, [cat, node?.business_id, expenses]);

  const goalBudget = useMemo(() => {
    if (!node?.budget_allocated) return null;
    return {
      allocated: node.budget_allocated,
      spent: budgetSpent,
      remaining: node.budget_allocated - budgetSpent,
    };
  }, [node?.budget_allocated, budgetSpent]);

  // Habits cross-reference
  const linkedHabits = useMemo(() => {
    if (cat !== 'goal') return [];
    return habits.filter(h => h.goal_id === nodeId);
  }, [cat, nodeId, habits]);

  // Health cross-reference
  const showHealth = cat === 'goal' && (node?.domain === 'health' || node?.category === 'health');

  if (!node) { onClose(); return null; }

  const description = node?.description || '';
  const resourcesMatch = description.match(/📦 Resources[^:]*:([\s\S]*?)(?=\n⏱|$)/);
  const mainDesc = description.split(/\n\n📦/)[0] || description;

  const toggleSection = (key: string) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const { updateGoal, createGoal: storeCreateGoal } = useGoalsStore.getState();
  const { updateTask: storeUpdateTask, createTask: storeCreateTask } = useScheduleStore.getState();

  const saveField = async (field: string, value: string | number | null) => {
    await updateGoal(nodeId, { [field]: value } as any);
  };

  const saveTitle = async () => {
    await saveField('title', editTitle.trim() || node?.title || '');
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await saveField('description', editDesc.trim() || null);
    setEditingDesc(false);
  };

  const saveKeyResults = async (results: KeyResult[]) => {
    await saveField('key_results', JSON.stringify(results));
  };

  const saveResources = async (res: Resource[]) => {
    await saveField('resources', JSON.stringify(res));
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await storeUpdateTask(taskId, {
      status: newStatus as any,
      completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  const createChild = async () => {
    if (!newChildTitle.trim()) return;
    setAddingChild(true);
    if (cat === 'goal') {
      await storeCreateTask(node!.user_id, newChildTitle.trim(), 'medium', {
        goal_id: nodeId,
      });
    } else {
      const childCat = cat === 'objective' ? 'epic' : 'goal';
      const childIcon = childCat === 'epic' ? '⚡' : '🏁';
      const childColor = childCat === 'epic' ? '#FACC15' : '#39FF14';
      await storeCreateGoal({
        user_id: node!.user_id,
        title: newChildTitle.trim(),
        category: childCat,
        parent_goal_id: nodeId,
        status: 'active',
        progress: 0,
        icon: childIcon,
        color: childColor,
        sort_order: children.length,
      } as any);
    }
    setNewChildTitle('');
    setShowAddChild(false);
    setAddingChild(false);
    window.dispatchEvent(new Event('lifeos-refresh'));
  };

  const handleZeroClawClick = async () => {
    const contextMessage = `Tell me about my progress on "${node?.title}". What should I focus on?`;
    
    const { data: { session } } = await useUserStore.getState().getSessionCached();
    if (session?.user) {
      await sendMessage(session.user.id, contextMessage, {
        currentPage: 'goals',
        activeGoalId: nodeId,
      });
    }
    
    // Close detail and trigger AgentChatFAB to open
    onClose();
    window.dispatchEvent(new CustomEvent('lifeos-open-agent-chat'));
  };

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchCurrent(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaY = touchCurrent - touchStart;
    // If dragged down >100px, close
    if (deltaY > 100) {
      onClose();
    }
    
    setTouchStart(0);
    setTouchCurrent(0);
  };

  const dragOffset = isDragging && touchCurrent > touchStart ? touchCurrent - touchStart : 0;

  const catLabel = cat === 'objective' ? 'Objective' : cat === 'epic' ? 'Epic' : 'Goal';
  const childLabel = cat === 'objective' ? 'Epics' : cat === 'epic' ? 'Goals' : 'Tasks';

  const priorityColors: Record<string, string> = {
    critical: '#F43F5E', high: '#F97316', medium: '#FACC15', low: '#39FF14',
  };
  const domainColors: Record<string, string> = {
    education: '#00D4FF', business: '#FACC15', health: '#39FF14',
    personal: '#A855F7', spiritual: '#F97316', creative: '#EC4899',
  };

  const budgetPct = node?.budget_allocated ? (budgetSpent / node.budget_allocated) * 100 : 0;
  const budgetBarColor = budgetPct > 90 ? '#F43F5E' : budgetPct > 75 ? '#FACC15' : '#39FF14';
  const timePct = node?.estimated_hours ? (actualHours / node.estimated_hours) * 100 : 0;
  const timeBarColor = timePct > 90 ? '#F43F5E' : timePct > 75 ? '#FACC15' : '#39FF14';

  const content = (
    <div className="nd-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        className="nd-sheet"
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle (mobile only) */}
        <div className="nd-drag-handle">
          <div className="nd-drag-pill" />
        </div>

        {/* Accent bar */}
        <div className="nd-accent-bar" style={{ background: color }} />

        {/* HEADER */}
        <div className="nd-header">
          <div className="nd-header-left">
            <span className="nd-icon-wrap"><EmojiIcon emoji={node?.icon || '🎯'} size={48} fallbackAsText /></span>
            <div className="nd-header-info">
              <div className="nd-meta-badges" style={{ marginBottom: 8 }}>
                <span className={`nd-cat-badge cat-${cat}`}>{catLabel}</span>
                {node?.domain && (
                  <span className="nd-meta-badge" style={{ background: `${domainColors[node.domain]}15`, borderColor: `${domainColors[node.domain]}40`, color: domainColors[node.domain], border: '1px solid' }}>
                    {node.domain}
                  </span>
                )}
                {node?.priority && (
                  <span className="nd-meta-badge" style={{ background: `${priorityColors[node.priority]}15`, borderColor: `${priorityColors[node.priority]}40`, color: priorityColors[node.priority], border: '1px solid' }}>
                    {node.priority}
                  </span>
                )}
              </div>
            {editingTitle ? (
              <div className="flex gap-1.5">
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="nd-title-input" />
                <button onClick={saveTitle} className="px-2.5 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-md text-cyan-400 cursor-pointer" aria-label="Save title"><Save size={14} /></button>
                <button onClick={() => setEditingTitle(false)} className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-white cursor-pointer" aria-label="Cancel editing"><XCircle size={14} /></button>
              </div>
            ) : (
              <h2 onClick={() => setEditingTitle(true)} className="nd-title">
                {node?.title || 'Unknown'}
              </h2>
            )}
            </div>
          </div>
          <button onClick={onClose} className="nd-close">
            <X size={20} />
          </button>
        </div>

        {/* AI Generate + Task Generator buttons */}
        {(cat === 'objective' || cat === 'epic' || cat === 'goal') && (
          <div className="nd-generate-bar">
            {cat === 'objective' && (
              <AIChildGenerator
                parentId={nodeId}
                parentTitle={node?.title || ''}
                parentDescription={node?.description || null}
                parentCategory="objective"
                childCategory="epic"
                existingChildren={children}
                targetDate={node?.target_date}
                onCreated={() => useGoalsStore.getState().fetchAll()}
              />
            )}
            {cat === 'epic' && (
              <AIChildGenerator
                parentId={nodeId}
                parentTitle={node?.title || ''}
                parentDescription={node?.description || null}
                parentCategory="epic"
                childCategory="goal"
                existingChildren={children}
                targetDate={node?.target_date}
                onCreated={() => useGoalsStore.getState().fetchAll()}
              />
            )}
            {cat === 'goal' && (
              <GoalTaskGenerator
                goalId={nodeId}
                goalTitle={node?.title || ''}
                goalDescription={node?.description || null}
                goalTargetDate={node?.target_date}
                onTasksCreated={() => useScheduleStore.getState().fetchAll()}
              />
            )}
          </div>
        )}

        {/* BODY - scrollable */}
        <div className="nd-body">

          {/* HIERARCHY TREE */}
          {(ancestorChain.length > 0 || children.length > 0) && (
            <div className="nd-hierarchy-tree">
              <div className="nd-hierarchy-label">Hierarchy</div>
              {ancestorChain.map((ancestor, i) => (
                <div key={ancestor.id} style={{ paddingLeft: i * 16 }}>
                  <button className="nd-hierarchy-btn" onClick={() => onNavigate?.(ancestor.id)}>
                    <EmojiIcon emoji={ancestor.icon || '🎯'} size={16} fallbackAsText />
                    <span className="nd-hierarchy-title">{ancestor.title}</span>
                    <ChevronRight size={12} style={{ opacity: 0.3 }} />
                  </button>
                  <div className="nd-hierarchy-connector" />
                </div>
              ))}
              <div style={{ paddingLeft: ancestorChain.length * 16 }}>
                <div className="nd-hierarchy-node nd-hierarchy-current">
                  <EmojiIcon emoji={node?.icon || '🎯'} size={16} fallbackAsText />
                  <span className="nd-hierarchy-title">{node?.title}</span>
                  {cat === 'goal' && linkedTasks.length > 0 && (
                    <span className="nd-hierarchy-badge">
                      <CheckSquare size={10} /> {doneTasks.length}/{linkedTasks.length}
                    </span>
                  )}
                </div>
              </div>
              {children.slice(0, 5).map(child => (
                <div key={child.id} style={{ paddingLeft: (ancestorChain.length + 1) * 16 }}>
                  <div className="nd-hierarchy-connector" />
                  <button className="nd-hierarchy-btn" onClick={() => onNavigate?.(child.id)}>
                    <EmojiIcon emoji={child.icon || '🎯'} size={14} fallbackAsText />
                    <span className="nd-hierarchy-title">{child.title}</span>
                    {child.category === 'goal' && (
                      <span className="nd-hierarchy-badge">
                        <CheckSquare size={10} /> {allTasks.filter(t => t.goal_id === child.id && t.status === 'done').length}/{allTasks.filter(t => t.goal_id === child.id).length}
                      </span>
                    )}
                    <ChevronRight size={12} style={{ opacity: 0.3 }} />
                  </button>
                </div>
              ))}
              {children.length > 5 && (
                <div style={{ paddingLeft: (ancestorChain.length + 1) * 16 }} className="nd-hierarchy-label">
                  +{children.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* ── TAB BAR ── */}
          <div className="nd-tab-bar">
            {(['overview', 'tasks', 'progress', 'resources'] as const).map(tab => (
              <button
                key={tab}
                className={`nd-tab ${activeTab === tab ? 'nd-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && <FileText size={12} />}
                {tab === 'tasks' && <CheckSquare size={12} />}
                {tab === 'progress' && <BarChart3 size={12} />}
                {tab === 'resources' && <Wallet size={12} />}
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ── */}
          <div className="nd-tab-content">

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === 'overview' && (
            <>
              {/* Description */}
              <Section title="Description" icon={<FileText size={14} />} isOpen={sectionsOpen.description} onToggle={() => toggleSection('description')}>
                {editingDesc ? (
                  <div>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={5}
                      className="nd-desc-textarea" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={saveDesc} className="px-4 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-md text-cyan-400 cursor-pointer text-xs font-[inherit]">Save</button>
                      <button onClick={() => setEditingDesc(false)} className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-white cursor-pointer text-xs font-[inherit]">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p onClick={() => setEditingDesc(true)} className="nd-desc-text">
                    {mainDesc || 'Click to add description...'}
                  </p>
                )}
              </Section>

              {/* Timeline */}
              {(node?.target_date || node?.deadline_type || node?.estimated_hours) && (
                <Section title="Timeline" icon={<Calendar size={14} />} isOpen={sectionsOpen.timeline} onToggle={() => toggleSection('timeline')}>
                <div className="flex flex-col gap-3">
                  <Field label="Target Date">
                    <input type="date" value={node?.target_date || ''} onChange={e => saveField('target_date', e.target.value || null)}
                      className={inputClass} />
                  </Field>
                  {node?.target_date && (
                    <div className="text-[11px] text-white/40 flex items-center gap-1.5">
                      <Calendar size={12} className="mr-1 align-middle" />
                      {new Date(node.target_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {node.deadline_type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                          {node.deadline_type}
                        </span>
                      )}
                    </div>
                  )}
                  <Field label="Deadline Type">
                    <div className="flex gap-1.5">
                      {['hard', 'soft', 'aspirational'].map(dt => (
                        <button key={dt} onClick={() => saveField('deadline_type', dt)}
                          className={`flex-1 px-2.5 py-1.5 rounded-md cursor-pointer text-xs font-[inherit] border ${
                            node?.deadline_type === dt
                              ? 'bg-cyan-500/25 border-cyan-500/50 text-cyan-400'
                              : 'bg-white/[0.04] border-white/[0.08] text-white'
                          }`}>
                          {dt.charAt(0).toUpperCase() + dt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Estimated Hours">
                    <input type="number" step="0.5" value={node?.estimated_hours || ''} onChange={e => saveField('estimated_hours', parseFloat(e.target.value) || null)}
                      placeholder="0" className={inputClass} />
                  </Field>
                  <Field label="Actual Hours (computed)">
                    <div className="text-[13px] text-white font-semibold">{actualHours}h</div>
                  </Field>
                </div>
              </Section>
              )}

              {/* Success Criteria (objectives & epics) */}
              {cat !== 'goal' && (node?.success_criteria || (node?.key_results && node.key_results.length > 2)) && (
                <Section title="Success Criteria" icon={<Target size={14} />} isOpen={sectionsOpen.success} onToggle={() => toggleSection('success')} accent="#39FF14">
                  <div className="flex flex-col gap-3">
                    <Field label="Success Criteria">
                      <textarea value={node?.success_criteria || ''} onChange={e => saveField('success_criteria', e.target.value || null)}
                        rows={3} placeholder="What does success look like?"
                        className={`${inputClass} resize-y`} />
                    </Field>
                    <Field label="Key Results">
                      <div className="flex flex-col gap-1.5">
                        {keyResults.map((kr, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button onClick={() => {
                              const updated = [...keyResults];
                              updated[i].done = !updated[i].done;
                              saveKeyResults(updated);
                            }} className="bg-transparent border-none cursor-pointer p-0" style={{ color: kr.done ? '#39FF14' : 'rgba(255,255,255,0.3)' }}>
                              {kr.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                            <input value={kr.text} onChange={e => {
                              const updated = [...keyResults];
                              updated[i].text = e.target.value;
                              saveKeyResults(updated);
                            }} className={`${inputClass} flex-1 ${kr.done ? 'line-through opacity-60' : ''}`} />
                            <button onClick={() => {
                              saveKeyResults(keyResults.filter((_, idx) => idx !== i));
                            }} className="bg-rose-500/15 border border-rose-500/30 rounded-md px-2 py-1 cursor-pointer text-rose-500 text-[11px]">
                              Delete
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-1.5">
                          <input value={newKeyResult} onChange={e => setNewKeyResult(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newKeyResult.trim()) {
                                saveKeyResults([...keyResults, { text: newKeyResult.trim(), done: false }]);
                                setNewKeyResult('');
                              }
                            }}
                            placeholder="Add new key result..." className={`${inputClass} flex-1`} />
                          <button onClick={() => {
                            if (newKeyResult.trim()) {
                              saveKeyResults([...keyResults, { text: newKeyResult.trim(), done: false }]);
                              setNewKeyResult('');
                            }
                          }} disabled={!newKeyResult.trim()}
                            className={`px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-md text-cyan-400 text-xs ${newKeyResult.trim() ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            Add
                          </button>
                        </div>
                      </div>
                    </Field>
                  </div>
                </Section>
              )}

              {/* Linked Habits (goals) */}
              {cat === 'goal' && linkedHabits.length > 0 && (
                <Section title="Linked Habits" icon={<RefreshCw size={14} />} isOpen={sectionsOpen.habits} onToggle={() => toggleSection('habits')} accent="#A855F7">
                  <div className="flex flex-col gap-2">
                    {linkedHabits.map(habit => {
                      const logs = getLogsForHabit(habit.id);
                      const streak = habit.streak_current || 0;
                      const completionRate = logs.length > 0 ? Math.round((logs.length / 30) * 100) : 0;
                      return (
                        <div key={habit.id} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-md">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{habit.icon || '⭐'}</span>
                            <div>
                              <div className="text-sm text-white font-medium">{habit.title}</div>
                              <div className="text-[10px] text-white/50">{streak} day streak · {completionRate}% completion</div>
                            </div>
                          </div>
                          <Zap size={14} className="text-purple-400" />
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Health Connection (health goals) */}
              {showHealth && todayMetrics && (
                <Section title="Health Connection" icon={<HeartPulse size={14} />} isOpen={sectionsOpen.health} onToggle={() => toggleSection('health')} accent="#39FF14">
                  <div className="flex flex-col gap-3">
                    {todayMetrics.steps && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">Steps Today</span>
                        <span className="text-sm font-semibold text-green-400">{todayMetrics.steps.toLocaleString()}</span>
                      </div>
                    )}
                    {todayMetrics.calories_burned && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">Calories Burned</span>
                        <span className="text-sm font-semibold text-orange-400">{todayMetrics.calories_burned}</span>
                      </div>
                    )}
                    {todayMetrics.workout_duration_minutes && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">Workout Duration</span>
                        <span className="text-sm font-semibold text-cyan-400">{todayMetrics.workout_duration_minutes} min</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                      <Activity size={12} />
                      <span>Data from today's health metrics</span>
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ═══ TASKS TAB ═══ */}
          {activeTab === 'tasks' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white/50">
                  {linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => setShowAddChild(!showAddChild)} className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-md text-cyan-400 text-[11px] cursor-pointer font-[inherit]">
                  <Plus size={12} /> Add Task
                </button>
              </div>

              {showAddChild && (
                <div className="flex gap-1.5 mb-2.5">
                  <input autoFocus value={newChildTitle} onChange={e => setNewChildTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createChild(); if (e.key === 'Escape') setShowAddChild(false); }}
                    placeholder="New task title..."
                    className="flex-1 px-3 py-2 bg-white/[0.04] border border-cyan-500/20 rounded-lg text-white text-xs font-[inherit] outline-none" />
                  <button onClick={createChild} disabled={addingChild || !newChildTitle.trim()}
                    className={`px-3.5 py-2 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs font-[inherit] flex items-center gap-1 ${
                      addingChild ? 'bg-white/[0.04]' : 'bg-cyan-500/15'
                    } ${newChildTitle.trim() ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    {addingChild ? <Loader2 size={12} /> : <Check size={12} />}
                  </button>
                </div>
              )}

              {activeTasks.map((t) => (
                <div key={t.id} onClick={() => toggleTask(t.id, t.status)}
                  className="flex items-center gap-2 px-2.5 py-2 bg-white/[0.02] border border-white/[0.06] rounded-md mb-1 cursor-pointer">
                  <Circle size={16} className="text-white/30 shrink-0" />
                  <span className="flex-1 text-xs text-white">{t.title}</span>
                  {t.priority && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">{t.priority}</span>}
                  {t.due_date && <span className="text-[10px] text-white/30">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                </div>
              ))}

              {doneTasks.length > 0 && (
                <details className="mt-1.5">
                  <summary className="text-[11px] text-white/30 cursor-pointer py-1">✓ {doneTasks.length} completed</summary>
                  {doneTasks.map((t) => (
                    <div key={t.id} onClick={() => toggleTask(t.id, t.status)}
                      className="flex items-center gap-2 px-2.5 py-1.5 opacity-50 cursor-pointer">
                      <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                      <span className="flex-1 text-xs line-through">{t.title}</span>
                    </div>
                  ))}
                </details>
              )}

              {linkedTasks.length === 0 && !showAddChild && (
                <p className="text-xs text-white/30 italic my-2">No tasks yet — click Add above</p>
              )}
            </>
          )}

          {/* ═══ PROGRESS TAB ═══ */}
          {activeTab === 'progress' && (
            <>
              {/* Progress ring */}
              <div className="nd-progress-section">
                <svg width={96} height={96} className="nd-progress-ring shrink-0">
                  <circle cx={48} cy={48} r={40} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                  <circle cx={48} cy={48} r={40} fill="none" stroke={color} strokeWidth={6}
                    strokeDasharray={251} strokeDashoffset={251 - (pct / 100) * 251}
                    strokeLinecap="round" transform="rotate(-90 48 48)" />
                  <text x={48} y={48} textAnchor="middle" dy="0.35em" fill="#fff" fontSize={20} fontWeight="700">{pct}%</text>
                </svg>
                <div className="nd-progress-controls">
                  <div className="text-[13px] text-white font-semibold mb-1.5">Overall Progress</div>
                  <div className="h-2.5 bg-white/[0.06] rounded-md overflow-hidden mb-2">
                    <div className="h-full rounded-md transition-[width] duration-400" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  {node?.budget_allocated && (
                    <div className="mb-2">
                      <div className="text-[11px] text-white/50 mb-1">
                        Budget: ${budgetSpent.toFixed(0)} / ${node.budget_allocated.toFixed(0)}
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-[width] duration-400" style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetBarColor }} />
                      </div>
                    </div>
                  )}

                  {node?.estimated_hours && (
                    <div>
                      <div className="text-[11px] text-white/50 mb-1">
                        Time: {actualHours}h / {node.estimated_hours}h
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-[width] duration-400" style={{ width: `${Math.min(timePct, 100)}%`, background: timeBarColor }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Children overview (objectives & epics) */}
              {(cat === 'objective' || cat === 'epic') && children.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-white/50 mb-2">{childLabel} Progress</div>
                  {children.map((child) => {
                    const cpct = Math.round((child.progress || 0) * 100);
                    return (
                      <div key={child.id} onClick={() => onNavigate?.(child.id)}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-1.5 cursor-pointer transition-colors duration-200 hover:bg-white/[0.04]">
                        <span><EmojiIcon emoji={child.icon || '🎯'} size={18} fallbackAsText /></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-white font-medium overflow-hidden text-ellipsis whitespace-nowrap">{child.title}</div>
                          <div className="h-1 bg-white/[0.06] rounded-sm mt-1.5 overflow-hidden">
                            <div className="h-full rounded-sm transition-[width] duration-400" style={{ width: `${cpct}%`, background: child.color || color }} />
                          </div>
                        </div>
                        <span className="text-[11px] text-white/40 shrink-0">{cpct}%</span>
                        <ChevronRight size={14} className="opacity-30 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Status controls */}
              <Section title="Status & Priority" icon={<Target size={14} />} isOpen={sectionsOpen.statusPriority} onToggle={() => toggleSection('statusPriority')}>
                <div className="flex flex-col gap-3">
                  <Field label="Status">
                    <select value={node?.status || 'active'} onChange={e => saveField('status', e.target.value)} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="paused">Paused</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select value={node?.priority || 'medium'} onChange={e => saveField('priority', e.target.value)} className={inputClass}>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </Field>
                </div>
              </Section>
            </>
          )}

          {/* ═══ RESOURCES TAB ═══ */}
          {activeTab === 'resources' && (
            <>
              {/* Budget & Finance (goals with budget) */}
              {cat === 'goal' && goalBudget && (
                <Section title="Budget & Finance" icon={<Wallet size={14} />} isOpen={true} onToggle={() => {}} accent="#FACC15">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Allocated</span>
                      <span className="text-sm font-semibold text-white">${goalBudget.allocated.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Spent</span>
                      <span className="text-sm font-semibold text-rose-400">${goalBudget.spent.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Remaining</span>
                      <span className="text-sm font-semibold text-green-400">${goalBudget.remaining.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-md overflow-hidden">
                      <div className="h-full rounded-md transition-[width] duration-400" style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetBarColor }} />
                    </div>
                    {relatedExpenses.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] text-white/50 mb-2">Recent Expenses</div>
                        {relatedExpenses.map(exp => (
                          <div key={exp.id} className="flex items-center justify-between text-xs text-white/70 mb-1">
                            <span>{exp.description}</span>
                            <span className="text-rose-400">${exp.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Financial (objectives & epics) */}
              {cat !== 'goal' && (
                <Section title="Financial" icon={<DollarSign size={14} />} isOpen={true} onToggle={() => {}} accent="#FACC15">
                  <div className="flex flex-col gap-3">
                    <Field label="Budget Allocated">
                      <input type="number" step="0.01" value={node?.budget_allocated || ''} onChange={e => saveField('budget_allocated', parseFloat(e.target.value) || null)}
                        placeholder="0.00" className={inputClass} />
                    </Field>
                    <Field label="Budget Spent (computed)">
                      <div className="text-[13px] text-white font-semibold">${budgetSpent.toFixed(2)}</div>
                    </Field>
                    <Field label="Financial Type">
                      <select value={node?.financial_type || ''} onChange={e => saveField('financial_type', e.target.value || null)} className={inputClass}>
                        <option value="">Select...</option>
                        <option value="investment">Investment</option>
                        <option value="cost_center">Cost Center</option>
                        <option value="revenue_goal">Revenue Goal</option>
                      </select>
                    </Field>
                    {(node?.financial_type === 'investment' || node?.financial_type === 'revenue_goal') && (
                      <Field label="Expected Return">
                        <input type="number" step="0.01" value={node?.expected_return || ''} onChange={e => saveField('expected_return', parseFloat(e.target.value) || null)}
                          placeholder="0.00" className={inputClass} />
                      </Field>
                    )}
                    <Field label="Linked Business">
                      <select value={node?.business_id || ''} onChange={e => saveField('business_id', e.target.value || null)} className={inputClass}>
                        <option value="">None</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </Field>
                  </div>
                </Section>
              )}

              {/* Resources Needed */}
              <Section title="Resources Needed" icon="📦" isOpen={true} onToggle={() => {}} accent="#A855F7">
                <div className="flex flex-col gap-2">
                  {resources.map((res, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2 bg-white/[0.02] rounded-md">
                      <input value={res.name} onChange={e => {
                        const updated = [...resources]; updated[i].name = e.target.value; saveResources(updated);
                      }} placeholder="Resource name" className={`${inputClass} flex-[2]`} />
                      <input type="number" step="0.01" value={res.cost} onChange={e => {
                        const updated = [...resources]; updated[i].cost = parseFloat(e.target.value) || 0; saveResources(updated);
                      }} placeholder="Cost" className={`${inputClass} w-20`} />
                      <select value={res.status} onChange={e => {
                        const updated = [...resources]; updated[i].status = e.target.value; saveResources(updated);
                      }} className={`${inputClass} w-[100px]`}>
                        <option value="needed">Needed</option>
                        <option value="acquired">Acquired</option>
                        <option value="na">N/A</option>
                      </select>
                      <button onClick={() => {
                        saveResources(resources.filter((_, idx) => idx !== i));
                      }} className="bg-rose-500/15 border border-rose-500/30 rounded-md px-2 py-1 cursor-pointer text-rose-500 text-[11px]">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newResource.name} onChange={e => setNewResource({ ...newResource, name: e.target.value })}
                      placeholder="Resource name..." className={`${inputClass} flex-[2]`} />
                    <input type="number" step="0.01" value={newResource.cost} onChange={e => setNewResource({ ...newResource, cost: parseFloat(e.target.value) || 0 })}
                      placeholder="Cost" className={`${inputClass} w-20`} />
                    <button onClick={() => {
                      if (newResource.name.trim()) {
                        saveResources([...resources, { ...newResource, name: newResource.name.trim() }]);
                        setNewResource({ name: '', cost: 0, status: 'needed' });
                      }
                    }} disabled={!newResource.name.trim()}
                      className={`px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-md text-cyan-400 text-xs ${newResource.name.trim() ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                      Add
                    </button>
                  </div>
                  {resources.length > 0 && (
                    <div className="text-xs text-purple-400 font-semibold mt-1">
                      Total estimated: ${resources.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(2)}
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          </div>{/* end nd-tab-content */}

          {/* ASK AI */}
          <div className="nd-zeroclaw-bar" onClick={handleZeroClawClick}>
            <MessageCircle size={18} />
            <span>Ask AI about this goal</span>
            <ChevronRight size={16} className="opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ── Helper Components ─────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  accent?: string;
  children: React.ReactNode;
}

function Section({ title, icon, isOpen, onToggle, accent, children }: SectionProps) {
  return (
    <div className="nd-section">
      <div onClick={onToggle} className="nd-section-header" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
        <h3 style={accent ? { color: accent } : undefined}>
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h3>
        {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </div>
      {isOpen && <div className="nd-section-content">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="text-[11px] text-white/50 mb-1">{label}</div>
      {children}
    </div>
  );
}

const inputClass = 'px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded-md text-white text-xs font-[inherit] outline-none w-full';
