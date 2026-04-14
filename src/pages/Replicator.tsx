import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Upload, Plus, ArrowLeft, Search, Filter } from 'lucide-react';
import { usePartsStore, type PartItem } from '../stores/usePartsStore';
import { FileUploader } from '../components/parts/FileUploader';
import { ColumnMapper } from '../components/parts/ColumnMapper';
import { PartsTable } from '../components/parts/PartsTable';
import { PartForm } from '../components/parts/PartForm';

type View = 'table' | 'upload' | 'mapping';

export default function Replicator() {
  const { items, loading, fetchAll, addItem, updateItem, deleteItem, bulkInsert } = usePartsStore();
  const [view, setView] = useState<View>('table');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<PartItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [items]);

  const handleFileParsed = useCallback((headers: string[], rows: Record<string, string>[]) => {
    setParsedHeaders(headers);
    setParsedRows(rows);
    setView('mapping');
  }, []);

  const handleMappingConfirmed = useCallback(async (mappedItems: Partial<PartItem>[]) => {
    setImporting(true);
    setImportResult(null);
    try {
      const count = await bulkInsert(mappedItems);
      setImportResult(`Successfully imported ${count} items`);
      setView('table');
      setParsedHeaders([]);
      setParsedRows([]);
    } catch (e) {
      setImportResult('Import failed');
    } finally {
      setImporting(false);
    }
  }, [bulkInsert]);

  const handleAddItem = useCallback(async (data: Partial<PartItem>) => {
    await addItem(data);
    setFormOpen(false);
  }, [addItem]);

  const handleEditItem = useCallback(async (data: Partial<PartItem>) => {
    if (editItem) {
      await updateItem(editItem.id, data);
      setEditItem(null);
    }
  }, [editItem, updateItem]);

  const handleEdit = useCallback((item: PartItem) => {
    setEditItem(item);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteItem(id);
  }, [deleteItem]);

  return (
    <div role="main" aria-label="Digital Replicator" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view !== 'table' && (
            <button
              onClick={() => setView('table')}
              aria-label="Back to parts table"
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                color: '#8BA4BE', padding: 6, borderRadius: 6,
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={22} style={{ color: '#10B981' }} />
          </div>
          <div>
            <h1 style={{ color: '#E2E8F0', fontSize: 24, margin: 0, fontWeight: 700 }}>
              Digital Replicator
            </h1>
            <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>
              Upload and manage your parts inventory
            </p>
          </div>
        </div>

        {view === 'table' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setView('upload')}
              aria-label="Import file"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                color: '#10B981', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              <Upload size={16} />
              Import File
            </button>
            <button
              onClick={() => setFormOpen(true)}
              aria-label="Add new part"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                transition: 'all 0.2s',
              }}
            >
              <Plus size={16} />
              Add Part
            </button>
          </div>
        )}
      </div>

      {/* Import result toast */}
      {importResult && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
            background: importResult.includes('fail') ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: importResult.includes('fail') ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)',
            backdropFilter: 'blur(12px)',
            color: importResult.includes('fail') ? '#EF4444' : '#10B981',
            fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          {importResult}
          <button
            onClick={() => setImportResult(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Importing overlay */}
      {importing && (
        <div style={{
          padding: 40, textAlign: 'center', color: '#10B981', fontSize: 16,
        }}>
          Importing items...
        </div>
      )}

      {/* Views */}
      {!importing && view === 'table' && (
        loading && items.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div role="status" style={{
            padding: '80px 40px', textAlign: 'center',
            background: 'rgba(17,24,39,0.6)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}>
            <Package size={48} style={{ color: '#1E2A3A', marginBottom: 16 }} />
            <h3 style={{ color: '#E2E8F0', fontSize: 18, marginBottom: 8 }}>No parts yet</h3>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
              Import a CSV, XLSX, or JSON file to get started, or add parts manually.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                onClick={() => setView('upload')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 24px', borderRadius: 8,
                  background: '#10B981', border: 'none',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                <Upload size={16} />
                Import File
              </button>
              <button
                onClick={() => setFormOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 24px', borderRadius: 8,
                  background: 'transparent', border: '1px solid #1E2A3A',
                  color: '#8BA4BE', cursor: 'pointer', fontSize: 14,
                }}
              >
                <Plus size={16} />
                Add Manually
              </button>
            </div>
          </div>
        ) : (
          <PartsTable items={items} onEdit={handleEdit} onDelete={handleDelete} />
        )
      )}

      {!importing && view === 'upload' && (
        <FileUploader onParsed={handleFileParsed} onCancel={() => setView('table')} />
      )}

      {!importing && view === 'mapping' && (
        <ColumnMapper
          headers={parsedHeaders}
          rows={parsedRows}
          onConfirm={handleMappingConfirmed}
          onCancel={() => setView('table')}
        />
      )}

      {/* Add/Edit modal */}
      {(formOpen || editItem) && (
        <PartForm
          item={editItem}
          existingCategories={categories}
          onSubmit={editItem ? handleEditItem : handleAddItem}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
