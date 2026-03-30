import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface FileUploaderProps {
  onParsed: (headers: string[], rows: Record<string, string>[]) => void;
  onCancel: () => void;
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          resolve({
            headers: result.meta.fields || [],
            rows: result.data as Record<string, string>[],
          });
        },
        error: (err: any) => reject(err),
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    const headers = Object.keys(jsonRows[0] || {});
    return { headers, rows: jsonRows };
  }

  if (ext === 'json') {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
    if (data.length === 0) throw new Error('JSON array is empty');
    const headers = Object.keys(data[0]);
    return { headers, rows: data };
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

export function FileUploader({ onParsed, onCancel }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; rows: number; cols: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setParsing(true);
    setFileInfo(null);
    try {
      const { headers, rows } = await parseFile(file);
      if (rows.length === 0) throw new Error('File contains no data rows');
      setFileInfo({ name: file.name, rows: rows.length, cols: headers.length });
      onParsed(headers, rows);
    } catch (e: any) {
      setError(e.message || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#10B981' : '#1E2A3A'}`,
          borderRadius: 12,
          padding: '60px 40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(16,185,129,0.05)' : '#141824',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {parsing ? (
          <>
            <FileSpreadsheet size={48} style={{ color: '#10B981', marginBottom: 16 }} />
            <p style={{ color: '#CBD5E1', fontSize: 16 }}>Parsing file...</p>
          </>
        ) : (
          <>
            <Upload size={48} style={{ color: '#64748B', marginBottom: 16 }} />
            <p style={{ color: '#CBD5E1', fontSize: 16, marginBottom: 8 }}>
              Drop your inventory file here, or click to browse
            </p>
            <p style={{ color: '#64748B', fontSize: 13 }}>
              Supports CSV, XLSX, XLS, and JSON
            </p>
          </>
        )}
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)', borderRadius: 8,
          color: '#EF4444', fontSize: 14,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {fileInfo && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(16,185,129,0.1)', borderRadius: 8,
          color: '#10B981', fontSize: 14,
        }}>
          Parsed <strong>{fileInfo.name}</strong>: {fileInfo.rows} rows, {fileInfo.cols} columns
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 24px', borderRadius: 8,
            background: 'transparent', border: '1px solid #1E2A3A',
            color: '#8BA4BE', cursor: 'pointer', fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
