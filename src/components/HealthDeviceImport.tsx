/**
 * HealthDeviceImport.tsx — UI for importing health data from device files
 *
 * P7-022: Provides drag-and-drop file upload, format auto-detection,
 * data preview, validation summary, and import history display.
 */

import { useState, useCallback, useRef, type JSX } from 'react';
import {
  Upload, FileCheck, AlertCircle, Watch, Smartphone, Activity,
  Loader2, Trash2, ChevronDown, X,
} from 'lucide-react';
import {
  HealthDataImport,
  detectFileType,
  validateRecords,
  transformForStore,
  getImportHistory,
  clearImportHistory,
  type HealthRecord,
  type DeviceId,
  type FileType,
  type DeviceMetadata,
} from '../lib/health-device-import';
import { logger } from '../utils/logger';

const DEVICE_OPTIONS: { id: DeviceId; label: string; icon: typeof Watch }[] = [
  { id: 'apple_watch', label: 'Apple Watch', icon: Watch },
  { id: 'fitbit', label: 'Fitbit', icon: Activity },
  { id: 'garmin', label: 'Garmin', icon: Watch },
  { id: 'google_fit', label: 'Google Fit', icon: Smartphone },
  { id: 'samsung_health', label: 'Samsung Health', icon: Smartphone },
  { id: 'oura', label: 'Oura', icon: Activity },
  { id: 'whoop', label: 'Whoop', icon: Activity },
  { id: 'manual', label: 'Manual Entry', icon: Upload },
];

const FORMAT_BADGES: Record<FileType, { label: string; color: string }> = {
  csv: { label: 'CSV', color: '#22C55E' },
  apple_health_xml: { label: 'Apple Health XML', color: '#A855F7' },
  google_fit_json: { label: 'Google Fit JSON', color: '#3B82F6' },
};

