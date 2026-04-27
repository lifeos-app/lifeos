import { X, DollarSign, Wallet } from 'lucide-react';
import { Section, Field } from './Section';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailResources(state: NodeDetailStateReturn) {
  const {
    cat, node, goalBudget, budgetSpent, budgetPct, budgetBarColor, relatedExpenses,
    businesses, saveField, inputClass, keyResults, resources, newResource, setNewResource,
    saveKeyResults, saveResources,
  } = state;

  return (
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
  );
}