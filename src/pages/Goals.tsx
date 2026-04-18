import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/data-access';
import { useUserStore } from '../stores/useUserStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { recalcProgression } from '../lib/progression';
import { showToast } from '../components/Toast';
import { useGamificationContext } from '../lib/gamification/context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Plus, Target, Calendar, ChevronDown, ChevronRight, X, Loader2, RefreshCw, Check, Pencil, TreePine, List, Layers, Zap, CheckSquare, Circle, CheckCircle2, Trash2, Info, Flag, AlertTriangle, Wallet, TrendingUp, TrendingDown, GripVertical, MoreHorizontal, Copy, Archive, ArrowRight, Users, Ban, Clock } from 'lucide-react';
import { Confetti } from '../components/Confetti';
import { EmojiIcon } from '../lib/emoji-icon';
import { MiniChart } from '../components/MiniChart';
import { VisionTree } from '../components/VisionTree';
import { NodeDetail } from '../components/NodeDetail';
import { SpotlightTour } from '../components/SpotlightTour';
import { EmptyState } from '../components/EmptyState';
import { TaskDetail } from '../components/TaskDetail';
import { PartnerGoals } from '../components/PartnerGoals';
import { GoalCoachCard } from '../components/goals/GoalCoachCard';
import { GoalTaskGenerator } from '../components/goals/GoalTaskGenerator';
import { FuturePlanningPanel } from '../components/goals/FuturePlanningPanel';
import { NLPDecomposer } from '../components/goals/NLPDecomposer';

import { getPartners } from '../lib/social/partnerships';
import type { PartnerWithProfile } from '../lib/social/types';
import type { GoalNode as GoalNodeType, GoalTask as GoalTaskType, GoalView } from '../components/goals/types';
import { getCountdown, calcProgress, calculateVelocity, projectCompletionDate, ICONS, COLORS, PRIORITY_COLORS, LEVEL_COLORS, STATUS_CYCLE, STATUS_ICONS } from '../components/goals/utils';
import './Goals.css';
import { safeScrollIntoView } from '../utils/scroll';
import { GoalsSkeleton } from '../components/skeletons';

// ── Types & Constants ──
// (Now imported from ./components/goals/)
type GoalNode = GoalNodeType;
type GoalTask = GoalTaskType;

