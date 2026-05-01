/**
 * SettingsDataPrivacy — Data export and Danger Zone (delete account)
 * Gated behind Pro feature 'data_export' for free-tier users.
 */
import { useState, type JSX } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useProFeatureCheck } from '../../hooks/useProFeatureCheck';
import { ProGateOverlay } from '../../components/ProGateOverlay';
import {
  Database, Download, Loader2, Shield, Trash2, AlertTriangle, LogOut,
} from 'lucide-react';

interface SettingsDataPrivacyProps {
  onError: (msg: string) => void;
}

export function SettingsDataPrivacy({ onError }: SettingsDataPrivacyProps): JSX.Element {
  const user = useUserStore(s => s.user);
  const signOut = useUserStore(s => s.signOut);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  const dataExportGate = useProFeatureCheck('data_export');

  const exportData = async () => {
    if (!user?.id) return;
    if (!dataExportGate.canUse) return;
    setExporting(true);
    try {
      const tables = ['tasks', 'goals', 'schedule_events', 'habits', 'journal_entries', 'notes', 'income', 'expenses', 'bills', 'clients', 'inbox_items'];
      const allData: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('user_id', user.id).eq('is_deleted', false);
        if (data && data.length > 0) allData[table] = data;
      }
      let blob: Blob;
      let filename: string;
      if (exportFormat === 'json') {
        blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        filename = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        let csvContent = '';
        for (const [table, rows] of Object.entries(allData)) {
          if (rows.length === 0) continue;
          csvContent += `\n\n=== ${table.toUpperCase()} ===\n`;
          const headers = Object.keys(rows[0] as Record<string, unknown>);
          csvContent += headers.join(',') + '\n';
          for (const row of rows) {
            const values = headers.map(h => {
              const val = (row as Record<string, unknown>)[h];
              const str = val === null || val === undefined ? '' : String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            });
            csvContent += values.join(',') + '\n';
          }
        }
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = `lifeos-export-${new Date().toISOString().slice(0, 10)}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
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

  return (
    <>
      {/* Data Export Section */}
      <section className="set-section">
        <div className="set-section-header">
          <Database size={18} />
          <h2>Data & Privacy</h2>
        </div>

        {!dataExportGate.canUse ? (
          <ProGateOverlay
            feature="data_export"
            earlyAdopterFree={dataExportGate.earlyAdopterFree}
          />
        ) : (
          <>
            <p className="set-section-desc">Export all your data for backup or portability.</p>
            <div className="set-export-format">
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Format:</label>
              <div className="set-format-btns">
                <button className={`set-format-btn ${exportFormat === 'json' ? 'active' : ''}`}
                  onClick={() => setExportFormat('json')}>JSON</button>
                <button className={`set-format-btn ${exportFormat === 'csv' ? 'active' : ''}`}
                  onClick={() => setExportFormat('csv')}>CSV</button>
              </div>
            </div>
            <button className="set-export-btn" onClick={exportData} disabled={exporting}>
              {exporting ? <><Loader2 size={14} className="spin" /> Exporting...</> :
               <><Download size={14} /> Export as {exportFormat.toUpperCase()}</>}
            </button>
          </>
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