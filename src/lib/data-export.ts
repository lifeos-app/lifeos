/**
 * Data Export — JSON + CSV export for all LifeOS data scopes
 *
 * Pro feature (free during early adopter mode).
 */

export type ExportFormat = 'json' | 'csv';
export type ExportScope = 'all' | 'habits' | 'goals' | 'finances' | 'health' | 'journal';

interface ExportStores {
  habits: { habits: unknown[]; logs: unknown[] };
  goals: { goals: unknown[] };
  finances: { income: unknown[]; expenses: unknown[]; transactions: unknown[]; bills: unknown[] };
  health: { todayMetrics: unknown | null };
  journal: { entries: unknown[] };
  schedule: { tasks: unknown[] };
}

export interface ExportStats {
  habits: number;
  goals: number;
  tasks: number;
  transactions: number;
  healthEntries: number;
  journalEntries: number;
}

export function getExportStats(stores: ExportStores): ExportStats {
  return {
    habits: stores.habits.habits.length,
    goals: stores.goals.goals.length,
    tasks: stores.schedule.tasks.length,
    transactions: stores.finances.income.length + stores.finances.expenses.length,
    healthEntries: stores.health.todayMetrics ? 1 : 0,
    journalEntries: stores.journal.entries.length,
  };
}

function getScopeData(scope: ExportScope, stores: ExportStores): Record<string, unknown[]> {
  const data: Record<string, unknown[]> = {};

  if (scope === 'all' || scope === 'habits') {
    data.habits = stores.habits.habits;
    data.habit_logs = stores.habits.logs;
  }
  if (scope === 'all' || scope === 'goals') {
    data.goals = stores.goals.goals;
    data.tasks = stores.schedule.tasks;
  }
  if (scope === 'all' || scope === 'finances') {
    data.income = stores.finances.income;
    data.expenses = stores.finances.expenses;
    data.transactions = stores.finances.transactions;
    data.bills = stores.finances.bills;
  }
  if (scope === 'all' || scope === 'health') {
    if (stores.health.todayMetrics) {
      data.health_metrics = [stores.health.todayMetrics];
    }
  }
  if (scope === 'all' || scope === 'journal') {
    data.journal_entries = stores.journal.entries;
  }

  return data;
}

function redactUserId(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(redactUserId);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'user_id') {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactUserId(value);
      }
    }
    return result;
  }
  return obj;
}

export function exportData(scope: ExportScope, format: ExportFormat, stores: ExportStores): string {
  const rawData = getScopeData(scope, stores);

  if (format === 'json') {
    const exportPayload = {
      _meta: {
        export_date: new Date().toISOString(),
        version: '1.19.78',
        scope,
        format: 'json',
      },
      ...redactUserId(rawData) as Record<string, unknown>,
    };
    return JSON.stringify(exportPayload, null, 2);
  }

  // CSV format
  let csv = '';
  for (const [table, rows] of Object.entries(rawData)) {
    if (!rows || rows.length === 0) continue;
    csv += `\n=== ${table.toUpperCase()} ===\n`;
    const firstRow = rows[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow).filter(h => h !== 'user_id');
    csv += headers.join(',') + '\n';
    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const values = headers.map(h => {
        const val = record[h];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      });
      csv += values.join(',') + '\n';
    }
  }
  return csv.trim();
}

export function downloadExport(content: string, format: ExportFormat, scope: ExportScope): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const ext = format;
  const filename = `lifeos-${scope}-${dateStr}.${ext}`;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Save to export history in localStorage
  try {
    const historyKey = 'lifeos_export_history';
    const raw = localStorage.getItem(historyKey);
    const history: Array<{ date: string; scope: string; format: string; size: number }> = raw ? JSON.parse(raw) : [];
    history.unshift({ date: new Date().toISOString(), scope, format, size: content.length });
    // Keep only last 3
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 3)));
  } catch { /* ignore */ }
}

export function getExportHistory(): Array<{ date: string; scope: string; format: string; size: number }> {
  try {
    const raw = localStorage.getItem('lifeos_export_history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
