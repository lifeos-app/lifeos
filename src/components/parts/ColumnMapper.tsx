import { useState, useMemo } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { PartItem } from '../../stores/usePartsStore';

interface ColumnMapperProps {
  headers: string[];
  rows: Record<string, string>[];
  onConfirm: (items: Partial<PartItem>[]) => void;
  onCancel: () => void;
}

const SCHEMA_FIELDS = [
  { key: 'name', label: 'Name', aliases: ['name', 'part_name', 'item', 'title', 'product', 'item_name'] },
  { key: 'description', label: 'Description', aliases: ['description', 'desc', 'details', 'detail'] },
  { key: 'category', label: 'Category', aliases: ['category', 'cat', 'type', 'group', 'class'] },
  { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty', 'count', 'amount', 'stock', 'on_hand'] },
  { key: 'unit_price', label: 'Unit Price', aliases: ['price', 'unit_price', 'cost', 'unit_cost', 'value'] },
  { key: 'location', label: 'Location', aliases: ['location', 'loc', 'bin', 'shelf', 'warehouse', 'storage'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'vendor', 'manufacturer', 'mfg', 'brand'] },
  { key: 'sku', label: 'SKU', aliases: ['sku', 'part_number', 'part_no', 'pn', 'model', 'upc', 'barcode', 'item_number'] },
  { key: 'condition', label: 'Condition', aliases: ['condition', 'state'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'comments', 'remarks', 'memo'] },
  { key: 'image_url', label: 'Image URL', aliases: ['image', 'image_url', 'photo', 'picture', 'img'] },
];

const FIELD_OPTIONS = [
  { value: 'skip', label: 'Skip' },
  ...SCHEMA_FIELDS.map(f => ({ value: f.key, label: f.label })),
  { value: '_custom', label: 'Custom Field' },
];

function autoDetect(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  for (const field of SCHEMA_FIELDS) {
    if (field.aliases.some(a => normalized === a || normalized.includes(a))) {
      return field.key;
    }
  }
  return 'skip';
}

export function ColumnMapper({ headers, rows, onConfirm, onCancel }: ColumnMapperProps) {
  const initialMapping = useMemo(() => {
    const m: Record<string, string> = {};
    const used = new Set<string>();
    for (const h of headers) {
      const detected = autoDetect(h);
      if (detected !== 'skip' && !used.has(detected)) {
        m[h] = detected;
        used.add(detected);
      } else {
        m[h] = 'skip';
      }
    }
    return m;
  }, [headers]);

  const [mapping, setMapping] = useState(initialMapping);
  const previewRows = rows.slice(0, 5);
  const mappedCount = Object.values(mapping).filter(v => v !== 'skip').length;

  const handleConfirm = () => {
    const items: Partial<PartItem>[] = rows.map(row => {
      const item: Partial<PartItem> = {};
      const customFields: Record<string, unknown> = {};

      for (const [header, target] of Object.entries(mapping)) {
        if (target === 'skip' || !row[header]) continue;
        const val = String(row[header]).trim();
        if (!val) continue;

        if (target === '_custom') {
          customFields[header] = val;
        } else if (target === 'quantity') {
          (item as any)[target] = parseInt(val) || 0;
        } else if (target === 'unit_price') {
          (item as any)[target] = parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
        } else {
          (item as any)[target] = val;
        }
      }

      if (Object.keys(customFields).length > 0) {
        item.custom_fields = customFields;
      }
      return item;
    });

    // Filter out items without a name
    const valid = items.filter(i => i.name && i.name.trim());
    onConfirm(valid.length > 0 ? valid : items);
  };

  const handleMappingChange = (header: string, value: string) => {
    setMapping(prev => ({ ...prev, [header]: value }));
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <h3 style={{ color: '#E2E8F0', fontSize: 18, marginBottom: 4 }}>
        Map Columns to Fields
      </h3>
      <p style={{ color: '#64748B', fontSize: 13, marginBottom: 24 }}>
        We found <strong style={{ color: '#10B981' }}>{rows.length}</strong> rows
        with <strong style={{ color: '#10B981' }}>{headers.length}</strong> columns.
        Map each column to a field or skip it.
      </p>

      {/* Column mapping */}
      <div style={{
        background: '#141824', borderRadius: 12,
        border: '1px solid #1E2A3A', overflow: 'hidden', marginBottom: 24,
      }}>
        {headers.map((header, i) => (
          <div
            key={header}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: i < headers.length - 1 ? '1px solid rgba(30,42,58,0.5)' : 'none',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>{header}</div>
              <div style={{ color: '#64748B', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {previewRows.slice(0, 3).map(r => r[header] || '—').join(' · ')}
              </div>
            </div>
            <ArrowRight size={16} style={{ color: '#475569', flexShrink: 0 }} />
            <select
              value={mapping[header]}
              onChange={(e) => handleMappingChange(header, e.target.value)}
              style={{
                width: 160, padding: '6px 10px', borderRadius: 6,
                background: '#0B0E17', border: '1px solid #1E2A3A',
                color: mapping[header] === 'skip' ? '#64748B' : '#10B981',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {FIELD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Preview table */}
      <h4 style={{ color: '#8BA4BE', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 }}>
        Preview (first {previewRows.length} rows)
      </h4>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: '#141824', borderRadius: 8,
          fontSize: 12,
        }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left',
                  color: '#8BA4BE', fontWeight: 500,
                  borderBottom: '1px solid #1E2A3A',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                {headers.map(h => (
                  <td key={h} style={{
                    padding: '6px 12px', color: '#CBD5E1',
                    borderBottom: i < previewRows.length - 1 ? '1px solid rgba(30,42,58,0.3)' : 'none',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row[h] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 24px', borderRadius: 8,
            background: 'transparent', border: '1px solid #1E2A3A',
            color: '#8BA4BE', cursor: 'pointer', fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={mappedCount === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 24px', borderRadius: 8,
            background: mappedCount > 0 ? '#10B981' : '#1E2A3A',
            border: 'none',
            color: mappedCount > 0 ? '#fff' : '#64748B',
            cursor: mappedCount > 0 ? 'pointer' : 'default',
            fontSize: 14, fontWeight: 500,
          }}
        >
          <Check size={16} />
          Import {rows.length} Items ({mappedCount} fields mapped)
        </button>
      </div>
    </div>
  );
}
