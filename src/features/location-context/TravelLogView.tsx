/**
 * TravelLogView.tsx — Travel log and KM tracker
 *
 * Date-filterable log of all travel, KM summary cards,
 * ATO deduction calculator, work vs personal breakdown,
 * and CSV export for tax purposes.
 */

import { useState, useMemo } from 'react';
import { useLocationContext } from './useLocationContext';
import { localDateStr } from '../../utils/date';
import { ATO_CENTS_PER_KM } from '../../stores/locationStore';
import type { TravelPurpose, TravelLog } from '../../stores/locationStore';

export function TravelLogView() {
  const ctx = useLocationContext();

  const today = localDateStr();
  const [filterStart, setFilterStart] = useState(today.substring(0, 8) + '01'); // Start of month
  const [filterEnd, setFilterEnd] = useState(today);
  const [selectedPurpose, setSelectedPurpose] = useState<TravelPurpose | 'all'>('all');
  const [showExport, setShowExport] = useState(false);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let entries = ctx.getTravelForRange(filterStart, filterEnd);
    if (selectedPurpose !== 'all') {
      entries = entries.filter(t => t.purpose === selectedPurpose);
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [ctx.travelLog, filterStart, filterEnd, selectedPurpose]);

  // KM summaries
  const todayKms = useMemo(() => {
    return ctx.getTravelKmsForRange(today, today);
  }, [ctx.travelLog, today]);

  // Week range
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Monday
    return localDateStr(d);
  }, []);

  const weekKms = useMemo(() => {
    return ctx.getTravelKmsForRange(weekStart, today);
  }, [ctx.travelLog, weekStart, today]);

  // Month range
  const monthStart = today.substring(0, 8) + '01';
  const monthKms = useMemo(() => {
    return ctx.getTravelKmsForRange(monthStart, today);
  }, [ctx.travelLog, monthStart, today]);

  // Financial year (July 1 to June 30)
  const fyStart = useMemo(() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-07-01`;
  }, []);

  const fyKms = useMemo(() => {
    return ctx.getTravelKmsForRange(fyStart, today);
  }, [ctx.travelLog, fyStart, today]);

  // ATO deduction for current filter range (work kms only)
  const atoDeduction = useMemo(() => {
    return ctx.getATODeduction(filterStart, filterEnd);
  }, [ctx.travelLog, filterStart, filterEnd]);

  // Financial year ATO deduction
  const fyDeduction = useMemo(() => {
    return ctx.getATODeduction(fyStart, today);
  }, [ctx.travelLog, fyStart, today]);

  // CSV Export
  const exportCSV = () => {
    const headers = ['Date', 'From', 'To', 'KM', 'Duration (min)', 'Purpose'];
    const rows = filteredEntries.map(t => [
      t.date, t.from, t.to, t.kms.toString(), t.duration.toString(), t.purpose,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-travel-${filterStart}-to-${filterEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add manual travel log
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newKms, setNewKms] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newPurpose, setNewPurpose] = useState<TravelPurpose>('work');

  const handleAddManual = () => {
    if (!newFrom.trim() || !newTo.trim() || !newKms) return;
    ctx.addTravelLog({
      date: today,
      from: newFrom.trim(),
      to: newTo.trim(),
      kms: parseFloat(newKms) || 0,
      duration: parseInt(newDuration) || 0,
      purpose: newPurpose,
    });
    setNewFrom('');
    setNewTo('');
    setNewKms('');
    setNewDuration('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/80">Travel Log</h2>
          <p className="text-[10px] text-white/30 mt-0.5">
            {filteredEntries.length} entries · ATO deduction ready
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-600/60 to-orange-600/60 hover:from-amber-500/70 hover:to-orange-500/70 border border-amber-500/30 transition-all"
          >
            + Add Trip
          </button>
          <button
            onClick={() => setShowExport(!showExport)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 transition-all"
          >
            📊
          </button>
        </div>
      </div>

      {/* Manual Add Form */}
      {showAddForm && (
        <div className="p-3 rounded-xl bg-[#111132]/80 border border-amber-500/15 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newFrom}
              onChange={e => setNewFrom(e.target.value)}
              placeholder="From"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20 outline-none"
            />
            <input
              type="text"
              value={newTo}
              onChange={e => setNewTo(e.target.value)}
              placeholder="To"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20 outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={newKms}
              onChange={e => setNewKms(e.target.value)}
              placeholder="KM"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono placeholder-white/20 outline-none"
            />
            <input
              type="number"
              value={newDuration}
              onChange={e => setNewDuration(e.target.value)}
              placeholder="Mins"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono placeholder-white/20 outline-none"
            />
            <select
              value={newPurpose}
              onChange={e => setNewPurpose(e.target.value as TravelPurpose)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="commute">Commute</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddManual}
              disabled={!newFrom.trim() || !newTo.trim() || !newKms}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-amber-600/60 hover:bg-amber-500/60 disabled:opacity-30 transition-all"
            >
              Save Trip
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KM Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <KMSummaryCard
          icon="📅"
          kms={todayKms.total}
          workKms={todayKms.work}
          label="Today"
          color="from-cyan-600/30 to-blue-900/30"
        />
        <KMSummaryCard
          icon="📊"
          kms={weekKms.total}
          workKms={weekKms.work}
          label="This Week"
          color="from-emerald-600/30 to-green-900/30"
        />
        <KMSummaryCard
          icon="🗓️"
          kms={monthKms.total}
          workKms={monthKms.work}
          label="This Month"
          color="from-amber-600/30 to-orange-900/30"
        />
        <KMSummaryCard
          icon="💰"
          kms={fyKms.total}
          workKms={fyKms.work}
          label="This FY"
          color="from-violet-600/30 to-purple-900/30"
          deduction={fyDeduction.deduction}
        />
      </div>

      {/* ATO Deduction Banner */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-emerald-200">
              ATO Deduction ({ATO_CENTS_PER_KM}c/km 2024-25)
            </div>
            <div className="text-[10px] text-emerald-300/50 mt-0.5">
              Filter: {filterStart} → {filterEnd}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-200">
              ${atoDeduction.deduction.toFixed(2)}
            </div>
            <div className="text-[10px] text-emerald-300/50">
              {atoDeduction.workKms}km work travel
            </div>
          </div>
        </div>
      </div>

      {/* Work vs Personal Breakdown */}
      <div className="p-3 rounded-xl bg-[#111132]/60 border border-white/5">
        <h3 className="text-xs font-medium text-white/60 mb-2">Breakdown (filter range)</h3>
        <div className="flex gap-2">
          {(['work', 'personal', 'commute'] as TravelPurpose[]).map(p => {
            const range = ctx.getTravelKmsForRange(filterStart, filterEnd);
            const kms = p === 'work' ? range.work : p === 'personal' ? range.personal : range.commute;
            const total = range.total || 1;
            const pct = (kms / total) * 100;
            const colors = { work: '#3B82F6', personal: '#8B5CF6', commute: '#F97316' };
            return (
              <div key={p} className="flex-1">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors[p] }}
                  />
                </div>
                <div className="text-[10px] text-white/40">
                  {p === 'work' ? '💼' : p === 'personal' ? '🏠' : '🚗'} {kms.toFixed(1)}km
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filterStart}
          onChange={e => setFilterStart(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-mono outline-none"
        />
        <span className="text-[10px] text-white/30">→</span>
        <input
          type="date"
          value={filterEnd}
          onChange={e => setFilterEnd(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-mono outline-none"
        />
        <select
          value={selectedPurpose}
          onChange={e => setSelectedPurpose(e.target.value as TravelPurpose | 'all')}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none ml-auto"
        >
          <option value="all">All</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="commute">Commute</option>
        </select>
      </div>

      {/* Export Panel */}
      {showExport && (
        <div className="p-3 rounded-xl bg-[#111132]/60 border border-white/5 space-y-2">
          <h3 className="text-xs font-medium text-white/70">Export</h3>
          <button
            onClick={exportCSV}
            className="w-full py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-600/50 to-cyan-600/50 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-500/20 transition-all"
          >
            📥 Export CSV for Tax ({filteredEntries.length} entries)
          </button>
          <p className="text-[10px] text-white/30">
            ATO-compliant format. Includes date, from, to, km, duration, purpose.
          </p>
        </div>
      )}

      {/* Travel Entries */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-sm">
          <div className="text-2xl mb-2">🚗</div>
          <p>No travel logged in this range.</p>
          <p className="text-[10px] mt-1">Add trips manually or enable location tracking for auto-logging.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredEntries.map(entry => (
            <TravelEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* TCS Integration Hint */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/15 to-indigo-900/15 border border-blue-500/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">🗺️</span>
          <span className="text-xs font-medium text-blue-200">TCS Route Optimizer</span>
        </div>
        <p className="text-[10px] text-blue-300/50">
          Connect with the TCS business module to optimize your cleaning route and
          auto-calculate travel between client sites for maximum deduction claims.
        </p>
      </div>
    </div>
  );
}

// ── KM Summary Card ──────────────────────────────────────────────────

function KMSummaryCard({ icon, kms, workKms, label, color, deduction }: {
  icon: string;
  kms: number;
  workKms: number;
  label: string;
  color: string;
  deduction?: number;
}) {
  return (
    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} border border-white/5`}>
      <div className="text-lg">{icon}</div>
      <div className="text-base font-bold text-white mt-0.5">{kms.toFixed(1)}km</div>
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      {workKms > 0 && (
        <div className="text-[9px] text-cyan-300/60 mt-0.5">💼 {workKms.toFixed(1)}km work</div>
      )}
      {deduction !== undefined && deduction > 0 && (
        <div className="text-[9px] text-emerald-300/60 mt-0.5">${deduction.toFixed(2)} deductible</div>
      )}
    </div>
  );
}

// ── Travel Entry ──────────────────────────────────────────────────────

function TravelEntry({ entry }: { entry: TravelLog }) {
  const purposeColors: Record<TravelPurpose, string> = {
    work: '#3B82F6',
    personal: '#8B5CF6',
    commute: '#F97316',
  };
  const purposeLabels: Record<TravelPurpose, string> = {
    work: '💼 Work',
    personal: '🏠 Personal',
    commute: '🚗 Commute',
  };

  return (
    <div className="p-2.5 rounded-lg bg-[#111132]/40 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-white/80">
          {entry.from} → {entry.to}
        </div>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{
            color: purposeColors[entry.purpose] + 'cc',
            backgroundColor: purposeColors[entry.purpose] + '15',
          }}
        >
          {purposeLabels[entry.purpose]}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/30">
        <span>{entry.date}</span>
        <span className="font-mono">
          {entry.kms}km · {entry.duration}min
        </span>
      </div>
    </div>
  );
}