export function Goals() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Record<string, GoalTask[]>>({});

  // Accountability Partner tab state
  const [viewTab, setViewTab] = useState<'my' | 'partner'>('my');
  const [partners, setPartners] = useState<PartnerWithProfile[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerWithProfile | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#00D4FF');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editDescVal, setEditDescVal] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDateVal, setEditDateVal] = useState('');
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [newLinkedTask, setNewLinkedTask] = useState<string | null>(null);
  const [newLinkedTaskTitle, setNewLinkedTaskTitle] = useState('');
  const [creatingLinkedTask, setCreatingLinkedTask] = useState(false);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  const [taskChartData, setTaskChartData] = useState<Record<string, { data: number[]; labels: string[] }>>({});
  const [viewMode, setViewMode] = useState<'list' | 'tree' | 'planning'>('tree');
  const [createCategory, setCreateCategory] = useState<string>('goal');
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState<string>('medium');
  const [cascadeObjective, setCascadeObjective] = useState<string>('');
  const [cascadeEpic, setCascadeEpic] = useState<string>('');
  // Enhanced creation fields
  const [createDomain, setCreateDomain] = useState<string>('');
  const [createPriority, setCreatePriority] = useState<string>('medium');
  const [createBudget, setCreateBudget] = useState<string>('');
  const [createBusinessId, setCreateBusinessId] = useState<string>('');
  const [createDesc, setCreateDesc] = useState<string>('');
  const [createHours, setCreateHours] = useState<string>('');
  const [createDeadlineType, setCreateDeadlineType] = useState<string>('soft');
  const [createSuccessCriteria, setCreateSuccessCriteria] = useState<string>('');
  const [createFinType, setCreateFinType] = useState<string>('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [allTaskCounts, setAllTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNLPDecomposer, setShowNLPDecomposer] = useState(false);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [allTasks, setAllTasks] = useState<GoalTask[]>([]);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [celebrateGoalId, setCelebrateGoalId] = useState<string | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below' | null>(null);

  // Context menu
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Swipe state
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swiping = useRef(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });

  const confirmDelete = (title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    if (contextMenuId) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenuId]);

  const fetchGoals = async (isRefresh = false) => {
    // Only show loading spinner on initial load, not on refreshes
    // Refreshes should update data silently to avoid closing open panels
    if (!isRefresh) setLoading(true);
    await Promise.all([
      useGoalsStore.getState().fetchAll(),
      useScheduleStore.getState().fetchAll(),
    ]);
    setGoals(useGoalsStore.getState().goals as unknown as GoalNode[]);
    setAllTasks(useScheduleStore.getState().tasks as unknown as GoalTask[]);
    if (!isRefresh) setLoading(false);
  };

  const getHierarchy = useCallback((goalId: string | null): { id: string; title: string; icon: string; category: string }[] => {
    const chain: { id: string; title: string; icon: string; category: string }[] = [];
    let current = goalId;
    while (current) {
      const g = goals.find(x => x.id === current);
      if (!g) break;
      chain.unshift({ id: g.id, title: g.title, icon: g.icon || '🎯', category: g.category || 'goal' });
      current = g.parent_goal_id;
    }
    return chain;
  }, [goals]);

  useEffect(() => {
    fetchGoals().then(() => {
      setBusinesses(useGoalsStore.getState().businesses);
    });

    // Fetch accountability partners
    if (user?.id) {
      getPartners(user.id).then(p => {
        setPartners(p);
        if (p.length > 0 && !selectedPartner) {
          setSelectedPartner(p[0]);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    const handler = () => fetchGoals(true);
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, []);

  // Deep-link: ?node=<id>
  useEffect(() => {
    const nodeId = searchParams.get('node');
    if (!nodeId || goals.length === 0) return;
    const expandPath = new Set<string>();
    let current: GoalNode | undefined = goals.find((g: GoalNode) => g.id === nodeId);
    while (current) {
      expandPath.add(current.id);
      current = current.parent_goal_id ? goals.find((g: GoalNode) => g.id === current!.parent_goal_id) : undefined;
    }
    if (expandPath.size > 0) {
      setExpandedIds(prev => new Set([...prev, ...expandPath]));
      setHighlightedNodeId(nodeId);
      setTimeout(() => {
        const el = document.querySelector(`[data-goal-id="${nodeId}"]`) as HTMLElement;
        if (el) safeScrollIntoView(el, { behavior: 'smooth', block: 'center' });
      }, 300);
      setSearchParams({}, { replace: true });
      setTimeout(() => setHighlightedNodeId(null), 3000);
    }
  }, [searchParams, goals]);

  const resetCreateForm = () => {
    setTitle(''); setIcon('🎯'); setColor('#00D4FF'); setTargetDate('');
    setCreateDomain(''); setCreatePriority('medium'); setCreateBudget('');
    setCreateBusinessId(''); setCreateDesc(''); setCreateHours('');
    setCreateDeadlineType('soft'); setCreateSuccessCriteria(''); setCreateFinType('');
    setCreateParent(null); setCascadeObjective(''); setCascadeEpic('');
  };

  const createGoal = async () => {
    if (!title.trim()) { showToast('Enter a goal name', undefined, '#F97316'); return; }
    setSaving(true);
    const defaultIcon = createCategory === 'objective' ? '🎯' : createCategory === 'epic' ? '⚡' : '🏁';
    const defaultColor = createCategory === 'objective' ? '#00D4FF' : createCategory === 'epic' ? '#FACC15' : '#39FF14';
    const row: Record<string, unknown> = {
      user_id: user?.id,
      title: title.trim(),
      icon: icon || defaultIcon,
      color: color || defaultColor,
      status: 'active',
      progress: 0,
      sort_order: goals.length,
      category: createCategory,
      parent_goal_id: createParent,
      priority: createPriority || 'medium',
    };
    if (targetDate) row.target_date = targetDate;
    if (createDomain) row.domain = createDomain;
    if (createBudget && parseFloat(createBudget) > 0) row.budget_allocated = parseFloat(createBudget);
    if (createBusinessId) row.business_id = createBusinessId;
    if (createDesc.trim()) row.description = createDesc.trim();
    if (createHours && parseInt(createHours) > 0) row.estimated_hours = parseInt(createHours);
    if (createDeadlineType !== 'soft') row.deadline_type = createDeadlineType;
    if (createSuccessCriteria.trim()) row.success_criteria = createSuccessCriteria.trim();
    if (createFinType) row.financial_type = createFinType;

    const newId = await useGoalsStore.getState().createGoal(row as Record<string, unknown>);
    if (newId) {
      resetCreateForm();
      setShowForm(false);
      fetchGoals();
    }
    setSaving(false);
  };

  const createTask = async () => {
    if (!title.trim()) { showToast('Enter a task name', undefined, '#F97316'); return; }
    setSaving(true);
    const ok = await useScheduleStore.getState().createTask(user?.id || '', title.trim(), newTaskPriority, {
      due_date: targetDate || null,
      goal_id: createParent || null,
    });
    if (ok) {
      resetCreateForm(); setNewTaskPriority('medium');
      setShowForm(false);
      fetchGoals();
    }
    setSaving(false);
  };

  const updateProgress = async (id: string, progress: number) => {
    const finalProgress = Math.min(1, Math.max(0, progress));
    await useGoalsStore.getState().updateGoal(id, { progress: finalProgress });
    if (finalProgress >= 1) {
      setCelebrateGoalId(id);
      showToast('Goal completed! 🎉', '🏆', '#39FF14');
      setTimeout(() => setCelebrateGoalId(null), 3000);
    }
    fetchGoals();
  };

  const getAllDescendants = (parentId: string, allGoals: GoalNode[]): GoalNode[] => {
    const children = allGoals.filter(g => g.parent_goal_id === parentId);
    return children.flatMap(c => [c, ...getAllDescendants(c.id, allGoals)]);
  };

  const deleteGoal = async (id: string) => {
    const descendants = getAllDescendants(id, goals);
    const allIds = [id, ...descendants.map(d => d.id)];

    // Delete goals through store (optimistic + sync)
    for (const goalId of allIds) {
      await useGoalsStore.getState().deleteGoal(goalId);
    }
    // Delete linked tasks through store
    const linkedTasks = useScheduleStore.getState().tasks.filter(t => t.goal_id && allIds.includes(t.goal_id));
    for (const task of linkedTasks) {
      await useScheduleStore.getState().deleteTask(task.id);
    }

    setConfirmAction(null);
    fetchGoals(true);
  };

  const cycleStatus = async (id: string, currentStatus: string) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus as string);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'done') {
      updates.progress = 1;
      setCelebrateGoalId(id);
      showToast('Goal completed! 🎉', '🏆', '#39FF14');
      setTimeout(() => setCelebrateGoalId(null), 3000);
      const goal = goals.find(g => g.id === id);
      awardXP('goal_complete', { description: `Goal completed: ${goal?.title || 'Goal'}` });
    }
    await useGoalsStore.getState().updateGoal(id, updates as any);
    fetchGoals();
  };

  const duplicateGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const newId = await useGoalsStore.getState().createGoal({
      user_id: user?.id,
      title: `${goal.title} (copy)`,
      icon: goal.icon,
      color: goal.color,
      status: 'active',
      progress: 0,
      sort_order: goals.length,
      category: goal.category,
      parent_goal_id: goal.parent_goal_id,
      priority: goal.priority,
      description: goal.description,
      target_date: goal.target_date,
    });
    if (newId) {
      showToast('Duplicated!', '📋', '#00D4FF');
      fetchGoals();
    }
    setContextMenuId(null);
  };

  const archiveGoal = async (goalId: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { status: 'archived' });
    showToast('Archived', '📦', '#5A7A9A');
    fetchGoals();
    setContextMenuId(null);
  };

  // ── Drag & Drop ──
  const handleDragStart = (e: React.DragEvent, goalId: string) => {
    setDragId(goalId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', goalId);
    (e.target as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    setDragId(null);
    setDragOverId(null);
    setDragPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, goalId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOverId(goalId);
    setDragPosition(e.clientY < midY ? 'above' : 'below');
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      setDragPosition(null);
      return;
    }
    const draggedGoal = goals.find(g => g.id === dragId);
    const targetGoal = goals.find(g => g.id === targetId);
    if (!draggedGoal || !targetGoal) return;
    // Only reorder within the same parent level
    if (draggedGoal.parent_goal_id !== targetGoal.parent_goal_id) {
      setDragId(null);
      setDragOverId(null);
      setDragPosition(null);
      return;
    }
    const siblings = goals
      .filter(g => g.parent_goal_id === targetGoal.parent_goal_id && g.category === targetGoal.category)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const filtered = siblings.filter(g => g.id !== dragId);
    const targetIdx = filtered.findIndex(g => g.id === targetId);
    const insertIdx = dragPosition === 'above' ? targetIdx : targetIdx + 1;
    filtered.splice(insertIdx, 0, draggedGoal);
    // Update sort orders via store
    const updates = filtered.map((g, i) => ({ id: g.id, sort_order: i }));
    for (const u of updates) {
      await useGoalsStore.getState().updateGoal(u.id, { sort_order: u.sort_order });
    }
    setDragId(null);
    setDragOverId(null);
    setDragPosition(null);
    fetchGoals();
  };

  // ── Touch swipe ──
  const handleTouchStart = (e: React.TouchEvent, goalId: string) => {
    const touch = e.touches[0];
    swipeStartX.current = touch.clientX;
    swipeStartY.current = touch.clientY;
    swiping.current = false;
    setSwipeId(goalId);
    setSwipeX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeId) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeStartX.current;
    const dy = touch.clientY - swipeStartY.current;
    // Only swipe horizontally if movement is mostly horizontal
    if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swiping.current = true;
    }
    if (swiping.current && dx < 0) {
      setSwipeX(Math.max(dx, -120));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX < -80 && swipeId) {
      // Trigger delete confirm
      const goal = goals.find(g => g.id === swipeId);
      if (goal) {
        const childCount = getAllDescendants(swipeId!, goals).length;
        const msg = childCount > 0
          ? `This will also delete ${childCount} sub-item${childCount > 1 ? 's' : ''} and their tasks.`
          : 'This will permanently remove this item.';
        confirmDelete(`Delete ${goal.title}?`, msg, () => deleteGoal(swipeId!));
      }
    }
    setSwipeId(null);
    setSwipeX(0);
    swiping.current = false;
  };

  // ── Context Menu ──
  const handleContextMenu = (e: React.MouseEvent, goalId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuId(goalId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const fetchTaskChartData = useCallback(async (goalId: string) => {
    const days: { date: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().split('T')[0], label: d.toLocaleDateString('en', { weekday: 'short' }) });
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // Read from schedule store instead of direct Supabase query
    const storeTasks = useScheduleStore.getState().tasks.filter(t =>
      t.goal_id === goalId && !t.is_deleted && t.status === 'done' &&
      t.completed_at && t.completed_at >= sevenDaysAgo.toISOString()
    );
    const counts = days.map(day => ({
      ...day,
      count: storeTasks.filter(t => t.completed_at?.startsWith(day.date)).length,
    }));
    setTaskChartData(prev => ({ ...prev, [goalId]: { data: counts.map(c => c.count), labels: counts.map(c => c.label) } }));
  }, []);

  const toggleExpand = async (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      if (!linkedTasks[id]) {
        // Read from schedule store instead of direct Supabase query
        const storeTasks = useScheduleStore.getState().tasks;
        const goalTasks = storeTasks
          .filter(t => t.goal_id === id && !t.is_deleted)
          .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        setLinkedTasks(prev => ({ ...prev, [id]: goalTasks as unknown as GoalTask[] }));
        if (goalTasks.length > 0) {
          setAllTasks(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newTasks = (goalTasks as unknown as GoalTask[]).filter(t => !existingIds.has(t.id));
            return newTasks.length > 0 ? [...prev, ...newTasks] : prev;
          });
        }
      }
      fetchTaskChartData(id);
    }
    setExpandedIds(newExpanded);
    setEditingTitle(null);
    setEditingDesc(null);
    setEditingDate(null);
    setShowIconPicker(null);
    setShowColorPicker(null);
    setNewLinkedTask(null);
  };

  // ── Inline editing handlers ──
  const saveTitle = async (goalId: string) => {
    if (!editTitleVal.trim()) { setEditingTitle(null); return; }
    await useGoalsStore.getState().updateGoal(goalId, { title: editTitleVal.trim() });
    setEditingTitle(null);
    fetchGoals();
  };

  const saveDescription = async (goalId: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { description: editDescVal.trim() || null });
    setEditingDesc(null);
    fetchGoals();
  };

  const saveDate = async (goalId: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { target_date: editDateVal || null });
    setEditingDate(null);
    fetchGoals();
  };

  const saveIcon = async (goalId: string, newIcon: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { icon: newIcon });
    setShowIconPicker(null);
    fetchGoals();
  };

  const saveColor = async (goalId: string, newColor: string) => {
    await useGoalsStore.getState().updateGoal(goalId, { color: newColor });
    setShowColorPicker(null);
    fetchGoals();
  };

  const recalcProgressFromTasks = async (goalId: string) => {
    setRecalculating(goalId);
    // Read tasks from store instead of direct Supabase query
    const storeTasks = useScheduleStore.getState().tasks.filter(t => t.goal_id === goalId && !t.is_deleted);
    if (storeTasks.length > 0) {
      const done = storeTasks.filter(t => t.status === 'done').length;
      const progress = done / storeTasks.length;
      await useGoalsStore.getState().updateGoal(goalId, { progress });
    }
    setRecalculating(null);
    fetchGoals();
    // Refresh linked tasks from store
    const refreshedTasks = useScheduleStore.getState().tasks
      .filter(t => t.goal_id === goalId && !t.is_deleted)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
  };

  const createLinkedTask = async (goalId: string) => {
    if (!newLinkedTaskTitle.trim()) return;
    setCreatingLinkedTask(true);
    const parentGoal = goals.find(g => g.id === goalId);
    const dueDate = parentGoal?.target_date || new Date().toISOString().split('T')[0];
    const ok = await useScheduleStore.getState().createTask(user?.id || '', newLinkedTaskTitle.trim(), 'medium', {
      goal_id: goalId,
      due_date: dueDate,
    });
    if (ok) {
      setNewLinkedTaskTitle('');
      setNewLinkedTask(null);
      // Refresh from store after create
      const refreshedTasks = useScheduleStore.getState().tasks
        .filter(t => t.goal_id === goalId && !t.is_deleted)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
      fetchTaskChartData(goalId);
      fetchGoals();
      window.dispatchEvent(new Event('lifeos-refresh'));
    }
    setCreatingLinkedTask(false);
  };

  const toggleLinkedTask = async (taskId: string, currentStatus: string, goalId: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await useScheduleStore.getState().updateTask(taskId, {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });
    if (newStatus === 'done') {
      const task = linkedTasks[goalId]?.find(t => t.id === taskId);
      awardXP('task_complete', { description: `Task completed: ${task?.title || 'Task'}` });
    }
    const { milestones } = await recalcProgression(goalId, supabase);
    if (milestones.length > 0) {
      milestones.forEach(m => showToast(`${m.title} completed!`, '🎉', m.color));
    }
    // Refresh linked tasks from store
    const refreshedTasks = useScheduleStore.getState().tasks
      .filter(t => t.goal_id === goalId && !t.is_deleted)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
    fetchGoals();
  };

  const deleteTask = async (taskId: string, goalId?: string | null) => {
    await useScheduleStore.getState().deleteTask(taskId);
    setConfirmAction(null);
    if (goalId) {
      // Refresh linked tasks from store
      const refreshedTasks = useScheduleStore.getState().tasks
        .filter(t => t.goal_id === goalId && !t.is_deleted)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      setLinkedTasks(prev => ({ ...prev, [goalId]: refreshedTasks as unknown as GoalTask[] }));
    }
    fetchGoals();
  };

  const fetchAllTaskCounts = () => {
    // Use local allTasks (from schedule store) for consistency with local-first approach
    // This avoids RLS user_id mismatch when data was created locally
    const tasks = useScheduleStore.getState().tasks;
    const counts: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.goal_id || t.is_deleted) continue;
      if (!counts[t.goal_id]) counts[t.goal_id] = { total: 0, done: 0 };
      counts[t.goal_id].total++;
      if (t.status === 'done') counts[t.goal_id].done++;
    }
    setAllTaskCounts(counts);
  };

  useEffect(() => { fetchAllTaskCounts(); }, [viewMode, allTasks]);

  const handleCreateNode = (parentId: string | null, category: string) => {
    setCreateParent(parentId);
    setCreateCategory(category);
    setShowForm(true);
  };

  const handleMoveGoal = async (goalId: string, newParentId: string | null) => {
    await useGoalsStore.getState().updateGoal(goalId, { parent_goal_id: newParentId, category: 'goal' });
    fetchGoals();
    fetchAllTaskCounts();
  };

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active' || g.status === 'in_progress'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => (g.progress || 0) >= 1), [goals]);
  const overallProgress = useMemo(() => goals.length > 0 ? goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length : 0, [goals]);

  // Time filter helpers
  const getTimeRange = (filter: string): { start: string; end: string } | null => {
    if (filter === 'all') return null;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const q = Math.floor(m / 3);
    if (filter === 'thisMonth') return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: `${y}-${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}-01` };
    if (filter === 'thisQuarter') return { start: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, end: `${y}-${String(q * 3 + 4 > 12 ? q * 3 + 4 - 12 : q * 3 + 4).padStart(2, '0')}-01` };
    if (filter === 'nextQuarter') { const nq = q + 1; const ny = nq > 3 ? y + 1 : y; const nqm = (nq % 4) * 3; return { start: `${ny}-${String(nqm + 1).padStart(2, '0')}-01`, end: `${ny}-${String(nqm + 4 > 12 ? nqm + 4 - 12 : nqm + 4).padStart(2, '0')}-01` }; }
    if (filter === 'thisYear') return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
    return null;
  };

  const timeRange = getTimeRange(timeFilter);
  const filteredGoals = useMemo(() => {
    if (!timeRange) return goals;
    return goals.filter(g => {
      const td = g.target_date;
      if (!td) return false;
      return td >= timeRange.start && td < timeRange.end;
    });
  }, [goals, timeRange]);
  const filteredTasks = useMemo(() => {
    if (!timeRange) return allTasks;
    return allTasks.filter(t => {
      const dd = t.due_date;
      if (!dd) return false;
      return dd >= timeRange.start && dd < timeRange.end;
    });
  }, [allTasks, timeRange]);

  const displayGoals: GoalNode[] = timeRange ? filteredGoals : goals;
  const displayTasks: GoalTask[] = timeRange ? filteredTasks : allTasks;

  const timeFilteredFinancials = useMemo(() => {
    const fg = timeRange ? filteredGoals : goals;
    const ft = timeRange ? filteredTasks : allTasks;
    const totalBudget = fg.reduce((s: number, g: GoalNode) => s + (g.budget_allocated || 0), 0);
    const taskExpenses = ft.filter((t: GoalTask) => t.financial_type === 'expense').reduce((s: number, t: GoalTask) => s + (t.financial_amount || 0), 0);
    const taskIncome = ft.filter((t: GoalTask) => t.financial_type === 'income').reduce((s: number, t: GoalTask) => s + (t.financial_amount || 0), 0);
    return { totalBudget, taskExpenses, taskIncome, net: taskIncome - taskExpenses };
  }, [filteredGoals, filteredTasks, goals, allTasks, timeRange]);

  // ── Progress Bar with Milestones ──
  const ProgressBar = ({ pct, color, size = 'normal' }: { pct: number; color: string; size?: 'normal' | 'small' }) => {
    const height = size === 'small' ? 4 : 6;
    const progressGradient = pct >= 100
      ? `linear-gradient(90deg, ${color}, #39FF14)`
      : pct >= 75
        ? `linear-gradient(90deg, ${color}, ${color}dd)`
        : color;
    return (
      <div className="g-progress-bar" style={{ height }}>
        <div
          className="g-progress-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: progressGradient }}
        />
        {size === 'normal' && (
          <>
            <div className="g-milestone" style={{ left: '25%' }} data-reached={pct >= 25} />
            <div className="g-milestone" style={{ left: '50%' }} data-reached={pct >= 50} />
            <div className="g-milestone" style={{ left: '75%' }} data-reached={pct >= 75} />
          </>
        )}
      </div>
    );
  };

  // ── Recursive Tree Renderer ──
  const renderTreeNode = (g: GoalNode, depth: number = 0, isLast: boolean = false, parentPath: boolean[] = []) => {
    const cat = g.category || 'goal';
    const computedProgress = calcProgress(g, goals, allTasks);
    const pct = Math.round(computedProgress * 100);
    const expanded = expandedIds.has(g.id);
    const tasks = allTasks.filter(t => t.goal_id === g.id);
    const doneTasks = tasks.filter(t => t.status === 'done');
    const activeTasks = tasks.filter(t => t.status !== 'done');
    const children = goals.filter(c => c.parent_goal_id === g.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const hasExpandable = children.length > 0 || tasks.length > 0;
    const levelColor = LEVEL_COLORS[cat] || '#00D4FF';
    const priorityColor = g.priority ? PRIORITY_COLORS[g.priority] : null;
    const countdown = getCountdown(g.target_date);
    const nextChildCategory = cat === 'objective' ? 'epic' : cat === 'epic' ? 'goal' : null;
    const statusInfo = STATUS_ICONS[g.status] || STATUS_ICONS.active;
    const isDragOver = dragOverId === g.id;
    const isSwipedOpen = swipeId === g.id && swipeX < -30;

    return (
      <div
        key={g.id}
        data-goal-id={g.id}
        className={`gt-node-wrap depth-${depth}`}
      >
        {/* Tree connector lines */}
        {depth > 0 && (
          <div className="gt-connectors">
            {parentPath.map((showLine, i) => (
              <div key={i} className={`gt-vline ${showLine ? 'active' : ''}`} style={{ left: `${i * 28 + 14}px` }} />
            ))}
            <div
              className="gt-hline"
              style={{ left: `${(depth - 1) * 28 + 14}px`, width: '14px', top: '24px' }}
            />
            <div
              className={`gt-elbow ${isLast ? 'last' : ''}`}
              style={{ left: `${(depth - 1) * 28 + 14}px` }}
            />
          </div>
        )}

        {/* Drop indicator above */}
        {isDragOver && dragPosition === 'above' && <div className="gt-drop-indicator" />}

        <div
          className={`gt-card cat-${cat}${expanded ? ' expanded' : ''}${highlightedNodeId === g.id ? ' highlighted' : ''}${celebrateGoalId === g.id ? ' celebrating' : ''}${dragId === g.id ? ' dragging' : ''}`}
          style={{
            '--level-color': levelColor,
            '--g-color': g.color || levelColor,
            '--progress-pct': `${pct}%`,
            marginLeft: `${depth * 28}px`,
            transform: isSwipedOpen ? `translateX(${swipeX}px)` : undefined,
            borderLeft: priorityColor ? `3px solid ${priorityColor}` : undefined,
            /* priority text label added below via gt-priority-label */
          } as React.CSSProperties}
          draggable
          onDragStart={(e) => handleDragStart(e, g.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, g.id)}
          onDrop={(e) => handleDrop(e, g.id)}
          onTouchStart={(e) => handleTouchStart(e, g.id)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => handleContextMenu(e, g.id)}
        >
          {/* Swipe delete background */}
          <div className="gt-swipe-bg">
            <Trash2 size={18} />
            <span>Delete</span>
          </div>

          <div className="gt-card-inner">
            {/* Status cycle button */}
            <button
              className="gt-status-btn"
              onClick={(e) => { e.stopPropagation(); cycleStatus(g.id, g.status); }}
              style={{ color: statusInfo.color }}
              title={`Status: ${g.status} (tap to cycle)`}
            >
              {statusInfo.icon}
            </button>

            {/* Drag handle */}
            <GripVertical size={14} className="gt-drag-handle" />

            {/* Icon */}
            <div className="gt-icon-wrap" onClick={(e) => { e.stopPropagation(); setDetailNodeId(g.id); }} style={{ cursor: 'pointer' }}>
              <span className="gt-icon"><EmojiIcon emoji={g.icon || '🎯'} size={24} fallbackAsText /></span>
            </div>

            {/* Content */}
            <div className="gt-content" onClick={() => { if (hasExpandable) toggleExpand(g.id); }}>
              <div className="gt-title-row">
                {editingTitle === g.id ? (
                  <input
                    className="gt-inline-input"
                    value={editTitleVal}
                    onChange={e => setEditTitleVal(e.target.value)}
                    onBlur={() => saveTitle(g.id)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(g.id); if (e.key === 'Escape') setEditingTitle(null); }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    className="gt-title"
                    onClick={e => { e.stopPropagation(); setEditingTitle(g.id); setEditTitleVal(g.title); }}
                    title="Click to edit"
                  >
                    {g.title}
                  </span>
                )}
                <span className={`gt-cat-badge cat-${cat}`}>
                  {cat === 'objective' ? '🎯' : cat === 'epic' ? '⚡' : '🏁'}
                  <span>{cat}</span>
                </span>
              </div>

              <ProgressBar pct={pct} color={g.color || levelColor} />

              <div className="gt-meta">
                <span className="gt-pct" style={{ color: g.color || levelColor }}>{pct}%</span>
                {g.priority && (
                  <span className="gt-priority-label" style={{ color: priorityColor || undefined }}>
                    {g.priority.charAt(0).toUpperCase() + g.priority.slice(1)}
                  </span>
                )}
                {countdown && (
                  <span className="gt-countdown" data-urgent={countdown.includes('overdue') || countdown.includes('today')}>
                    <Calendar size={9} /> {countdown}
                  </span>
                )}
                {children.length > 0 && (
                  <span className="gt-child-count">
                    {children.length} {cat === 'objective' ? 'epic' : 'goal'}{children.length !== 1 ? 's' : ''}
                  </span>
                )}
                {tasks.length > 0 && (
                  <span className="gt-child-count">{doneTasks.length}/{tasks.length} tasks</span>
                )}
                {cat === 'objective' && (() => {
                  const goalIds = new Set<string>();
                  const q = [g.id];
                  let epicCount = 0, goalCount = 0;
                  while (q.length) {
                    const pid = q.pop()!;
                    goalIds.add(pid);
                    goals.filter(c => c.parent_goal_id === pid).forEach(c => {
                      q.push(c.id);
                      if (c.category === 'epic') epicCount++;
                      else if (c.category === 'goal') goalCount++;
                    });
                  }
                  const allObjTasks = allTasks.filter(t => t.goal_id && goalIds.has(t.goal_id));
                  if (allObjTasks.length === 0 && epicCount === 0 && goalCount === 0) return null;
                  const doneObjTasks = allObjTasks.filter(t => t.status === 'done').length;
                  const vel = calculateVelocity(allObjTasks);
                  const remaining = allObjTasks.filter(t => t.status !== 'done').length;
                  const projDate = projectCompletionDate(vel, remaining);
                  return (
                    <>
                      <span className="gt-obj-summary">
                        {epicCount > 0 && <>{epicCount}E</>}
                        {epicCount > 0 && goalCount > 0 && ' · '}
                        {goalCount > 0 && <>{goalCount}G</>}
                        {(epicCount > 0 || goalCount > 0) && allObjTasks.length > 0 && ' · '}
                        {allObjTasks.length > 0 && <>{doneObjTasks}/{allObjTasks.length}T</>}
                      </span>
                      {vel > 0 && <span className="gt-child-count" title="Tasks per week">{vel.toFixed(1)}/wk</span>}
                      {projDate && <span className="gt-child-count" title="Projected completion">{new Date(projDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Expand chevron */}
            {hasExpandable && (
              <ChevronRight
                size={16}
                className={`gt-chevron ${expanded ? 'rotated' : ''}`}
                onClick={() => toggleExpand(g.id)}
              />
            )}

            {/* Quick actions */}
            <button
              className="gt-more-btn"
              onClick={(e) => handleContextMenu(e, g.id)}
              title="More actions"
            >
              <MoreHorizontal size={14} />
            </button>

            <button
              className="gt-info-btn"
              onClick={(e) => { e.stopPropagation(); setDetailNodeId(g.id); }}
              title="View details"
            >
              <Info size={14} />
            </button>

            <button
              className="gt-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                const cc = getAllDescendants(g.id, goals).length;
                confirmDelete(
                  `Delete "${g.title}"?`,
                  cc > 0 ? `This will also delete ${cc} sub-item${cc > 1 ? 's' : ''} and their tasks.` : 'This cannot be undone.',
                  () => deleteGoal(g.id)
                );
              }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Drop indicator below */}
        {isDragOver && dragPosition === 'below' && <div className="gt-drop-indicator" />}

        {/* Expanded children */}
        {expanded && (
          <div className="gt-children">
            {/* Add child button */}
            {nextChildCategory && (
              <div style={{ marginLeft: `${(depth + 1) * 28}px`, marginBottom: 6 }}>
                <button
                  className="gt-add-child-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateParent(g.id);
                    setCreateCategory(nextChildCategory);
                    setShowForm(true);
                  }}
                >
                  <Plus size={11} /> Add {nextChildCategory === 'epic' ? 'Epic' : 'Goal'}
                </button>
              </div>
            )}

            {/* Child goals/epics */}
            {children.map((child, idx) =>
              renderTreeNode(
                child,
                depth + 1,
                idx === children.length - 1 && tasks.length === 0,
                [...parentPath, !isLast]
              )
            )}

            {/* Task Generator - always show for goals */}
            {(cat === 'goal' || !cat || cat === 'epic') && (
              <div style={{ marginLeft: `${(depth + 1) * 28}px`, marginBottom: 6 }}>
                <GoalTaskGenerator
                  goalId={g.id}
                  goalTitle={g.title}
                  goalDescription={g.description}
                  goalTargetDate={g.target_date}
                  onTasksCreated={fetchGoals}
                />
              </div>
            )}

            {/* Tasks under this node */}
            {tasks.length > 0 && (
              <div className="gt-tasks" style={{ marginLeft: `${(depth + 1) * 28}px` }}>
                <div className="gt-tasks-header">
                  <span className="gt-tasks-label">Tasks ({tasks.length})</span>
                  <button className="gt-add-task-btn" onClick={(e) => { e.stopPropagation(); setNewLinkedTask(newLinkedTask === g.id ? null : g.id); }}>
                    <Plus size={11} /> Task
                  </button>
                </div>
                {newLinkedTask === g.id && (
                  <div className="gt-new-task-form">
                    <input
                      className="gt-new-task-input"
                      placeholder="Task title..."
                      value={newLinkedTaskTitle}
                      onChange={e => setNewLinkedTaskTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createLinkedTask(g.id); if (e.key === 'Escape') setNewLinkedTask(null); }}
                      autoFocus
                    />
                    <button className="gt-new-task-submit" onClick={() => createLinkedTask(g.id)} disabled={creatingLinkedTask || !newLinkedTaskTitle.trim()}>
                      {creatingLinkedTask ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                    </button>
                  </div>
                )}
                {activeTasks.map(t => (
                  <div key={t.id} className="gt-task-row">
                    <button className="gt-task-chk" onClick={e => { e.stopPropagation(); toggleLinkedTask(t.id, t.status, g.id); }}>
                      <Circle size={14} strokeWidth={1.5} />
                    </button>
                    <span
                      className="gt-task-title"
                      onClick={e => { e.stopPropagation(); setDetailTaskId(t.id); }}
                    >
                      {t.title}
                    </span>
                    {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                    {t.due_date && <span className="gt-task-due">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                ))}
                {doneTasks.length > 0 && (
                  <details className="gt-done-group">
                    <summary className="gt-done-toggle">
                      <CheckCircle2 size={11} /> {doneTasks.length} completed
                    </summary>
                    {doneTasks.map(t => (
                      <div key={t.id} className="gt-task-row done">
                        <button className="gt-task-chk checked" onClick={e => { e.stopPropagation(); toggleLinkedTask(t.id, t.status, g.id); }}>
                          <CheckCircle2 size={14} />
                        </button>
                        <span
                          className="gt-task-title"
                          onClick={e => { e.stopPropagation(); setDetailTaskId(t.id); }}
                        >
                          {t.title}
                        </span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Show partner goals view if selected
  if (viewTab === 'partner' && selectedPartner) {
    return (
      <PartnerGoals
        userId={user?.id || ''}
        partnerId={selectedPartner.partner_profile?.user_id || ''}
        partnerName={selectedPartner.partner_profile?.display_name || 'Partner'}
        onBack={() => setViewTab('my')}
      />
    );
  }

  return (
    <div className="goals">
      <div className="goals-header animate-fadeUp">
        <div>
          <h1 className="goals-title"><Target size={22} /> Goals</h1>
          <p className="goals-sub">{activeGoals.length} active · {completedGoals.length} completed · {Math.round(overallProgress * 100)}% overall</p>
          
          {/* Accountability Partner Tab Switcher */}
          {partners.length > 0 && (
            <div className="goals-partner-tabs">
              <button 
                className={`goals-partner-tab ${viewTab === 'my' ? 'active' : ''}`}
                onClick={() => setViewTab('my')}
              >
                My Goals
              </button>
              <button 
                className={`goals-partner-tab ${viewTab === 'partner' ? 'active' : ''}`}
                onClick={() => setViewTab('partner')}
              >
                <Users size={14} /> {selectedPartner?.partner_profile?.display_name || 'Partner'}'s Goals
              </button>
              {partners.length > 1 && (
                <select 
                  className="goals-partner-select"
                  value={selectedPartner?.id || ''}
                  onChange={e => {
                    const p = partners.find(p => p.id === e.target.value);
                    if (p) setSelectedPartner(p);
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.partner_profile?.display_name || 'Partner'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        <div className="goals-header-actions">
          <div className="goals-view-toggle">
            <button className={`goals-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Goals list" aria-label="Goals list view"><List size={15} /></button>
            <button className={`goals-view-btn ${viewMode === 'tree' ? 'active' : ''}`} onClick={() => setViewMode('tree')} title="Vision pyramid" aria-label="Vision tree view"><TreePine size={15} /></button>
            <button className={`goals-view-btn ${viewMode === 'planning' ? 'active' : ''}`} onClick={() => setViewMode('planning')} title="Future planning" aria-label="Future planning view"><Calendar size={15} /></button>
          </div>
          <button className="goals-ai-plan-btn" onClick={() => setShowNLPDecomposer(true)}>
            <Zap size={14} /> AI Plan
          </button>
          <div className="goals-add-dropdown">
            <button className="goals-add-btn" onClick={() => setShowAddMenu(!showAddMenu)}>
              <Plus size={16} /> Add <ChevronDown size={12} />
            </button>
            {showAddMenu && (
              <div className="goals-add-menu">
                <button onClick={() => { setCreateCategory('objective'); setCreateParent(null); setShowForm(true); setShowAddMenu(false); }}>
                  <Target size={14} /> Objective <span className="add-menu-hint">Life direction</span>
                </button>
                <button onClick={() => { setCreateCategory('epic'); setCreateParent(null); setShowForm(true); setShowAddMenu(false); }}>
                  <Layers size={14} /> Epic <span className="add-menu-hint">Under an objective</span>
                </button>
                <button onClick={() => { setCreateCategory('goal'); setCreateParent(null); setShowForm(true); setShowAddMenu(false); }}>
                  <Zap size={14} /> Goal <span className="add-menu-hint">Under an epic</span>
                </button>
                <button onClick={() => { setCreateCategory('task'); setCreateParent(null); setShowForm(true); setShowAddMenu(false); }}>
                  <CheckSquare size={14} /> Task <span className="add-menu-hint">Standalone or under a goal</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Goal Coach — removed: coaching now lives in ZeroClaw chat FAB */}

      {/* Add Form */}
      {showForm && (
        <div className="goals-form">
          <div className="goals-form-type-badge" data-cat={createCategory}>
            {createCategory === 'objective' ? <><Target size={14} style={{ marginRight: 4 }} />New Objective</> : createCategory === 'epic' ? <><Zap size={14} style={{ marginRight: 4 }} />New Epic</> : createCategory === 'goal' ? <><Flag size={14} style={{ marginRight: 4 }} />New Goal</> : <>New Task</>}
            {createParent && <span> → under {goals.find(g => g.id === createParent)?.title}</span>}
          </div>

          {createCategory === 'epic' && (
            <div className="goals-form-group" style={{ marginBottom: 8 }}>
              <label>Parent Objective <span style={{ color: '#f87171', fontSize: 10 }}>required</span></label>
              <select className="goals-form-select" value={createParent || ''} onChange={e => setCreateParent(e.target.value || null)}>
                <option value="">— Select an objective —</option>
                {goals.filter(g => g.category === 'objective').map(g => (
                  <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                ))}
              </select>
            </div>
          )}
          {createCategory === 'goal' && (
            <div className="goals-form-group" style={{ marginBottom: 8 }}>
              <label>Parent Epic <span style={{ color: '#f87171', fontSize: 10 }}>required</span></label>
              <select className="goals-form-select" value={createParent || ''} onChange={e => setCreateParent(e.target.value || null)}>
                <option value="">— Select an epic —</option>
                {goals.filter(g => g.category === 'epic').map(g => {
                  const parentObj = goals.find(p => p.id === g.parent_goal_id);
                  return <option key={g.id} value={g.id}>{g.icon} {g.title}{parentObj ? ` (${parentObj.title})` : ''}</option>;
                })}
              </select>
            </div>
          )}
          {createCategory === 'task' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, display: 'block' }}>Link to hierarchy <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>optional</span></label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }} value={cascadeObjective} onChange={e => { setCascadeObjective(e.target.value); setCascadeEpic(''); setCreateParent(null); }}>
                  <option value="">Any objective</option>
                  {goals.filter(g => g.category === 'objective').map(g => (
                    <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                  ))}
                </select>
                <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }} value={cascadeEpic} onChange={e => { setCascadeEpic(e.target.value); setCreateParent(null); }} disabled={!cascadeObjective}>
                  <option value="">{cascadeObjective ? 'Any epic' : '← Pick objective first'}</option>
                  {goals.filter(g => g.category === 'epic' && (!cascadeObjective || g.parent_goal_id === cascadeObjective)).map(g => (
                    <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                  ))}
                </select>
                <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }} value={createParent || ''} onChange={e => setCreateParent(e.target.value || null)} disabled={!cascadeEpic && !!cascadeObjective}>
                  <option value="">Standalone</option>
                  {goals.filter(g => (!g.category || g.category === 'goal') && (!cascadeEpic || g.parent_goal_id === cascadeEpic)).map(g => (
                    <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <input autoFocus className="goals-form-input" placeholder={
            createCategory === 'objective' ? 'What is the objective?' :
            createCategory === 'epic' ? 'What is this epic about?' :
            createCategory === 'goal' ? 'What will you achieve?' : 'Task title...'
          } value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && createCategory === 'task') createTask(); }} />

          {createCategory === 'task' && (
            <div className="goals-form-row">
              <div className="goals-form-group"><label>Due Date</label><input type="date" className="goals-form-date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
              <div className="goals-form-group"><label>Priority</label>
                <select className="goals-form-select" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}>
                  <option value="medium">Medium</option><option value="critical">🔴 Critical</option><option value="high">🟠 High</option><option value="low">🟢 Low</option>
                </select>
              </div>
            </div>
          )}

          {createCategory !== 'task' && (<>
            <div className="goals-form-row">
              <div className="goals-form-group">
                <label>Icon</label>
                <div className="goals-icon-grid">
                  {ICONS.map(i => (<button key={i} className={`goals-icon-btn ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)}>{i}</button>))}
                </div>
              </div>
              <div className="goals-form-group">
                <label>Color</label>
                <div className="goals-color-grid">
                  {COLORS.map(c => (<button key={c} className={`goals-color-btn ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />))}
                </div>
              </div>
              <div className="goals-form-group">
                <label>Domain</label>
                <select className="goals-form-select" value={createDomain} onChange={e => setCreateDomain(e.target.value)}>
                  <option value="">— None —</option>
                  <option value="education">📚 Education</option>
                  <option value="business">💼 Business</option>
                  <option value="health">🏥 Health</option>
                  <option value="personal">🧘 Personal</option>
                  <option value="spiritual">🙏 Spiritual</option>
                  <option value="creative">🎨 Creative</option>
                </select>
              </div>
              <div className="goals-form-group">
                <label>Priority</label>
                <select className="goals-form-select" value={createPriority} onChange={e => setCreatePriority(e.target.value)}>
                  <option value="medium">Medium</option>
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
            </div>

            <div className="goals-form-row">
              <div className="goals-form-group">
                <label>Target Date</label>
                <input type="date" className="goals-form-date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </div>
              <div className="goals-form-group">
                <label>Deadline</label>
                <select className="goals-form-select" value={createDeadlineType} onChange={e => setCreateDeadlineType(e.target.value)}>
                  <option value="soft">🟡 Soft</option>
                  <option value="hard">🔴 Hard</option>
                  <option value="aspirational">🔵 Aspirational</option>
                </select>
              </div>
              <div className="goals-form-group">
                <label>Est. Hours</label>
                <input type="number" min="0" className="goals-form-date" placeholder="0" value={createHours} onChange={e => setCreateHours(e.target.value)} />
              </div>
            </div>

            {(createCategory === 'objective' || createCategory === 'epic') && (
              <div className="goals-form-row">
                <div className="goals-form-group">
                  <label><Wallet size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Budget ($)</label>
                  <input type="number" min="0" step="0.01" className="goals-form-date" placeholder="0.00" value={createBudget} onChange={e => setCreateBudget(e.target.value)} />
                </div>
                <div className="goals-form-group">
                  <label>Financial Type</label>
                  <select className="goals-form-select" value={createFinType} onChange={e => setCreateFinType(e.target.value)}>
                    <option value="">— None —</option>
                    <option value="investment">📈 Investment</option>
                    <option value="cost_center">💸 Cost Center</option>
                    <option value="revenue_goal">💰 Revenue Goal</option>
                  </select>
                </div>
                <div className="goals-form-group">
                  <label>Linked Business</label>
                  <select className="goals-form-select" value={createBusinessId} onChange={e => setCreateBusinessId(e.target.value)}>
                    <option value="">Personal</option>
                    {businesses.map(b => (<option key={b.id} value={b.id}>{b.icon} {b.name}</option>))}
                  </select>
                </div>
              </div>
            )}

            {createCategory === 'objective' && (
              <div className="goals-form-group" style={{ marginTop: 4 }}>
                <label>Vision / Description</label>
                <textarea className="goals-form-input" style={{ minHeight: 60, resize: 'vertical' }} placeholder="What does success look like?"
                  value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
              </div>
            )}
            {createCategory === 'epic' && (
              <div className="goals-form-group" style={{ marginTop: 4 }}>
                <label>Scope Description</label>
                <textarea className="goals-form-input" style={{ minHeight: 48, resize: 'vertical' }} placeholder="What does this epic cover?"
                  value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
              </div>
            )}

            {createCategory === 'objective' && (
              <div className="goals-form-group" style={{ marginTop: 4 }}>
                <label>Success Criteria <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>How will you know it's done?</span></label>
                <textarea className="goals-form-input" style={{ minHeight: 48, resize: 'vertical' }} placeholder="e.g. 3 clients on automated cleaning with <2hrs oversight/week"
                  value={createSuccessCriteria} onChange={e => setCreateSuccessCriteria(e.target.value)} />
              </div>
            )}
          </>)}

          <div className="goals-form-actions">
            <button className="goals-form-cancel" onClick={() => { setShowForm(false); resetCreateForm(); }}>Cancel</button>
            <button className="goals-form-save" onClick={() => createCategory === 'task' ? createTask() : createGoal()}
              disabled={saving || !title.trim() || (createCategory === 'epic' && !createParent) || (createCategory === 'goal' && !createParent)}>
              {saving ? <><Loader2 size={14} className="spin" /> Creating...</> :
                createCategory === 'epic' && !createParent ? 'Select an objective first' :
                createCategory === 'goal' && !createParent ? 'Select an epic first' :
                `Create ${createCategory === 'objective' ? 'Objective' : createCategory === 'epic' ? 'Epic' : createCategory === 'goal' ? 'Goal' : 'Task'}`
              }
            </button>
          </div>
        </div>
      )}

      {/* Vision Tree View */}
      {viewMode === 'tree' && !loading && (
        <VisionTree
          goals={goals.map(g => ({ ...g, icon: g.icon || '🎯', color: g.color || '#00D4FF', category: g.category || 'goal' }))}
          tasks={allTaskCounts}
          allTasks={allTasks.map(t => ({ ...t, priority: t.priority ?? undefined, due_date: t.due_date ?? undefined, goal_id: t.goal_id ?? undefined }))}
          onCreateNode={handleCreateNode}
          onSelectGoal={(id) => { setViewMode('list'); toggleExpand(id); }}
          onMoveGoal={handleMoveGoal}
          onToggleTask={async (taskId, currentStatus) => {
            const task = allTasks.find(t => t.id === taskId);
            const newStatus = currentStatus === 'done' ? 'todo' : 'done';
            await useScheduleStore.getState().updateTask(taskId, { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null });
            if (task?.goal_id) {
              const { milestones } = await recalcProgression(task.goal_id, supabase);
              if (milestones.length > 0) {
                milestones.forEach(m => showToast(`${m.title} completed!`, '🎉', m.color));
              }
            }
            fetchGoals();
            fetchAllTaskCounts();
          }}
        />
      )}

      {/* Future Planning View */}
      {viewMode === 'planning' && !loading && (
        <FuturePlanningPanel />
      )}

      {/* Category filter bar */}
      {viewMode === 'list' && !loading && (
        <>
          <div className="goals-filter-bar">
            {[
              { key: 'all', label: 'All', icon: null, count: (timeRange ? filteredGoals.length + filteredTasks.length : goals.length + allTasks.length) },
              { key: 'objective', label: 'Objectives', icon: 'target', count: displayGoals.filter((g: GoalNode) => g.category === 'objective').length },
              { key: 'epic', label: 'Epics', icon: 'zap', count: displayGoals.filter((g: GoalNode) => g.category === 'epic').length },
              { key: 'goal', label: 'Goals', icon: 'flag', count: displayGoals.filter((g: GoalNode) => !g.category || g.category === 'goal').length },
              { key: 'task', label: 'Tasks', icon: <CheckSquare size={12} />, count: (timeRange ? filteredTasks : allTasks).length },
            ].map(f => (
              <button key={f.key} className={`goals-filter-btn ${catFilter === f.key ? 'active' : ''} cat-${f.key}`} onClick={() => setCatFilter(f.key)}>
                {f.icon && <span className="goals-filter-icon">{f.icon}</span>}
                {f.label}
                <span className="goals-filter-count">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="goals-filter-bar" style={{ marginTop: 4, gap: 6 }}>
            {[
              { key: 'all', label: 'All Time', icon: <Clock size={12} /> },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'thisQuarter', label: 'This Quarter' },
              { key: 'nextQuarter', label: 'Next Quarter' },
              { key: 'thisYear', label: 'This Year' },
            ].map(f => (
              <button key={f.key} className={`goals-filter-btn time-filter ${timeFilter === f.key ? 'active' : ''}`} onClick={() => setTimeFilter(f.key)}
                style={{ fontSize: 11, padding: '4px 10px' }}>
                {'icon' in f && f.icon}{f.label}
              </button>
            ))}
          </div>

          {timeFilter !== 'all' && (
            <div className="goals-financial-bar">
              <span className="gfb-item"><Wallet size={12} style={{ marginRight: 4 }} />Budget: <strong>${timeFilteredFinancials.totalBudget.toLocaleString()}</strong></span>
              <span className="gfb-item" style={{ color: '#39FF14' }}><TrendingUp size={12} style={{ marginRight: 4 }} />Income: <strong>${timeFilteredFinancials.taskIncome.toLocaleString()}</strong></span>
              <span className="gfb-item" style={{ color: '#F43F5E' }}><TrendingDown size={12} style={{ marginRight: 4 }} />Cost: <strong>${timeFilteredFinancials.taskExpenses.toLocaleString()}</strong></span>
              <span className="gfb-item" style={{ color: timeFilteredFinancials.net >= 0 ? '#39FF14' : '#F43F5E' }}>
                {timeFilteredFinancials.net >= 0 ? <CheckCircle2 size={12} style={{ marginRight: 4 }} /> : <AlertTriangle size={12} style={{ marginRight: 4 }} />} Net: <strong>${timeFilteredFinancials.net.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </>
      )}

      {/* Loading */}
      {viewMode === 'list' && loading && <GoalsSkeleton />}

      {/* Empty state */}
      {viewMode === 'list' && !loading && displayGoals.length === 0 && catFilter !== 'task' && (
        <EmptyState
          variant="goals"
          action={{
            label: 'Set Your First Goal',
            onClick: () => { setCreateCategory('objective'); setCreateParent(null); setShowForm(true); },
          }}
        />
      )}

      {/* List View - All category with tree */}
      {viewMode === 'list' && !loading && catFilter !== 'task' && (
        <>
        {catFilter === 'all' && (
          <div className="goals-list gt-tree-view">
            {displayGoals.filter(g => !g.parent_goal_id).sort((a, b) => {
              const order: Record<string, number> = { objective: 0, epic: 1, goal: 2 };
              return (order[a.category || 'goal'] ?? 2) - (order[b.category || 'goal'] ?? 2) || (a.sort_order || 0) - (b.sort_order || 0);
            }).map((g, idx, arr) => renderTreeNode(g, 0, idx === arr.length - 1, []))}

            {displayTasks.filter(t => !t.goal_id && t.status !== 'done').length > 0 && (
              <div className="gt-standalone-section">
                <div className="gt-standalone-header"><Ban size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Standalone Tasks</div>
                <div className="gt-tasks">
                  {displayTasks.filter(t => !t.goal_id && t.status !== 'done').map(t => (
                    <div key={t.id} className="gt-task-row">
                      <button className="gt-task-chk" onClick={async () => {
                        await useScheduleStore.getState().updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() });
                        fetchGoals();
                      }}>
                        <Circle size={14} strokeWidth={1.5} />
                      </button>
                      <span className="gt-task-title" onClick={e => { e.stopPropagation(); setDetailTaskId(t.id); }}>{t.title}</span>
                      {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Flat view for specific categories */}
        {catFilter !== 'all' && (
          <div className="goals-list gt-tree-view">
            {displayGoals.filter(g => {
              const gc = g.category || 'goal';
              return gc === catFilter;
            }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((g, idx, arr) => renderTreeNode(g, 0, idx === arr.length - 1, []))}
          </div>
        )}

        {/* Active tasks preview */}
        {catFilter === 'all' && allTasks.filter(t => t.status !== 'done').length > 0 && (
          <div className="gt-section-divider">
            <div className="gt-section-label"><CheckSquare size={12} /> Active Tasks ({allTasks.filter(t => t.status !== 'done').length})</div>
            <div className="gt-tasks-list">
              {allTasks.filter(t => t.status !== 'done').slice(0, 8).map(t => {
                const chain = getHierarchy(t.goal_id);
                return (
                  <div key={t.id} className="gt-task-wide">
                    <button className="gt-task-chk" onClick={async () => {
                      await useScheduleStore.getState().updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() });
                      fetchGoals();
                    }}>
                      <Circle size={16} strokeWidth={1.5} />
                    </button>
                    <div className="gt-task-info">
                      <span className="gt-task-title" onClick={() => setDetailTaskId(t.id)}>{t.title}</span>
                      {chain.length > 0 ? (
                        <div className="gt-task-breadcrumb">
                          {chain.map((node, i) => (
                            <span key={node.id}>
                              <button className="gt-task-crumb" onClick={() => { setCatFilter(node.category); toggleExpand(node.id); }}>{node.icon} {node.title}</button>
                              {i < chain.length - 1 && <span className="gt-crumb-sep">›</span>}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="gt-task-standalone"><Ban size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />Standalone</span>
                      )}
                    </div>
                    {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                    <button className="gt-task-delete" aria-label="Delete task" onClick={() => confirmDelete('Delete?', `Remove "${t.title}"?`, () => deleteTask(t.id, t.goal_id))}><Trash2 size={12} /></button>
                  </div>
                );
              })}
              {allTasks.filter(t => t.status !== 'done').length > 8 && (
                <button className="gt-show-all-btn" onClick={() => setCatFilter('task')}>Show all {allTasks.length} tasks →</button>
              )}
            </div>
          </div>
        )}
        </>
      )}

      {/* Task-only view */}
      {viewMode === 'list' && !loading && catFilter === 'task' && (
        <div className="gt-tasks-list standalone">
          {displayTasks.map(t => {
            const chain = getHierarchy(t.goal_id);
            const isDone = t.status === 'done';
            return (
              <div key={t.id} className={`gt-task-wide ${isDone ? 'done' : ''}`}>
                <button className={`gt-task-chk ${isDone ? 'checked' : ''}`} onClick={async () => {
                  const ns = isDone ? 'todo' : 'done';
                  await useScheduleStore.getState().updateTask(t.id, { status: ns, completed_at: ns === 'done' ? new Date().toISOString() : null });
                  fetchGoals();
                }}>{isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button>
                <div className="gt-task-info">
                  <span className="gt-task-title" onClick={() => setDetailTaskId(t.id)}>{t.title}</span>
                  {chain.length > 0 ? (
                    <div className="gt-task-breadcrumb">
                      {chain.map((node, i) => (
                        <span key={node.id}>
                          <button className="gt-task-crumb" onClick={() => { setCatFilter(node.category); toggleExpand(node.id); }}>{node.icon} {node.title}</button>
                          {i < chain.length - 1 && <span className="gt-crumb-sep">›</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="gt-task-standalone"><Ban size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />Standalone</span>
                  )}
                </div>
                {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                {t.due_date && <span className="gt-task-due">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                <button className="gt-task-delete" aria-label="Delete task" onClick={() => deleteTask(t.id, t.goal_id)}><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenuId && contextMenuPos && (
        <div
          ref={contextMenuRef}
          className="gt-context-menu"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
        >
          <button onClick={() => { setDetailNodeId(contextMenuId); setContextMenuId(null); }}>
            <Info size={13} /> View Details
          </button>
          <button onClick={() => { setEditingTitle(contextMenuId); setEditTitleVal(goals.find(g => g.id === contextMenuId)?.title || ''); setContextMenuId(null); }}>
            <Pencil size={13} /> Edit Title
          </button>
          <button onClick={() => duplicateGoal(contextMenuId)}>
            <Copy size={13} /> Duplicate
          </button>
          <button onClick={() => archiveGoal(contextMenuId)}>
            <Archive size={13} /> Archive
          </button>
          <div className="gt-context-divider" />
          <button className="danger" onClick={() => { const cc = getAllDescendants(contextMenuId!, goals).length; confirmDelete('Delete?', cc > 0 ? `This will also delete ${cc} sub-item${cc > 1 ? 's' : ''} and their tasks.` : 'This cannot be undone.', () => deleteGoal(contextMenuId!)); setContextMenuId(null); }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* NodeDetail Modal */}
      {detailNodeId && (
        <NodeDetail
          nodeId={detailNodeId}
          allGoals={goals}
          allTasks={allTasks}
          onClose={() => setDetailNodeId(null)}
          onNavigate={(id) => setDetailNodeId(id)}
          onViewInList={(id) => {
            setViewMode('list');
            setCatFilter('all');
            setDetailNodeId(null);
            setTimeout(() => toggleExpand(id), 100);
          }}
        />
      )}

      {/* TaskDetail Modal */}
      {detailTaskId && (
        <TaskDetail
          taskId={detailTaskId}
          allGoals={goals}
          allTasks={allTasks}
          onClose={() => setDetailTaskId(null)}
          onNavigateToNode={(id) => { setDetailTaskId(null); setDetailNodeId(id); }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmMsg.title}
        message={confirmMsg.message}
        onConfirm={() => { confirmAction?.(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Celebration Confetti */}
      {celebrateGoalId && <Confetti active={true} count={120} />}

      <SpotlightTour tourId="goals" />

      {/* NLP Objective Decomposer */}
      {showNLPDecomposer && (
        <NLPDecomposer
          onClose={() => setShowNLPDecomposer(false)}
          onCreated={() => fetchGoals()}
        />
      )}
    </div>
  );
}
