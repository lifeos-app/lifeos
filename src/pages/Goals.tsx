/** Goals — Slim orchestrator. Composes hooks, components, and modal overlays. */
import { useState, useMemo } from 'react';
import { supabase } from '../lib/data-access';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useUserStore } from '../stores/useUserStore';
import { showToast } from '../components/Toast';
import { recalcProgression } from '../lib/progression';
import { Plus, Target, Calendar, ChevronDown, Pencil, TreePine, List, Layers, Zap, CheckSquare, Circle, CheckCircle2, Trash2, Info, Copy, Archive, Users, Ban, Sparkles, Grid3X3 } from 'lucide-react';
import { Confetti } from '../components/Confetti';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { VisionTree } from '../components/VisionTree';
import { NodeDetail } from '../components/NodeDetail';
import { SpotlightTour } from '../components/SpotlightTour';
import { EmptyState } from '../components/EmptyState';
import { TaskDetail } from '../components/TaskDetail';
import { PartnerGoals } from '../components/PartnerGoals';
import { GoalTreeNode } from '../components/goals/GoalTreeNode';
import { FuturePlanningPanel } from '../components/goals/FuturePlanningPanel';
import { NLPDecomposer } from '../components/goals/NLPDecomposer';
import { GoalsForm } from '../components/goals/GoalsForm';
import { GoalsFilterBar } from '../components/goals/GoalsFilterBar';
import { useGoalsEffects } from '../hooks/useGoalsEffects';
import { useGoalsActions } from '../hooks/useGoalsActions';
import type { GoalNode, GoalTask } from '../components/goals/types';
import { GoalsSkeleton } from '../components/skeletons';
import { CharacterCorner } from '../components/CharacterCorner';
import { CoveyMatrixView } from '../components/goals/CoveyMatrixView';
import './Goals.css';

const POPULAR_GOALS = [
  { title: 'Save $5,000', icon: '💰' }, { title: 'Read 12 books', icon: '📖' },
  { title: 'Exercise 5x/week', icon: '💪' }, { title: 'Learn a new skill', icon: '🧠' },
];
const DEFAULT_FORM = {
  title: '', icon: '🎯', color: '#00D4FF', targetDate: '',
  createCategory: 'goal' as string, createParent: null as string | null,
  createPriority: 'medium', createDomain: '', createBudget: '',
  createBusinessId: '', createDesc: '', createHours: '',
  createDeadlineType: 'soft', createSuccessCriteria: '', createFinType: '',
  newTaskPriority: 'medium', cascadeObjective: '', cascadeEpic: '',
};

