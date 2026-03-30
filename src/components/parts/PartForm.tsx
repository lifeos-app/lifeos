import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { PartItem, PartCondition } from '../../stores/usePartsStore';

interface PartFormProps {
  item?: PartItem | null;
  existingCategories: string[];
  onSubmit: (data: Partial<PartItem>) => void;
  onClose: () => void;
}

const CONDITIONS: PartCondition[] = ['new', 'good', 'used', 'refurbished', 'damaged'];

export function PartForm({ item, existingCategories, onSubmit, onClose }: PartFormProps) {
  const [name, setName] = useState(item?.name || '');
  const [sku, setSku] = useState(item?.sku || '');
  const [category, setCategory] = useState(item?.category || '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 0);
  const [unitPrice, setUnitPrice] = useState(item?.unit_price ?? 0);
  const [location, setLocation] = useState(item?.location || '');
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [condition, setCondition] = useState<string>(item?.condition || 'new');
  const [notes, setNotes] = useState(item?.notes || '');
  const [tagsStr, setTagsStr] = useState(item?.tags?.join(', ') || '');

  const isEdit = !!item;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

    onSubmit({
      name: name.trim(),
      sku: sku.trim() || null,
      category: category.trim() || null,
      quantity,
      unit_price: unitPrice,
      location: location.trim() || null,
      supplier: supplier.trim() || null,
      condition,
      notes: notes.trim() || null,
      tags,
    });
  };

  const labelStyle: React.CSSProperties = {
    color: '#8BA4BE', fontSize: 12, fontWeight: 500,
    textTransform: 'uppercase', marginBottom: 4, display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    background: '#0B0E17', border: '1px solid #1E2A3A',
    color: '#E2E8F0', fontSize: 14, outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#141824', borderRadius: 12,
        border: '1px solid #1E2A3A',
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        overflow: 'auto', padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: '#E2E8F0', fontSize: 18, margin: 0 }}>
            {isEdit ? 'Edit Part' : 'Add Part'}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B',
          }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Part name" required />
            </div>
            <div>
              <label style={labelStyle}>SKU</label>
              <input value={sku} onChange={e => setSku(e.target.value)} style={inputStyle} placeholder="Part number" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Electronics"
                list="cat-suggestions"
              />
              {existingCategories.length > 0 && (
                <datalist id="cat-suggestions">
                  {existingCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              )}
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number" value={quantity} min={0}
                onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Unit Price</label>
              <input
                type="number" value={unitPrice} min={0} step={0.01}
                onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} placeholder="Bin / shelf" />
            </div>
            <div>
              <label style={labelStyle}>Supplier</label>
              <input value={supplier} onChange={e => setSupplier(e.target.value)} style={inputStyle} placeholder="Vendor name" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Condition</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: 13,
                      border: condition === c ? '1px solid #10B981' : '1px solid #1E2A3A',
                      background: condition === c ? 'rgba(16,185,129,0.1)' : 'transparent',
                      color: condition === c ? '#10B981' : '#8BA4BE',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Additional notes..."
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} style={inputStyle} placeholder="e.g. urgent, fragile" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: 'transparent', border: '1px solid #1E2A3A',
                color: '#8BA4BE', cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: name.trim() ? '#10B981' : '#1E2A3A',
                border: 'none',
                color: name.trim() ? '#fff' : '#64748B',
                cursor: name.trim() ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 500,
              }}
            >
              {isEdit ? 'Save Changes' : 'Add Part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
