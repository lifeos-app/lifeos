import { Plus, Loader2, Check, Circle, CheckCircle2 } from 'lucide-react';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailTasks(state: NodeDetailStateReturn) {
  const { linkedTasks, activeTasks, doneTasks, showAddChild, setShowAddChild,
    newChildTitle, setNewChildTitle, addingChild, createChild, toggleTask } = state;

  return (
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
  );
}