export function Goals() {
  const user = useUserStore(s => s.user);
  const [viewMode, setViewMode] = useState<'list' | 'tree' | 'planning' | 'matrix'>('tree');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [formData, setFormData] = useState(DEFAULT_FORM);

  // ── Effects & derived state ──
  const eff = useGoalsEffects(viewMode, timeFilter);

  const resetCreateForm = () => setFormData({ ...DEFAULT_FORM });

  // ── Actions ──
  const act = useGoalsActions(
    user, eff.goals, eff.fetchGoals, eff.fetchAllTaskCounts,
    eff.fetchTaskChartData, eff.setLinkedTasks, resetCreateForm,
  );

  // Sync form category/parent when action state changes
  const handleOpenForm = (category: string, parentId: string | null) => {
    act.setCreateCategory(category); act.setCreateParent(parentId);
    setFormData(prev => ({ ...prev, createCategory: category, createParent: parentId }));
    act.setShowForm(true); act.setShowAddMenu(false);
  };
  const handleCancelForm = () => { act.setShowForm(false); resetCreateForm(); };

  // ── Filtered data ──
  const timeRange = eff.getTimeRange(timeFilter);
  const filteredGoals = useMemo(() => !timeRange ? eff.goals : eff.goals.filter(g => { const td = g.target_date; return td && td >= timeRange.start && td < timeRange.end; }), [eff.goals, timeRange]);
  const filteredTasks = useMemo(() => !timeRange ? eff.allTasks : eff.allTasks.filter(t => { const dd = t.due_date; return dd && dd >= timeRange.start && dd < timeRange.end; }), [eff.allTasks, timeRange]);
  const displayGoals: GoalNode[] = timeRange ? filteredGoals : eff.goals;
  const displayTasks: GoalTask[] = timeRange ? filteredTasks : eff.allTasks;
  const timeFilteredFinancials = useMemo(() => {
    const fg = timeRange ? filteredGoals : eff.goals, ft = timeRange ? filteredTasks : eff.allTasks;
    const totalBudget = fg.reduce((s: number, g: GoalNode) => s + (g.budget_allocated || 0), 0);
    const taskExpenses = ft.filter((t: GoalTask) => t.financial_type === 'expense').reduce((s: number, t: GoalTask) => s + (t.financial_amount || 0), 0);
    const taskIncome = ft.filter((t: GoalTask) => t.financial_type === 'income').reduce((s: number, t: GoalTask) => s + (t.financial_amount || 0), 0);
    return { totalBudget, taskExpenses, taskIncome, net: taskIncome - taskExpenses };
  }, [filteredGoals, filteredTasks, eff.goals, eff.allTasks, timeRange]);

  // ── Partner view ──
  if (act.viewTab === 'partner' && act.selectedPartner) {
    return <PartnerGoals userId={user?.id || ''} partnerId={act.selectedPartner.partner_profile?.user_id || ''} partnerName={act.selectedPartner.partner_profile?.display_name || 'Partner'} onBack={() => act.setViewTab('my')} />;
  }

  // ── Tree node shared props ──
  const tp = {
    goals: eff.goals, allTasks: eff.allTasks, expandedIds: eff.expandedIds,
    highlightedNodeId: eff.highlightedNodeId, celebrateGoalId: act.celebrateGoalId,
    dragId: act.dragId, dragOverId: act.dragOverId, dragPosition: act.dragPosition,
    swipeId: act.swipeId, swipeX: act.swipeX,
    editingTitle: act.editingTitle, editTitleVal: act.editTitleVal,
    newLinkedTask: act.newLinkedTask, newLinkedTaskTitle: act.newLinkedTaskTitle,
    creatingLinkedTask: act.creatingLinkedTask, linkedTasks: eff.linkedTasks,
    taskChartData: eff.taskChartData, ringsAnimated: eff.ringsAnimated,
    onToggleExpand: eff.toggleExpand, onCycleStatus: act.cycleStatus,
    onSetDetailNodeId: act.setDetailNodeId, onSetDetailTaskId: act.setDetailTaskId,
    onSetEditingTitle: act.setEditingTitle, onSetEditTitleVal: act.setEditTitleVal,
    onSaveTitle: act.saveTitle, onSetNewLinkedTask: act.setNewLinkedTask,
    onSetNewLinkedTaskTitle: act.setNewLinkedTaskTitle,
    onCreateLinkedTask: act.createLinkedTask, onToggleLinkedTask: act.toggleLinkedTask,
    onHandleDragStart: act.handleDragStart, onHandleDragEnd: act.handleDragEnd,
    onHandleDragOver: act.handleDragOver, onHandleDrop: act.handleDrop,
    onHandleTouchStart: act.handleTouchStart, onHandleTouchMove: act.handleTouchMove,
    onHandleTouchEnd: act.handleTouchEnd, onHandleContextMenu: act.handleContextMenu,
    onConfirmDelete: act.confirmDelete, onDeleteGoal: act.deleteGoal,
    onCreateChild: act.handleCreateNode, onFetchGoals: () => eff.fetchGoals(),
    getAllDescendants: act.getAllDescendants,
  };

  return (
    <div className="goals">
      <div className="goals-header animate-fadeUp">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="goals-title"><Target size={22} /> Goals</h1>
            <CharacterCorner />
          </div>
          <p className="goals-sub">{eff.activeGoals.length} active · {eff.completedGoals.length} completed · {Math.round(eff.overallProgress * 100)}% overall</p>
          {eff.partners.length > 0 && (
            <div className="goals-partner-tabs">
              <button className={`goals-partner-tab ${act.viewTab === 'my' ? 'active' : ''}`} onClick={() => act.setViewTab('my')}>My Goals</button>
              <button className={`goals-partner-tab ${act.viewTab === 'partner' ? 'active' : ''}`} onClick={() => act.setViewTab('partner')}><Users size={14} /> {act.selectedPartner?.partner_profile?.display_name || 'Partner'}'s Goals</button>
              {eff.partners.length > 1 && <select className="goals-partner-select" value={act.selectedPartner?.id || ''} onChange={e => { const p = eff.partners.find(p => p.id === e.target.value); if (p) act.setSelectedPartner(p); }} onClick={e => e.stopPropagation()}>{eff.partners.map(p => <option key={p.id} value={p.id}>{p.partner_profile?.display_name || 'Partner'}</option>)}</select>}
            </div>
          )}
        </div>
        <div className="goals-header-actions">
          <div className="goals-view-toggle">
            <button className={`goals-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Goals list" aria-label="Goals list view"><List size={15} /></button>
            <button className={`goals-view-btn ${viewMode === 'tree' ? 'active' : ''}`} onClick={() => setViewMode('tree')} title="Vision pyramid" aria-label="Vision tree view"><TreePine size={15} /></button>
            <button className={`goals-view-btn ${viewMode === 'planning' ? 'active' : ''}`} onClick={() => setViewMode('planning')} title="Future planning" aria-label="Future planning view"><Calendar size={15} /></button>
            <button className={`goals-view-btn ${viewMode === 'matrix' ? 'active' : ''}`} onClick={() => setViewMode('matrix')} title="Covey matrix" aria-label="Covey priority matrix"><Grid3X3 size={15} /></button>
          </div>
          <button className="goals-ai-plan-btn" onClick={() => act.setShowNLPDecomposer(true)}><Zap size={14} /> AI Plan</button>
          <div className="goals-add-dropdown">
            <button className="goals-add-btn" onClick={() => act.setShowAddMenu(!act.showAddMenu)}><Plus size={16} /> Add <ChevronDown size={12} /></button>
            {act.showAddMenu && (
              <div className="goals-add-menu">
                <button onClick={() => handleOpenForm('objective', null)}><Target size={14} /> Objective <span className="add-menu-hint">Life direction</span></button>
                <button onClick={() => handleOpenForm('epic', null)}><Layers size={14} /> Epic <span className="add-menu-hint">Under an objective</span></button>
                <button onClick={() => handleOpenForm('goal', null)}><Zap size={14} /> Goal <span className="add-menu-hint">Under an epic</span></button>
                <button onClick={() => handleOpenForm('task', null)}><CheckSquare size={14} /> Task <span className="add-menu-hint">Standalone or under a goal</span></button>
              </div>)}
          </div>
        </div>
      </div>

      {act.showForm && (
        <GoalsForm goals={eff.goals} businesses={eff.businesses} form={formData}
          setForm={(partial: any) => setFormData(prev => ({ ...prev, ...partial }))}
          saving={act.saving} onSaveGoal={act.createGoalFromForm}
          onSaveTask={act.createTaskFromForm} onCancel={handleCancelForm}
        />
      )}

      {viewMode === 'tree' && !eff.loading && (
        <VisionTree
          goals={eff.goals.map(g => ({ ...g, icon: g.icon || '🎯', color: g.color || '#00D4FF', category: g.category || 'goal' }))}
          tasks={eff.allTaskCounts}
          allTasks={eff.allTasks.map(t => ({ ...t, priority: t.priority ?? undefined, due_date: t.due_date ?? undefined, goal_id: t.goal_id ?? undefined }))}
          onCreateNode={act.handleCreateNode}
          onSelectGoal={(id) => { setViewMode('list'); eff.toggleExpand(id); }}
          onMoveGoal={act.handleMoveGoal}
          onToggleTask={async (taskId, currentStatus) => {
            const task = eff.allTasks.find(t => t.id === taskId);
            const newStatus = currentStatus === 'done' ? 'todo' : 'done';
            await useScheduleStore.getState().updateTask(taskId, { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null });
            if (task?.goal_id) { const { milestones } = await recalcProgression(task.goal_id, supabase); if (milestones.length > 0) milestones.forEach(m => showToast(`${m.title} completed!`, '🎉', m.color)); }
            eff.fetchGoals(); eff.fetchAllTaskCounts();
          }}
        />
      )}

      {viewMode === 'planning' && !eff.loading && <FuturePlanningPanel />}

      {viewMode === 'matrix' && !eff.loading && <CoveyMatrixView />}

      {viewMode === 'list' && !eff.loading && (
        <GoalsFilterBar goals={eff.goals} allTasks={eff.allTasks} filteredGoals={filteredGoals} filteredTasks={filteredTasks}
          displayGoals={displayGoals} catFilter={catFilter} setCatFilter={setCatFilter}
          timeFilter={timeFilter} setTimeFilter={setTimeFilter} timeRange={timeRange}
          timeFilteredFinancials={timeFilteredFinancials}
        />
      )}

      {viewMode === 'list' && eff.loading && <GoalsSkeleton />}

      {viewMode === 'list' && !eff.loading && displayGoals.length > 0 && catFilter !== 'task' && (
        <div className="goals-quick-add">
          <span className="goals-quick-add-icon"><Plus size={18} /></span>
          <input className="goals-quick-add-input" placeholder="Quick add a goal..." value={act.quickAddTitle} onChange={e => act.setQuickAddTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') act.handleQuickAdd(); if (e.key === 'Escape') act.setQuickAddTitle(''); }} disabled={act.saving} />
          <span className="goals-quick-add-hint">Press Enter</span>
        </div>
      )}

      {viewMode === 'list' && !eff.loading && displayGoals.length === 0 && catFilter !== 'task' && (
        <>
          <EmptyState variant="goals" action={{ label: 'Set Your First Goal', onClick: () => handleOpenForm('objective', null) }} />
          <div className="goals-popular">
            <div className="goals-popular-title">Popular goals to get started</div>
            <div className="goals-popular-list">
              {POPULAR_GOALS.map(pg => (<button key={pg.title} className="goals-popular-chip" onClick={() => act.handlePopularGoal(pg.title, pg.icon)}><Sparkles size={12} style={{ opacity: 0.5 }} />{pg.title}</button>))}
            </div>
          </div>
        </>
      )}

      {viewMode === 'list' && !eff.loading && catFilter !== 'task' && (
        <>
          {catFilter === 'all' && (
            <div className="goals-list gt-tree-view">
              {displayGoals.filter(g => !g.parent_goal_id).sort((a, b) => {
                const order: Record<string, number> = { objective: 0, epic: 1, goal: 2 };
                return (order[a.category || 'goal'] ?? 2) - (order[b.category || 'goal'] ?? 2) || (a.sort_order || 0) - (b.sort_order || 0);
              }).map((g, idx, arr) => <GoalTreeNode key={g.id} goal={g} depth={0} isLast={idx === arr.length - 1} parentPath={[]} {...tp} />)}
              {displayTasks.filter(t => !t.goal_id && t.status !== 'done').length > 0 && (
                <div className="gt-standalone-section">
                  <div className="gt-standalone-header"><Ban size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Standalone Tasks</div>
                  <div className="gt-tasks">
                    {displayTasks.filter(t => !t.goal_id && t.status !== 'done').map(t => (
                      <div key={t.id} className="gt-task-row">
                        <button className="gt-task-chk" onClick={async () => { await useScheduleStore.getState().updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); eff.fetchGoals(); }}><Circle size={14} strokeWidth={1.5} /></button>
                        <span className="gt-task-title" onClick={e => { e.stopPropagation(); act.setDetailTaskId(t.id); }}>{t.title}</span>
                        {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {catFilter !== 'all' && (
            <div className="goals-list gt-tree-view">
              {displayGoals.filter(g => (g.category || 'goal') === catFilter).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((g, idx, arr) => <GoalTreeNode key={g.id} goal={g} depth={0} isLast={idx === arr.length - 1} parentPath={[]} {...tp} />)}
            </div>
          )}
          {catFilter === 'all' && eff.allTasks.filter(t => t.status !== 'done').length > 0 && (
            <div className="gt-section-divider">
              <div className="gt-section-label"><CheckSquare size={12} /> Active Tasks ({eff.allTasks.filter(t => t.status !== 'done').length})</div>
              <div className="gt-tasks-list">
                {eff.allTasks.filter(t => t.status !== 'done').slice(0, 8).map(t => {
                  const chain = eff.getHierarchy(t.goal_id);
                  return (
                    <div key={t.id} className="gt-task-wide">
                      <button className="gt-task-chk" onClick={async () => { await useScheduleStore.getState().updateTask(t.id, { status: 'done', completed_at: new Date().toISOString() }); eff.fetchGoals(); }}><Circle size={16} strokeWidth={1.5} /></button>
                      <div className="gt-task-info">
                        <span className="gt-task-title" onClick={() => act.setDetailTaskId(t.id)}>{t.title}</span>
                        {chain.length > 0 ? <div className="gt-task-breadcrumb">{chain.map((node, i) => <span key={node.id}><button className="gt-task-crumb" onClick={() => { setCatFilter(node.category); eff.toggleExpand(node.id); }}>{node.icon} {node.title}</button>{i < chain.length - 1 && <span className="gt-crumb-sep">›</span>}</span>)}</div>
                          : <span className="gt-task-standalone"><Ban size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />Standalone</span>}
                      </div>
                      {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                      <button className="gt-task-delete" aria-label="Delete task" onClick={() => act.confirmDelete('Delete?', `Remove "${t.title}"?`, () => act.deleteTask(t.id, t.goal_id))}><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                {eff.allTasks.filter(t => t.status !== 'done').length > 8 && (<button className="gt-show-all-btn" onClick={() => setCatFilter('task')}>Show all {eff.allTasks.length} tasks →</button>)}
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'list' && !eff.loading && catFilter === 'task' && (
        <div className="gt-tasks-list standalone">
          {displayTasks.map(t => {
            const chain = eff.getHierarchy(t.goal_id); const isDone = t.status === 'done';
            return (
              <div key={t.id} className={`gt-task-wide ${isDone ? 'done' : ''}`}>
                <button className={`gt-task-chk ${isDone ? 'checked' : ''}`} onClick={async () => { const ns = isDone ? 'todo' : 'done'; await useScheduleStore.getState().updateTask(t.id, { status: ns, completed_at: ns === 'done' ? new Date().toISOString() : null }); eff.fetchGoals(); }}>
                  {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button>
                <div className="gt-task-info">
                  <span className="gt-task-title" onClick={() => act.setDetailTaskId(t.id)}>{t.title}</span>
                  {chain.length > 0 ? <div className="gt-task-breadcrumb">{chain.map((node, i) => <span key={node.id}><button className="gt-task-crumb" onClick={() => { setCatFilter(node.category); eff.toggleExpand(node.id); }}>{node.icon} {node.title}</button>{i < chain.length - 1 && <span className="gt-crumb-sep">›</span>}</span>)}</div>
                    : <span className="gt-task-standalone"><Ban size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />Standalone</span>}
                </div>
                {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                {t.due_date && <span className="gt-task-due">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                <button className="gt-task-delete" aria-label="Delete task" onClick={() => act.deleteTask(t.id, t.goal_id)}><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}

      {act.contextMenuId && act.contextMenuPos && (
        <div ref={act.contextMenuRef} className="gt-context-menu" style={{ top: act.contextMenuPos.y, left: act.contextMenuPos.x }}>
          <button onClick={() => { act.setDetailNodeId(act.contextMenuId); act.setContextMenuId(null); }}><Info size={13} /> View Details</button>
          <button onClick={() => { act.setEditingTitle(act.contextMenuId); act.setEditTitleVal(eff.goals.find(g => g.id === act.contextMenuId)?.title || ''); act.setContextMenuId(null); }}><Pencil size={13} /> Edit Title</button>
          <button onClick={() => act.duplicateGoal(act.contextMenuId)}><Copy size={13} /> Duplicate</button>
          <button onClick={() => act.archiveGoal(act.contextMenuId)}><Archive size={13} /> Archive</button>
          <div className="gt-context-divider" />
          <button className="danger" onClick={() => { const cc = act.getAllDescendants(act.contextMenuId!, eff.goals).length; act.confirmDelete('Delete?', cc > 0 ? `This will also delete ${cc} sub-item${cc > 1 ? 's' : ''} and their tasks.` : 'This cannot be undone.', () => act.deleteGoal(act.contextMenuId!)); act.setContextMenuId(null); }}><Trash2 size={13} /> Delete</button>
        </div>
      )}

      {act.detailNodeId && <NodeDetail nodeId={act.detailNodeId} allGoals={eff.goals} allTasks={eff.allTasks} onClose={() => act.setDetailNodeId(null)} onNavigate={(id) => act.setDetailNodeId(id)} onViewInList={(id) => { setViewMode('list'); setCatFilter('all'); act.setDetailNodeId(null); setTimeout(() => eff.toggleExpand(id), 100); }} />}
      {act.detailTaskId && <TaskDetail taskId={act.detailTaskId} allGoals={eff.goals} allTasks={eff.allTasks} onClose={() => act.setDetailTaskId(null)} onNavigateToNode={(id) => { act.setDetailTaskId(null); act.setDetailNodeId(id); }} />}
      <ConfirmDialog open={!!act.confirmAction} title={act.confirmMsg.title} message={act.confirmMsg.message} onConfirm={() => { act.confirmAction?.(); act.setConfirmAction(null); }} onCancel={() => act.setConfirmAction(null)} />
      {act.celebrateGoalId && <Confetti active={true} count={120} />}
      <SpotlightTour tourId="goals" />
      {act.showNLPDecomposer && <NLPDecomposer onClose={() => act.setShowNLPDecomposer(false)} onCreated={() => eff.fetchGoals()} />}
    </div>
  );
}