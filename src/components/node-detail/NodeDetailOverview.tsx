import { FileText, Calendar, Target, RefreshCw, HeartPulse, CheckCircle2, Circle, Zap, Activity } from 'lucide-react';
import { Section, Field } from './Section';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailOverview(state: NodeDetailStateReturn) {
  const {
    sectionsOpen, toggleSection, editingDesc, editDesc, setEditDesc, setEditingDesc,
    saveDesc, saveField, node, mainDesc, cat, keyResults, newKeyResult, setNewKeyResult,
    saveKeyResults, linkedHabits, getLogsForHabit, showHealth, todayMetrics,
    actualHours, inputClass,
  } = state;

  return (
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
  );
}