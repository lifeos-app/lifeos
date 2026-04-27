/**
 * NLQueryResult — Renders a QueryResult as a glass card
 *
 * Shows the question, answer text, and optional chart/table visualization.
 * Uses text-based charting (no chart library needed).
 */

import type { QueryResult } from '../lib/nl-query-engine';

interface NLQueryResultProps {
  result: QueryResult;
}

export function NLQueryResult({ result }: NLQueryResultProps) {
  const { answer, question, confidence, chartType, data } = result;

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '8px',
        color: '#e2e8f0',
      }}
    >
      {/* Question header */}
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
        {question}
      </div>

      {/* Main answer */}
      <div style={{
        fontSize: '0.875rem',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        marginBottom: chartType && data && data.length > 0 ? '12px' : '0',
      }}>
        {answer}
      </div>

      {/* Visualization */}
      {chartType === 'stat' && data && data.length === 1 && renderStat(data[0])}
      {(chartType === 'line' || chartType === 'bar') && data && data.length > 0 && renderBarChart(data)}
      {chartType === 'table' && data && data.length > 0 && renderTable(data)}

      {/* Confidence indicator (low-confidence notice) */}
      {confidence < 0.5 && confidence > 0 && (
        <div style={{
          fontSize: '0.7rem',
          color: '#f97316',
          marginTop: '8px',
          fontStyle: 'italic',
        }}>
          ⚠️ Low confidence answer — consider rephrasing for better results
        </div>
      )}
    </div>
  );
}

/** Render a big number stat card */
function renderStat(item: Record<string, unknown>) {
  // Find the most prominent numeric value
  const keys = Object.keys(item);
  let label = '';
  let value: string | number = '';

  for (const key of keys) {
    const v = item[key];
    if (typeof v === 'number' && key !== 'count') {
      value = Number.isInteger(v) ? v.toString() : v.toFixed(1);
      label = key.replace(/_/g, ' ');
      break;
    }
  }

  if (!value) {
    // Fallback: just stringify
    value = JSON.stringify(item);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
    }}>
      <div style={{
        fontSize: '2rem',
        fontWeight: 700,
        color: '#00D4FF',
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      {label && (
        <div style={{
          fontSize: '0.75rem',
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

/** Render a simple text-based bar chart */
function renderBarChart(data: Record<string, unknown>[]) {
  if (data.length === 0) return null;

  // Find the label and value fields
  const labelKey = data[0].label !== undefined ? 'label' : (data[0].date !== undefined ? 'date' : Object.keys(data[0]).find(k => typeof data[0][k] === 'string') || 'label');
  const valueKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'number') || 'value';

  const values = data.map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values.map(Math.abs), 1);
  const maxBarWidth = 16;

  return (
    <div style={{
      fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: '0.75rem',
      lineHeight: '1.6',
      color: '#cbd5e1',
      padding: '4px 0',
    }}>
      {data.slice(0, 10).map((d, i) => {
        const label = String(d[labelKey] || '').slice(0, 10).padEnd(10);
        const val = values[i];
        const width = Math.round((Math.abs(val) / maxVal) * maxBarWidth);
        const bar = '█'.repeat(Math.max(width, 1));
        const color = val >= 7 ? '#22c55e' : val >= 5 ? '#eab308' : '#ef4444';

        return (
          <div key={i} style={{ display: 'flex', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>{label}</span>
            <span style={{ color }}>{bar}</span>
            <span style={{ color: '#94a3b8' }}>{typeof val === 'number' ? val.toFixed(val % 1 === 0 ? 0 : 1) : val}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Render a simple HTML table */
function renderTable(data: Record<string, unknown>[]) {
  if (data.length === 0) return null;

  // Get all unique keys across all items
  const allKeys = new Set<string>();
  data.forEach(d => Object.keys(d).forEach(k => allKeys.add(k)));
  const keys = Array.from(allKeys).slice(0, 5); // max 5 columns

  return (
    <div style={{ overflowX: 'auto', marginTop: '4px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.75rem',
      }}>
        <thead>
          <tr>
            {keys.map(key => (
              <th key={key} style={{
                padding: '4px 8px',
                textAlign: 'left',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: '0.65rem',
                letterSpacing: '0.05em',
              }}>
                {key.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, i) => (
            <tr key={i}>
              {keys.map(key => (
                <td key={key} style={{
                  padding: '4px 8px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#e2e8f0',
                }}>
                  {formatCellValue(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCellValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  if (typeof val === 'string') return val.length > 30 ? val.slice(0, 27) + '...' : val;
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}