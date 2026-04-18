/**
 * AssetDetail — Deep portal for any equipped asset.
 * 
 * Shows: overview, metadata, maintenance schedule, bills, documents.
 * Each section is editable. This is where the depth lives.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Trash2, Save, Plus, X,
  Home, Car, Smartphone, FileText, CreditCard, ShieldCheck, Package,
  Wrench, DollarSign, Calendar, Clock, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, MoreHorizontal,
} from 'lucide-react';
import {
  useAssetsStore,
  type Asset, type AssetType, type AssetMaintenance, type AssetBill, type AssetDocument,
  type MaintenanceFrequency, type BillCategory, type DocType,
} from '../stores/useAssetsStore';
import { BottomSheet } from '../components/BottomSheet';
import { showToast } from '../components/Toast';
import './AssetDetail.css';

// ── Config ──

const TYPE_ICONS: Record<AssetType, typeof Home> = {
  property: Home, vehicle: Car, device: Smartphone, document: FileText,
  membership: CreditCard, insurance: ShieldCheck, other: Package,
};

const TYPE_COLORS: Record<AssetType, string> = {
  property: '#00D4FF', vehicle: '#39FF14', device: '#A855F7', document: '#F97316',
  membership: '#EAB308', insurance: '#22C55E', other: '#8BA4BE',
};

const FREQUENCY_LABELS: Record<MaintenanceFrequency, string> = {
  one_time: 'One-time', weekly: 'Weekly', fortnightly: 'Fortnightly',
  monthly: 'Monthly', quarterly: 'Quarterly', biannual: 'Every 6 months', yearly: 'Yearly',
};

// ── Helpers ──

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyBadge(days: number | null): { text: string; color: string } | null {
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#F43F5E' };
  if (days === 0) return { text: 'Today', color: '#F97316' };
  if (days <= 7) return { text: `${days}d`, color: '#F97316' };
  if (days <= 30) return { text: `${days}d`, color: '#EAB308' };
  return { text: `${days}d`, color: '#5A7A9A' };
}

// ── Component ──

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    assets, maintenance, bills, documents,
    fetchAll, updateAsset, deleteAsset,
    addMaintenance, updateMaintenance, completeMaintenance, deleteMaintenance,
    addBill, updateBill, deleteBill,
    addDocument, deleteDocument,
  } = useAssetsStore();

  const [activeSheet, setActiveSheet] = useState<'maintenance' | 'bill' | 'document' | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const asset = assets.find(a => a.id === id);
  const assetMaint = useMemo(() => maintenance.filter(m => m.asset_id === id), [maintenance, id]);
  const assetBills = useMemo(() => bills.filter(b => b.asset_id === id), [bills, id]);
  const assetDocs = useMemo(() => documents.filter(d => d.asset_id === id), [documents, id]);

  if (!asset) {
    return (
      <div className="ad-page">
        <button className="ad-back" onClick={() => navigate('/character')}><ArrowLeft size={18} /> Back</button>
        <div className="ad-empty">Asset not found</div>
      </div>
    );
  }

  const Icon = TYPE_ICONS[asset.asset_type];
  const color = TYPE_COLORS[asset.asset_type];
  const monthlyTotal = assetBills.reduce((sum, b) => {
    switch (b.frequency) {
      case 'weekly': return sum + b.amount * 4.33;
      case 'fortnightly': return sum + b.amount * 2.17;
      case 'monthly': return sum + b.amount;
      case 'quarterly': return sum + b.amount / 3;
      case 'biannual': return sum + b.amount / 6;
      case 'yearly': return sum + b.amount / 12;
      default: return sum;
    }
  }, 0);

  const handleDelete = async () => {
    if (confirm(`Remove ${asset.name}?`)) {
      await deleteAsset(asset.id);
      showToast('Asset removed', '🗑️', '#F43F5E');
      navigate('/character');
    }
  };

  return (
    <div className="ad-page">
      {/* Header */}
      <div className="ad-header">
        <button className="ad-back" onClick={() => navigate('/character')}>
          <ArrowLeft size={18} />
        </button>
        <div className="ad-header-info">
          <div className="ad-header-icon" style={{ background: `${color}15` }}>
            <Icon size={24} style={{ color }} />
          </div>
          <div>
            <h1 className="ad-title">{asset.nickname || asset.name}</h1>
            {asset.nickname && <p className="ad-subtitle">{asset.name}</p>}
            <p className="ad-type-label" style={{ color }}>{asset.asset_type}</p>
          </div>
        </div>
        <button className="ad-delete-btn" onClick={handleDelete} aria-label="Delete asset"><Trash2 size={16} /></button>
      </div>

      {/* Quick Stats */}
      <div className="ad-quick-stats">
        <div className="ad-qs">
          <span className="ad-qs-label">Bills</span>
          <span className="ad-qs-value">{assetBills.length}</span>
        </div>
        <div className="ad-qs">
          <span className="ad-qs-label">Maintenance</span>
          <span className="ad-qs-value">{assetMaint.length}</span>
        </div>
        <div className="ad-qs">
          <span className="ad-qs-label">Documents</span>
          <span className="ad-qs-value">{assetDocs.length}</span>
        </div>
        {monthlyTotal > 0 && (
          <div className="ad-qs">
            <span className="ad-qs-label">Monthly</span>
            <span className="ad-qs-value" style={{ color: '#39FF14' }}>${Math.round(monthlyTotal)}</span>
          </div>
        )}
      </div>

      {/* ── Metadata (type-specific) ── */}
      {asset.metadata && Object.keys(asset.metadata).length > 0 && (
        <div className="ad-section">
          <h2 className="ad-section-title">Details</h2>
          <div className="ad-metadata-grid">
            {Object.entries(asset.metadata).map(([key, value]) => (
              value != null && value !== '' && (
                <div key={key} className="ad-meta-item">
                  <span className="ad-meta-key">{key.replace(/_/g, ' ')}</span>
                  <span className="ad-meta-value">{String(value)}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ── Maintenance ── */}
      <div className="ad-section">
        <div className="ad-section-header">
          <h2 className="ad-section-title"><Wrench size={14} /> Maintenance</h2>
          <button className="ad-section-add" onClick={() => setActiveSheet('maintenance')}><Plus size={13} /></button>
        </div>
        {assetMaint.length === 0 ? (
          <p className="ad-section-empty">No maintenance scheduled</p>
        ) : (
          <div className="ad-items-list">
            {assetMaint.map(m => {
              const days = daysUntil(m.next_due);
              const badge = urgencyBadge(days);
              return (
                <div key={m.id} className="ad-item-row">
                  <div className="ad-item-info">
                    <span className="ad-item-title">{m.title}</span>
                    <span className="ad-item-sub">{FREQUENCY_LABELS[m.frequency]} {m.next_due ? `• Due ${formatDate(m.next_due)}` : ''}</span>
                  </div>
                  {badge && <span className="ad-item-badge" style={{ color: badge.color, borderColor: badge.color + '40' }}>{badge.text}</span>}
                  {!m.is_completed && (
                    <button className="ad-item-complete" onClick={() => completeMaintenance(m.id)} title="Mark done">
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bills ── */}
      <div className="ad-section">
        <div className="ad-section-header">
          <h2 className="ad-section-title"><DollarSign size={14} /> Bills</h2>
          <button className="ad-section-add" onClick={() => setActiveSheet('bill')}><Plus size={13} /></button>
        </div>
        {assetBills.length === 0 ? (
          <p className="ad-section-empty">No bills linked</p>
        ) : (
          <div className="ad-items-list">
            {assetBills.map(b => {
              const days = daysUntil(b.next_due);
              const badge = urgencyBadge(days);
              return (
                <div key={b.id} className="ad-item-row">
                  <div className="ad-item-info">
                    <span className="ad-item-title">{b.provider}</span>
                    <span className="ad-item-sub">${b.amount} {FREQUENCY_LABELS[b.frequency].toLowerCase()} • {b.category}{b.auto_pay ? ' • Auto-pay' : ''}</span>
                  </div>
                  {badge && <span className="ad-item-badge" style={{ color: badge.color, borderColor: badge.color + '40' }}>{badge.text}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Documents ── */}
      <div className="ad-section">
        <div className="ad-section-header">
          <h2 className="ad-section-title"><FileText size={14} /> Documents</h2>
          <button className="ad-section-add" onClick={() => setActiveSheet('document')}><Plus size={13} /></button>
        </div>
        {assetDocs.length === 0 ? (
          <p className="ad-section-empty">No documents attached</p>
        ) : (
          <div className="ad-items-list">
            {assetDocs.map(d => {
              const days = daysUntil(d.expiry_date);
              const badge = d.expiry_date ? urgencyBadge(days) : null;
              return (
                <div key={d.id} className="ad-item-row">
                  <div className="ad-item-info">
                    <span className="ad-item-title">{d.title}</span>
                    <span className="ad-item-sub">{d.doc_type}{d.expiry_date ? ` • Expires ${formatDate(d.expiry_date)}` : ''}</span>
                  </div>
                  {badge && <span className="ad-item-badge" style={{ color: badge.color, borderColor: badge.color + '40' }}>{badge.text}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Sheets ── */}
      <AddMaintenanceSheet open={activeSheet === 'maintenance'} onClose={() => setActiveSheet(null)} assetId={asset.id} />
      <AddBillSheet open={activeSheet === 'bill'} onClose={() => setActiveSheet(null)} assetId={asset.id} />
      <AddDocumentSheet open={activeSheet === 'document'} onClose={() => setActiveSheet(null)} assetId={asset.id} />
    </div>
  );
}

// ── Add Maintenance Sheet ──

function AddMaintenanceSheet({ open, onClose, assetId }: { open: boolean; onClose: () => void; assetId: string }) {
  const addMaintenance = useAssetsStore(s => s.addMaintenance);
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<MaintenanceFrequency>('yearly');
  const [nextDue, setNextDue] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await addMaintenance({
      asset_id: assetId,
      title: title.trim(),
      frequency,
      next_due: nextDue || null,
      cost_estimate: cost ? parseFloat(cost) : null,
    });
    setSaving(false);
    showToast('Maintenance added', '🔧', '#00D4FF');
    onClose();
    setTitle(''); setFrequency('yearly'); setNextDue(''); setCost('');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Maintenance" icon={<Wrench size={16} />}>
      <div className="ch-add-form">
        <div className="ch-form-field">
          <label>What needs doing? *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Oil change, Gutter clean" autoFocus />
        </div>
        <div className="ch-form-field">
          <label>Frequency</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value as MaintenanceFrequency)}
            style={{ padding: '12px 14px', background: 'rgba(15,45,74,0.5)', border: '1px solid rgba(26,58,92,0.6)', borderRadius: 10, color: '#E8F0FE', fontSize: 14 }}>
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="ch-form-field">
          <label>Next due</label>
          <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
        </div>
        <div className="ch-form-field">
          <label>Estimated cost ($)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" />
        </div>
        <button className="ch-form-save" onClick={handleSave} disabled={!title.trim() || saving}>{saving ? 'Saving...' : 'Add Maintenance'}</button>
      </div>
    </BottomSheet>
  );
}

// ── Add Bill Sheet ──

function AddBillSheet({ open, onClose, assetId }: { open: boolean; onClose: () => void; assetId: string }) {
  const addBill = useAssetsStore(s => s.addBill);
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<BillCategory>('other');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<MaintenanceFrequency>('monthly');
  const [nextDue, setNextDue] = useState('');
  const [saving, setSaving] = useState(false);

  const categories: BillCategory[] = ['electricity', 'gas', 'water', 'internet', 'phone', 'insurance', 'registration', 'mortgage', 'rent', 'rates', 'subscription', 'maintenance', 'fuel', 'other'];

  const handleSave = async () => {
    if (!provider.trim() || !amount) return;
    setSaving(true);
    await addBill({
      asset_id: assetId,
      provider: provider.trim(),
      category,
      amount: parseFloat(amount),
      frequency,
      next_due: nextDue || null,
    });
    setSaving(false);
    showToast('Bill linked', '💰', '#39FF14');
    onClose();
    setProvider(''); setCategory('other'); setAmount(''); setFrequency('monthly'); setNextDue('');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Link Bill" icon={<DollarSign size={16} />}>
      <div className="ch-add-form">
        <div className="ch-form-field">
          <label>Provider *</label>
          <input value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. AGL, Telstra" autoFocus />
        </div>
        <div className="ch-form-field">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as BillCategory)}
            style={{ padding: '12px 14px', background: 'rgba(15,45,74,0.5)', border: '1px solid rgba(26,58,92,0.6)', borderRadius: 10, color: '#E8F0FE', fontSize: 14 }}>
            {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="ch-form-field">
          <label>Amount ($) *</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="ch-form-field">
          <label>Frequency</label>
          <select value={frequency} onChange={e => setFrequency(e.target.value as MaintenanceFrequency)}
            style={{ padding: '12px 14px', background: 'rgba(15,45,74,0.5)', border: '1px solid rgba(26,58,92,0.6)', borderRadius: 10, color: '#E8F0FE', fontSize: 14 }}>
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="ch-form-field">
          <label>Next due</label>
          <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
        </div>
        <button className="ch-form-save" onClick={handleSave} disabled={!provider.trim() || !amount || saving}>{saving ? 'Saving...' : 'Link Bill'}</button>
      </div>
    </BottomSheet>
  );
}

// ── Add Document Sheet ──

function AddDocumentSheet({ open, onClose, assetId }: { open: boolean; onClose: () => void; assetId: string }) {
  const addDocument = useAssetsStore(s => s.addDocument);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocType>('other');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const docTypes: DocType[] = ['registration', 'insurance', 'warranty', 'receipt', 'manual', 'certificate', 'license', 'passport', 'visa', 'permit', 'contract', 'invoice', 'other'];

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await addDocument({
      asset_id: assetId,
      doc_type: docType,
      title: title.trim(),
      expiry_date: expiryDate || null,
    });
    setSaving(false);
    showToast('Document added', '📄', '#F97316');
    onClose();
    setTitle(''); setDocType('other'); setExpiryDate('');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Document" icon={<FileText size={16} />}>
      <div className="ch-add-form">
        <div className="ch-form-field">
          <label>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Car rego, Home insurance" autoFocus />
        </div>
        <div className="ch-form-field">
          <label>Type</label>
          <select value={docType} onChange={e => setDocType(e.target.value as DocType)}
            style={{ padding: '12px 14px', background: 'rgba(15,45,74,0.5)', border: '1px solid rgba(26,58,92,0.6)', borderRadius: 10, color: '#E8F0FE', fontSize: 14 }}>
            {docTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="ch-form-field">
          <label>Expiry date</label>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </div>
        <button className="ch-form-save" onClick={handleSave} disabled={!title.trim() || saving}>{saving ? 'Saving...' : 'Add Document'}</button>
      </div>
    </BottomSheet>
  );
}
