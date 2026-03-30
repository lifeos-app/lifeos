import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Edit3, Trash2 } from 'lucide-react';
import type { PartItem } from '../../stores/usePartsStore';

interface PartsTableProps {
  items: PartItem[];
  onEdit: (item: PartItem) => void;
  onDelete: (id: string) => void;
}

type SortKey = 'name' | 'quantity' | 'unit_price' | 'category' | 'created_at';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export function PartsTable({ items, onEdit, onDelete }: PartsTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }

    result.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [items, search, categoryFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalValue = useMemo(() =>
    items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0),
    [items]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 2 }} />
      : <ChevronDown size={12} style={{ marginLeft: 2 }} />;
  };

  const thStyle = (col: SortKey): React.CSSProperties => ({
    padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
    color: sortKey === col ? '#10B981' : '#8BA4BE',
    fontWeight: 500, fontSize: 12, textTransform: 'uppercase',
    borderBottom: '1px solid #1E2A3A', whiteSpace: 'nowrap',
    userSelect: 'none',
  });

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ color: '#8BA4BE', fontSize: 13 }}>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{items.length}</span> items
        </div>
        <div style={{ color: '#8BA4BE', fontSize: 13 }}>
          Total value: <span style={{ color: '#10B981', fontWeight: 600 }}>${totalValue.toFixed(2)}</span>
        </div>
        <div style={{ color: '#8BA4BE', fontSize: 13 }}>
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{categories.length}</span> categories
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#141824', border: '1px solid #1E2A3A',
          borderRadius: 8, padding: '0 12px', flex: '1 1 200px', maxWidth: 400,
        }}>
          <Search size={16} style={{ color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search parts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#E2E8F0', fontSize: 14, padding: '10px 0', width: '100%',
            }}
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            style={{
              padding: '8px 12px', borderRadius: 8,
              background: '#141824', border: '1px solid #1E2A3A',
              color: categoryFilter ? '#10B981' : '#8BA4BE',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: '#141824', borderRadius: 8,
          border: '1px solid #1E2A3A',
        }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={thStyle('name')}>
                Name <SortIcon col="name" />
              </th>
              <th style={{ ...thStyle('name'), cursor: 'default', color: '#8BA4BE' }}>SKU</th>
              <th onClick={() => handleSort('category')} style={thStyle('category')}>
                Category <SortIcon col="category" />
              </th>
              <th onClick={() => handleSort('quantity')} style={{ ...thStyle('quantity'), textAlign: 'right' }}>
                Qty <SortIcon col="quantity" />
              </th>
              <th onClick={() => handleSort('unit_price')} style={{ ...thStyle('unit_price'), textAlign: 'right' }}>
                Price <SortIcon col="unit_price" />
              </th>
              <th style={{ ...thStyle('name'), cursor: 'default', color: '#8BA4BE' }}>Location</th>
              <th style={{ ...thStyle('name'), cursor: 'default', color: '#8BA4BE' }}>Supplier</th>
              <th style={{ ...thStyle('name'), cursor: 'default', color: '#8BA4BE' }}>Condition</th>
              <th style={{ ...thStyle('name'), cursor: 'default', color: '#8BA4BE', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                  {search || categoryFilter ? 'No items match your search' : 'No items yet'}
                </td>
              </tr>
            ) : paged.map(item => (
              <tr
                key={item.id}
                style={{ borderBottom: '1px solid rgba(30,42,58,0.5)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 12px', color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>
                  {item.name}
                </td>
                <td style={{ padding: '10px 12px', color: '#8BA4BE', fontSize: 13, fontFamily: 'monospace' }}>
                  {item.sku || '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {item.category ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(16,185,129,0.1)', color: '#10B981',
                      fontSize: 12,
                    }}>
                      {item.category}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '10px 12px', color: '#E2E8F0', fontSize: 14, textAlign: 'right' }}>
                  {item.quantity}
                </td>
                <td style={{ padding: '10px 12px', color: '#E2E8F0', fontSize: 14, textAlign: 'right' }}>
                  {item.unit_price > 0 ? `$${item.unit_price.toFixed(2)}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', color: '#8BA4BE', fontSize: 13 }}>
                  {item.location || '—'}
                </td>
                <td style={{ padding: '10px 12px', color: '#8BA4BE', fontSize: 13 }}>
                  {item.supplier || '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: item.condition === 'new' ? 'rgba(16,185,129,0.1)' :
                      item.condition === 'damaged' ? 'rgba(239,68,68,0.1)' : 'rgba(139,164,190,0.1)',
                    color: item.condition === 'new' ? '#10B981' :
                      item.condition === 'damaged' ? '#EF4444' : '#8BA4BE',
                  }}>
                    {item.condition}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => onEdit(item)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#8BA4BE', padding: 4, marginRight: 4,
                    }}
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: deleteConfirm === item.id ? '#EF4444' : '#8BA4BE', padding: 4,
                    }}
                    title={deleteConfirm === item.id ? 'Click again to confirm' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 12, marginTop: 16, color: '#8BA4BE', fontSize: 13,
        }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '6px 16px', borderRadius: 6,
              background: '#141824', border: '1px solid #1E2A3A',
              color: page === 0 ? '#475569' : '#8BA4BE',
              cursor: page === 0 ? 'default' : 'pointer',
            }}
          >
            Prev
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '6px 16px', borderRadius: 6,
              background: '#141824', border: '1px solid #1E2A3A',
              color: page >= totalPages - 1 ? '#475569' : '#8BA4BE',
              cursor: page >= totalPages - 1 ? 'default' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
