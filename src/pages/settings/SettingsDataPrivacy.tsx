/**
 * SettingsDataPrivacy — Data export and Danger Zone (delete account)
 */
import { useState, useMemo, type JSX } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import {
  Database, Download, Loader2, Shield, Trash2, AlertTriangle, LogOut,
  Sparkles, Clock,
} from 'lucide-react';
import {
  exportData as doExport,
  downloadExport,
  getExportStats,
  getExportHistory,
  type ExportFormat,
  type ExportScope,
} from '../../lib/data-export';

const SCOPE_OPTIONS: Array<{ value: ExportScope; label: string }> = [
  { value: 'all', label: 'All Data' },
  { value: 'habits', label: 'Habits' },
  { value: 'goals', label: 'Goals' },
  { value: 'finances', label: 'Finances' },
  { value: 'health', label: 'Health' },
  { value: 'journal', label: 'Journal' },
];

interface SettingsDataPrivacyProps {
  onError: (msg: string) => void;
}

export function SettingsDataPrivacy({ onError }: SettingsDataPrivacyProps): JSX.Element {
  const user = useUserStore(s => s.user);
  const signOut = useUserStore(s => s.signOut);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  // Gather stores for new export system
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const goals = useGoalsStore(s => s.goals);
  const income = useFinanceStore(s => s.income);
  const expenses = useFinanceStore(s => s.expenses);
  const transactions = useFinanceStore(s => s.transactions);
  const bills = useFinanceStore(s => s.bills);
  const todayMetrics = useHealthStore(s => s.todayMetrics);
  const journalEntries = useJournalStore(s => s.entries);
  const tasks = useScheduleStore(s => s.tasks);

  const stores = useMemo(() => ({
    habits: { habits, logs: habitLogs },
    goals: { goals },
    finances: { income, expenses, transactions, bills },
    health: { todayMetrics },
    journal: { entries: journalEntries },
    schedule: { tasks },
  }), [habits, habitLogs, goals, income, expenses, transactions, bills, todayMetrics, journalEntries, tasks]);

  const stats = useMemo(() => getExportStats(stores), [stores]);
  const exportHistory = useMemo(() => getExportHistory(), [exporting]); // refresh after export

  const handleExport = () => {
    setExporting(true);
    try {
      const content = doExport(exportScope, exportFormat, stores);
      downloadExport(content, exportFormat, exportScope);
    } catch {
      onError('Export failed. Please try again.');
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    if (!user?.id) return;
    const tables = ['tasks', 'goals', 'events', 'habits', 'journal_entries', 'notes', 'income', 'expenses', 'bills', 'clients', 'inbox_items'];
    for (const table of tables) {
      await supabase.from(table).update({ is_deleted: true }).eq('user_id', user.id);
    }
    await signOut();
  };

  // Record count for selected scope
  const scopeCount = useMemo(() => {
    if (exportScope === 'all') return stats.habits + stats.goals + stats.tasks + stats.transactions + stats.healthEntries + stats.journalEntries;
    if (exportScope === 'habits') return stats.habits;
    if (exportScope === 'goals') return stats.goals + stats.tasks;
    if (exportScope === 'finances') return stats.transactions;
    if (exportScope === 'health') return stats.healthEntries;
    if (exportScope === 'journal') return stats.journalEntries;
    return 0;
  }, [exportScope, stats]);

  return (
    <>
      {/* Enhanced Data Export Section */}
      <section className="set-section">
        <div className="set-section-header">
          <Database size={18} />
          <h2>Export Your Data</h2>
        </div>

        {/* Early Adopter Banner */}
        <div style={{
          background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Sparkles size={14} style={{ color: '#D4AF37' }} />
          <span style={{ fontSize: 12, color: '#D4AF37', fontWeight: 500 }}>Early Adopter: Export is free!</span>
        </div>

        {/* Scope Selector */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Scope</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SCOPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setExportScope(opt.value)}
                style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: exportScope === opt.value ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: exportScope === opt.value ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: exportScope === opt.value ? '#00D4FF' : 'rgba(255,255,255,0.6)',
                  fontWeight: exportScope === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Record preview */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
          {scopeCount} records will be exported
        </p>

        {/* Format Toggle */}
        <div className="set-export-format">
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Format:</label>
          <div className="set-format-btns">
            <button className={`set-format-btn ${exportFormat === 'json' ? 'active' : ''}`}
              onClick={() => setExportFormat('json')}>JSON</button>
            <button className={`set-format-btn ${exportFormat === 'csv' ? 'active' : ''}`}
              onClick={() => setExportFormat('csv')}>CSV</button>
          </div>
        </div>

        <button className="set-export-btn" onClick={handleExport} disabled={exporting}>
          {exporting ? <><Loader2 size={14} className="spin" /> Exporting...</> :
           <><Download size={14} /> Export {exportScope === 'all' ? 'All' : exportScope} as {exportFormat.toUpperCase()}</>}
        </button>

        {/* Export History */}
        {exportHistory.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Clock size={10} /> Recent Exports
            </span>
            {exportHistory.map((entry, i) => (
              <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                {new Date(entry.date).toLocaleDateString()} - {entry.scope} ({entry.format.toUpperCase()}, {(entry.size / 1024).toFixed(1)}KB)
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="set-section set-danger-zone" style={{ marginTop: 16, borderColor: 'rgba(244,63,94,0.25)' }}>
        <div className="set-section-header">
          <Shield size={18} style={{ color: '#F43F5E' }} />
          <h2 style={{ color: '#F43F5E' }}>Danger Zone</h2>
        </div>
        <p className="set-section-desc" style={{ color: 'rgba(244,63,94,0.7)' }}>
          Irreversible actions. Proceed with caution.
        </p>

        {/* Sign Out */}
        <div style={{ marginBottom: 12 }}>
          <button className="set-signout-btn" onClick={() => signOut()}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Delete Account */}
        {!showDeleteConfirm ? (
          <button className="set-delete-btn" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={14} /> Delete Account
          </button>
        ) : (
          <div className="set-delete-confirm">
            <p className="set-delete-warning">
              <AlertTriangle size={16} /> This will soft-delete ALL your data. Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="set-delete-input-row">
              <input type="text" placeholder='Type "DELETE"' value={deleteText}
                onChange={e => setDeleteText(e.target.value)} />
              <button className="set-delete-confirm-btn" disabled={deleteText !== 'DELETE'}
                onClick={handleDeleteAccount}>
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}