export function HealthDeviceImport(): JSX.Element {
  const importer = useRef(new HealthDataImport()).current;

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [detectedFormat, setDetectedFormat] = useState<FileType | null>(null);
  const [parsedRecords, setParsedRecords] = useState<HealthRecord[]>([]);
  const [deviceId, setDeviceId] = useState<DeviceId>('manual');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<DeviceMetadata[]>(getImportHistory());
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state
  const reset = useCallback(() => {
    setFile(null);
    setFileContent('');
    setDetectedFormat(null);
    setParsedRecords([]);
    setImporting(false);
    setImportProgress(0);
    setImportTotal(0);
    setImported(false);
    setError(null);
  }, []);

  // Process a file
  const processFile = useCallback((f: File, content: string) => {
    setFile(f);
    setFileContent(content);
    setImported(false);
    setError(null);

    const format = detectFileType(content, f.name);
    setDetectedFormat(format);

    try {
      let records: HealthRecord[];
      switch (format) {
        case 'apple_health_xml':
          records = importer.parseAppleHealthXML(content, deviceId);
          break;
        case 'google_fit_json':
          records = importer.parseGoogleFitJSON(content, deviceId);
          break;
        default:
          records = importer.parseCSV(content, deviceId);
      }
      setParsedRecords(records);
    } catch (err) {
      logger.error('[health-import] Parse error:', err);
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setParsedRecords([]);
    }
  }, [importer, deviceId]);

  // Handle file selection
  const handleFileSelect = useCallback(async (f: File) => {
    try {
      const text = await f.text();
      processFile(f, text);
    } catch (err) {
      setError('Failed to read file');
    }
  }, [processFile]);

  // Handle file input change
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  // Handle drag and drop
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Re-parse when device changes
  const reparseWithDevice = useCallback((newDeviceId: DeviceId) => {
    setDeviceId(newDeviceId);
    setShowDeviceDropdown(false);
    if (fileContent && detectedFormat) {
      try {
        let records: HealthRecord[];
        switch (detectedFormat) {
          case 'apple_health_xml':
            records = importer.parseAppleHealthXML(fileContent, newDeviceId);
            break;
          case 'google_fit_json':
            records = importer.parseGoogleFitJSON(fileContent, newDeviceId);
            break;
          default:
            records = importer.parseCSV(fileContent, newDeviceId);
        }
        setParsedRecords(records);
      } catch (err) {
        setError(`Re-parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [fileContent, detectedFormat, importer]);

  // Import records
  const handleImport = useCallback(async () => {
    if (parsedRecords.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    setImportTotal(parsedRecords.length);
    setError(null);

    try {
      const { valid } = validateRecords(parsedRecords);
      if (valid.length === 0) {
        setError('No valid records to import');
        setImporting(false);
        return;
      }

      // Simulate progress by importing in small batches
      let imported = 0;
      const batchSize = 10;
      for (let i = 0; i < valid.length; i += batchSize) {
        const batch = valid.slice(i, i + batchSize);
        for (const rec of batch) {
          const { healthEntries } = transformForStore([rec]);
          // Import via localInsert (the class method does this too)
          const { localInsert: dbInsert } = await import('../lib/local-db');
          const { getEffectiveUserId } = await import('../lib/local-db');
          const userId = getEffectiveUserId();
          for (const entry of healthEntries) {
            await dbInsert('health_metrics', { ...entry, user_id: userId });
          }
          imported++;
        }
        setImportProgress(Math.min(imported, valid.length));
        // Small delay for visual feedback
        await new Promise(r => setTimeout(r, 50));
      }

      // Save import history
      const { saveImportHistory } = await import('../lib/health-device-import');
      saveImportHistory(deviceId, imported);

      setImportProgress(valid.length);
      setImported(true);
      setHistory(getImportHistory());
    } catch (err) {
      logger.error('[health-import] Import error:', err);
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  }, [parsedRecords, deviceId]);

  // Clear import history
  const handleClearHistory = useCallback(() => {
    clearImportHistory();
    setHistory([]);
  }, []);

  // Validation results
  const { valid, invalid } = parsedRecords.length > 0
    ? validateRecords(parsedRecords)
    : { valid: [] as HealthRecord[], invalid: [] as { record: Partial<HealthRecord>; error: string }[] };

  const selectedDeviceOption = DEVICE_OPTIONS.find(d => d.id === deviceId)!;

  return (
    <section className="set-section">
      {/* Header */}
      <div className="set-section-header">
        <Activity size={18} />
        <h2>Health Import</h2>
      </div>
      <p className="set-section-desc">
        Import health data from your devices. Upload CSV, Apple Health XML, or Google Fit JSON exports.
      </p>

      {/* Device selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
          Source Device
        </label>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(26,58,92,0.3)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-body)', minWidth: 200,
            }}
          >
            <selectedDeviceOption.icon size={14} />
            {selectedDeviceOption.label}
            <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </button>
          {showDeviceDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'var(--dark-surface, #1a2a3a)', border: '1px solid rgba(26,58,92,0.3)',
              borderRadius: 8, marginTop: 4, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              overflow: 'hidden',
            }}>
              {DEVICE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => reparseWithDevice(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                    background: deviceId === opt.id ? 'rgba(0,212,255,0.08)' : 'transparent',
                    border: 'none', color: deviceId === opt.id ? 'var(--cyan)' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
                    width: '100%', textAlign: 'left', borderBottom: '1px solid rgba(26,58,92,0.1)',
                  }}
                >
                  <opt.icon size={14} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !importing && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--cyan)' : imported ? 'rgba(34,197,94,0.4)' : 'rgba(26,58,92,0.4)'}`,
          borderRadius: 12, padding: '32px 20px', textAlign: 'center',
          cursor: importing ? 'wait' : 'pointer', transition: 'all 0.2s',
          background: dragOver ? 'rgba(0,212,255,0.04)' : imported ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.01)',
          marginBottom: 16,
        }}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.txt,.xml,.json" onChange={onFileChange}
          style={{ display: 'none' }} disabled={importing} />

        {imported ? (
          <>
            <FileCheck size={28} style={{ color: '#22C55E', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#22C55E', marginBottom: 4 }}>
              Import Complete
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {importProgress} record{importProgress !== 1 ? 's' : ''} imported successfully
            </div>
            <button onClick={(e) => { e.stopPropagation(); reset(); }}
              style={{
                marginTop: 12, padding: '6px 14px', borderRadius: 6,
                border: '1px solid rgba(26,58,92,0.3)', background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              Import Another File
            </button>
          </>
        ) : file ? (
          <>
            <FileCheck size={24} style={{ color: 'var(--cyan)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </>
        ) : (
          <>
            <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Drop a file here or click to browse
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Supports CSV, Apple Health XML, Google Fit JSON
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 8, color: '#F43F5E', fontSize: 13, marginBottom: 16,
        }}>
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#F43F5E', cursor: 'pointer', padding: 2,
          }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Format badge & validation summary */}
      {detectedFormat && !imported && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: `${FORMAT_BADGES[detectedFormat].color}20`,
            color: FORMAT_BADGES[detectedFormat].color,
            border: `1px solid ${FORMAT_BADGES[detectedFormat].color}30`,
          }}>
            {FORMAT_BADGES[detectedFormat].label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {valid.length} valid record{valid.length !== 1 ? 's' : ''}
          </span>
          {invalid.length > 0 && (
            <span style={{ fontSize: 12, color: '#F97316' }}>
              {invalid.length} invalid (skipped)
            </span>
          )}
        </div>
      )}

      {/* Data preview */}
      {parsedRecords.length > 0 && !imported && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Preview (first 5 rows)
          </div>
          <div style={{
            overflowX: 'auto', borderRadius: 8,
            border: '1px solid rgba(26,58,92,0.2)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Unit</th>
                  <th style={thStyle}>Source</th>
                </tr>
              </thead>
              <tbody>
                {parsedRecords.slice(0, 5).map((rec, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(26,58,92,0.1)' }}>
                    <td style={tdStyle}>{rec.date}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 3, fontSize: 10,
                        background: `${metricColor(rec.type)}15`, color: metricColor(rec.type),
                      }}>
                        {rec.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>{rec.value}</td>
                    <td style={tdStyle}>{rec.unit}</td>
                    <td style={tdStyle}>{rec.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRecords.length > 5 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
              ... and {parsedRecords.length - 5} more rows
            </div>
          )}
        </div>
      )}

      {/* Import button with progress */}
      {parsedRecords.length > 0 && !imported && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleImport}
            disabled={importing || valid.length === 0}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '10px 20px',
              background: importing ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.1)',
              border: `1px solid ${importing ? 'rgba(0,212,255,0.2)' : 'rgba(0,212,255,0.3)'}`,
              borderRadius: 10, color: 'var(--cyan)', fontFamily: 'var(--font-body)',
              fontSize: 13, fontWeight: 600, cursor: importing ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {importing ? (
              <>
                <Loader2 size={14} className="spin" />
                Importing... {importProgress}/{importTotal}
              </>
            ) : (
              <>
                <Upload size={14} />
                Import {valid.length} Record{valid.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
          {importing && (
            <div style={{
              marginTop: 8, height: 4, borderRadius: 4,
              background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4, background: 'var(--cyan)',
                width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%`,
                transition: 'width 0.2s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* Import history */}
      {history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Import History
            </div>
            <button onClick={handleClearHistory}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                background: 'none', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 4, color: '#F43F5E', fontSize: 10, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Trash2 size={10} /> Clear
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map(device => {
              const opt = DEVICE_OPTIONS.find(d => d.id === device.id);
              const Icon = opt?.icon || Activity;
              return (
                <div key={device.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(26,58,92,0.15)', borderRadius: 8,
                }}>
                  <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {device.name || device.id}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Last sync: {device.lastSync ? new Date(device.lastSync).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: 'rgba(0,212,255,0.08)', color: 'var(--cyan)',
                  }}>
                    {device.recordCount} records
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Style helpers ──

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid rgba(26,58,92,0.2)',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  color: 'var(--text-secondary)',
  fontSize: 11,
  whiteSpace: 'nowrap',
};

function metricColor(type: string): string {
  switch (type) {
    case 'heart_rate': return '#F43F5E';
    case 'steps': return '#22C55E';
    case 'sleep': return '#8B5CF6';
    case 'weight': return '#F97316';
    case 'blood_pressure': return '#EF4444';
    case 'blood_oxygen': return '#3B82F6';
    case 'calories': return '#EAB308';
    case 'water': return '#06B6D4';
    case 'exercise': return '#EC4899';
    default: return '#6B7280';
  }
}