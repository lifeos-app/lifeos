/**
 * GoalsForm — Goal/task creation form.
 *
 * Extracted from Goals.tsx. Handles all categories: objective, epic, goal, task.
 */

import { Loader2, Target, Zap, Flag, CheckSquare, Wallet } from 'lucide-react';
import type { GoalNode } from '../goals/types';
import { ICONS, COLORS } from '../goals/utils';
import type { GoalsCreateFormData } from '../../hooks/useGoalsActions';

interface GoalsFormProps {
  goals: GoalNode[];
  businesses: any[];
  form: GoalsCreateFormData;
  setForm: (partial: Partial<GoalsCreateFormData>) => void;
  saving: boolean;
  onSaveGoal: (form: GoalsCreateFormData) => Promise<void>;
  onSaveTask: (form: GoalsCreateFormData) => Promise<void>;
  onCancel: () => void;
}

export function GoalsForm({
  goals,
  businesses,
  form,
  setForm,
  saving,
  onSaveGoal,
  onSaveTask,
  onCancel,
}: GoalsFormProps) {
  const { title, icon, color, targetDate, createCategory, createParent } = form;
  const isTask = createCategory === 'task';

  return (
    <div className="goals-form">
      <div className="goals-form-type-badge" data-cat={createCategory}>
        {createCategory === 'objective' ? <><Target size={14} style={{ marginRight: 4 }} />New Objective</> :
         createCategory === 'epic' ? <><Zap size={14} style={{ marginRight: 4 }} />New Epic</> :
         createCategory === 'goal' ? <><Flag size={14} style={{ marginRight: 4 }} />New Goal</> :
         <>New Task</>}
        {createParent && <span> → under {goals.find(g => g.id === createParent)?.title}</span>}
      </div>

      {createCategory === 'epic' && (
        <div className="goals-form-group" style={{ marginBottom: 8 }}>
          <label>Parent Objective <span style={{ color: '#f87171', fontSize: 10 }}>required</span></label>
          <select className="goals-form-select" value={createParent || ''} onChange={e => setForm({ createParent: e.target.value || null })}>
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
          <select className="goals-form-select" value={createParent || ''} onChange={e => setForm({ createParent: e.target.value || null })}>
            <option value="">— Select an epic —</option>
            {goals.filter(g => g.category === 'epic').map(g => {
              const parentObj = goals.find(p => p.id === g.parent_goal_id);
              return <option key={g.id} value={g.id}>{g.icon} {g.title}{parentObj ? ` (${parentObj.title})` : ''}</option>;
            })}
          </select>
        </div>
      )}
      {isTask && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, display: 'block' }}>Link to hierarchy <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>optional</span></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }}
              value={form.cascadeObjective}
              onChange={e => { setForm({ cascadeObjective: e.target.value, cascadeEpic: '', createParent: null }); }}
            >
              <option value="">Any objective</option>
              {goals.filter(g => g.category === 'objective').map(g => (
                <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
              ))}
            </select>
            <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }}
              value={form.cascadeEpic}
              onChange={e => { setForm({ cascadeEpic: e.target.value, createParent: null }); }}
              disabled={!form.cascadeObjective}
            >
              <option value="">{form.cascadeObjective ? 'Any epic' : '← Pick objective first'}</option>
              {goals.filter(g => g.category === 'epic' && (!form.cascadeObjective || g.parent_goal_id === form.cascadeObjective)).map(g => (
                <option key={g.id} value={g.id}>{g.icon} {g.title}</option>
              ))}
            </select>
            <select className="goals-form-select" style={{ flex: 1, minWidth: 140 }}
              value={createParent || ''}
              onChange={e => setForm({ createParent: e.target.value || null })}
              disabled={!form.cascadeEpic && !!form.cascadeObjective}
            >
              <option value="">Standalone</option>
              {goals.filter(g => (!g.category || g.category === 'goal') && (!form.cascadeEpic || g.parent_goal_id === form.cascadeEpic)).map(g => (
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
      } value={title} onChange={e => setForm({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && isTask) onSaveTask(form); }} />

      {isTask && (
        <div className="goals-form-row">
          <div className="goals-form-group"><label>Due Date</label><input type="date" className="goals-form-date" value={targetDate} onChange={e => setForm({ targetDate: e.target.value })} /></div>
          <div className="goals-form-group"><label>Priority</label>
            <select className="goals-form-select" value={form.newTaskPriority} onChange={e => setForm({ newTaskPriority: e.target.value })}>
              <option value="medium">Medium</option><option value="critical">🔴 Critical</option><option value="high">🟠 High</option><option value="low">🟢 Low</option>
            </select>
          </div>
        </div>
      )}

      {!isTask && (<>
        <div className="goals-form-row">
          <div className="goals-form-group">
            <label>Icon</label>
            <div className="goals-icon-grid">
              {ICONS.map(i => (<button key={i} className={`goals-icon-btn ${icon === i ? 'active' : ''}`} onClick={() => setForm({ icon: i })}>{i}</button>))}
            </div>
          </div>
          <div className="goals-form-group">
            <label>Color</label>
            <div className="goals-color-grid">
              {COLORS.map(c => (<button key={c} className={`goals-color-btn ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setForm({ color: c })} />))}
            </div>
          </div>
          <div className="goals-form-group">
            <label>Domain</label>
            <select className="goals-form-select" value={form.createDomain} onChange={e => setForm({ createDomain: e.target.value })}>
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
            <select className="goals-form-select" value={form.createPriority} onChange={e => setForm({ createPriority: e.target.value })}>
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
            <input type="date" className="goals-form-date" value={targetDate} onChange={e => setForm({ targetDate: e.target.value })} />
          </div>
          <div className="goals-form-group">
            <label>Deadline</label>
            <select className="goals-form-select" value={form.createDeadlineType} onChange={e => setForm({ createDeadlineType: e.target.value })}>
              <option value="soft">🟡 Soft</option>
              <option value="hard">🔴 Hard</option>
              <option value="aspirational">🔵 Aspirational</option>
            </select>
          </div>
          <div className="goals-form-group">
            <label>Est. Hours</label>
            <input type="number" min="0" className="goals-form-date" placeholder="0" value={form.createHours} onChange={e => setForm({ createHours: e.target.value })} />
          </div>
        </div>

        {(createCategory === 'objective' || createCategory === 'epic') && (
          <div className="goals-form-row">
            <div className="goals-form-group">
              <label><Wallet size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Budget ($)</label>
              <input type="number" min="0" step="0.01" className="goals-form-date" placeholder="0.00" value={form.createBudget} onChange={e => setForm({ createBudget: e.target.value })} />
            </div>
            <div className="goals-form-group">
              <label>Financial Type</label>
              <select className="goals-form-select" value={form.createFinType} onChange={e => setForm({ createFinType: e.target.value })}>
                <option value="">— None —</option>
                <option value="investment">📈 Investment</option>
                <option value="cost_center">💸 Cost Center</option>
                <option value="revenue_goal">💰 Revenue Goal</option>
              </select>
            </div>
            <div className="goals-form-group">
              <label>Linked Business</label>
              <select className="goals-form-select" value={form.createBusinessId} onChange={e => setForm({ createBusinessId: e.target.value })}>
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
              value={form.createDesc} onChange={e => setForm({ createDesc: e.target.value })} />
          </div>
        )}
        {createCategory === 'epic' && (
          <div className="goals-form-group" style={{ marginTop: 4 }}>
            <label>Scope Description</label>
            <textarea className="goals-form-input" style={{ minHeight: 48, resize: 'vertical' }} placeholder="What does this epic cover?"
              value={form.createDesc} onChange={e => setForm({ createDesc: e.target.value })} />
          </div>
        )}

        {createCategory === 'objective' && (
          <div className="goals-form-group" style={{ marginTop: 4 }}>
            <label>Success Criteria <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>How will you know it's done?</span></label>
            <textarea className="goals-form-input" style={{ minHeight: 48, resize: 'vertical' }} placeholder="e.g. 3 clients on automated cleaning with <2hrs oversight/week"
              value={form.createSuccessCriteria} onChange={e => setForm({ createSuccessCriteria: e.target.value })} />
          </div>
        )}
      </>)}

      <div className="goals-form-actions">
        <button className="goals-form-cancel" onClick={onCancel}>Cancel</button>
        <button className="goals-form-save" onClick={() => isTask ? onSaveTask(form) : onSaveGoal(form)}
          disabled={saving || !title.trim() || (createCategory === 'epic' && !createParent) || (createCategory === 'goal' && !createParent)}>
          {saving ? <><Loader2 size={14} className="spin" /> Creating...</> :
            createCategory === 'epic' && !createParent ? 'Select an objective first' :
            createCategory === 'goal' && !createParent ? 'Select an epic first' :
            `Create ${createCategory === 'objective' ? 'Objective' : createCategory === 'epic' ? 'Epic' : createCategory === 'goal' ? 'Goal' : 'Task'}`
          }
        </button>
      </div>
    </div>
  );
}