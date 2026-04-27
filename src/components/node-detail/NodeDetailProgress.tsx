import { Target, ChevronRight } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { Section, Field } from './Section';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailProgress(state: NodeDetailStateReturn) {
  const {
    node, cat, color, pct, actualHours, budgetSpent, budgetPct, budgetBarColor,
    timePct, timeBarColor, children, onNavigate, childLabel, sectionsOpen,
    toggleSection, saveField, inputClass,
  } = state;

  return (
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
  );
}