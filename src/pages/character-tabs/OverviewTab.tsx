import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords, ChevronRight, Sparkles, Shield, Zap, Plus,
  Home, Car, Smartphone, FileText, CreditCard, ShieldCheck,
  AlertTriangle, Calendar, DollarSign, Wrench, Package,
  ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { useGamificationContext } from '../../lib/gamification/context';
import { useInventoryStore } from '../../stores/useInventoryStore';
import { useAssetsStore, type Asset, type AssetType } from '../../stores/useAssetsStore';
import { useJunction } from '../../hooks/useJunction';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { getClassInfo } from '../../rpg/data/classes';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';
import type { CharacterTab } from './types';

// ── Asset Type Config ──

const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; icon: typeof Home; color: string; emoji: string }> = {
  property: { label: 'Property', icon: Home, color: '#00D4FF', emoji: '🏠' },
  vehicle: { label: 'Vehicle', icon: Car, color: '#39FF14', emoji: '🚗' },
  device: { label: 'Device', icon: Smartphone, color: '#A855F7', emoji: '📱' },
  document: { label: 'Document', icon: FileText, color: '#F97316', emoji: '📄' },
  membership: { label: 'Membership', icon: CreditCard, color: '#EAB308', emoji: '💳' },
  insurance: { label: 'Insurance', icon: ShieldCheck, color: '#22C55E', emoji: '🛡️' },
  other: { label: 'Other', icon: Package, color: '#8BA4BE', emoji: '📦' },
};

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): string {
  if (days < 0) return '#F43F5E';
  if (days <= 7) return '#F97316';
  if (days <= 30) return '#EAB308';
  return '#5A7A9A';
}

// ── Component ──

interface OverviewTabProps {
  onTabChange: (tab: CharacterTab) => void;
}

export function OverviewTab({ onTabChange }: OverviewTabProps) {
  const navigate = useNavigate();
  const gam = useGamificationContext();
  const { items } = useInventoryStore();
  const {
    assets, maintenance, bills, documents, loading,
    fetchAll: fetchAssets, getEquippedAssets, getUpcomingMaintenance,
    getUpcomingBills, getExpiringDocuments, getMonthlyBillTotal,
  } = useAssetsStore();
  const { userJunction, tradition, loading: junctionLoading } = useJunction();
  const { characterClass, name: charName } = useCharacterAppearanceStore();
  const classInfo = getClassInfo(characterClass);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);

  useEffect(() => {
    useInventoryStore.getState().fetchAll();
    fetchAssets();
  }, [fetchAssets]);

  const equippedItems = items.filter(item => item.is_equipped);
  const equippedAssets = getEquippedAssets();
  const hasJunction = Boolean(userJunction && tradition);

  const upcomingMaintenance = getUpcomingMaintenance(14);
  const upcomingBills = getUpcomingBills(14);
  const expiringDocs = getExpiringDocuments(60);
  const totalAlerts = upcomingMaintenance.length + upcomingBills.length + expiringDocs.length;
  const monthlyBills = getMonthlyBillTotal();

  const assetsByType = useMemo(() => {
    const groups: Partial<Record<AssetType, Asset[]>> = {};
    for (const a of equippedAssets) {
      if (!groups[a.asset_type]) groups[a.asset_type] = [];
      groups[a.asset_type]!.push(a);
    }
    return groups;
  }, [equippedAssets]);

  return (
    <>
      {/* Class Hero Display */}
      {classInfo.image && (
        <div className="ch-hero-display">
          <img
            src={classInfo.image}
            alt={classInfo.name}
            className="ch-hero-image"
          />
          <div className="ch-hero-info">
            <div className="ch-hero-name">{charName}</div>
            <div className="ch-hero-class" style={{ color: classInfo.color }}>
              {classInfo.name} — {classInfo.title}
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="ch-stats">
        <div className="ch-stat">
          <div className="ch-stat-icon">
            <Zap size={20} style={{ color: '#00D4FF' }} />
          </div>
          <div className="ch-stat-content">
            <div className="ch-stat-label">Level</div>
            <div className="ch-stat-value">{gam.level || 1}</div>
          </div>
        </div>
        <div className="ch-stat">
          <div className="ch-stat-icon">
            <Package size={20} style={{ color: '#D4AF37' }} />
          </div>
          <div className="ch-stat-content">
            <div className="ch-stat-label">Assets</div>
            <div className="ch-stat-value">{equippedAssets.length}</div>
          </div>
        </div>
        <div className="ch-stat">
          <div className="ch-stat-icon">
            <DollarSign size={20} style={{ color: '#39FF14' }} />
          </div>
          <div className="ch-stat-content">
            <div className="ch-stat-label">Monthly</div>
            <div className="ch-stat-value">{monthlyBills > 0 ? formatCurrency(monthlyBills) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Alerts Bar */}
      {totalAlerts > 0 && (
        <div className="ch-alerts">
          <button
            className="ch-alerts-header"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <AlertTriangle size={14} style={{ color: '#F97316' }} />
            <span className="ch-alerts-count">{totalAlerts} attention needed</span>
            {showAlerts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAlerts && (
            <div className="ch-alerts-list">
              {upcomingMaintenance.map(m => {
                const days = m.next_due ? daysUntil(m.next_due) : 0;
                const assetName = assets.find(a => a.id === m.asset_id)?.name || '';
                return (
                  <div key={m.id} className="ch-alert-item" onClick={() => navigate(`/character/asset/${m.asset_id}`)}>
                    <Wrench size={12} style={{ color: urgencyColor(days), flexShrink: 0 }} />
                    <span className="ch-alert-text">{m.title} — {assetName}</span>
                    <span className="ch-alert-due" style={{ color: urgencyColor(days) }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                    </span>
                  </div>
                );
              })}
              {upcomingBills.map(b => {
                const days = b.next_due ? daysUntil(b.next_due) : 0;
                return (
                  <div key={b.id} className="ch-alert-item" onClick={() => navigate(`/character/asset/${b.asset_id}`)}>
                    <DollarSign size={12} style={{ color: urgencyColor(days), flexShrink: 0 }} />
                    <span className="ch-alert-text">{b.provider} — {formatCurrency(b.amount)}</span>
                    <span className="ch-alert-due" style={{ color: urgencyColor(days) }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                    </span>
                  </div>
                );
              })}
              {expiringDocs.map(d => {
                const days = d.expiry_date ? daysUntil(d.expiry_date) : 0;
                return (
                  <div key={d.id} className="ch-alert-item" onClick={() => navigate(`/character/asset/${d.asset_id}`)}>
                    <FileText size={12} style={{ color: urgencyColor(days), flexShrink: 0 }} />
                    <span className="ch-alert-text">{d.title} expiring</span>
                    <span className="ch-alert-due" style={{ color: urgencyColor(days) }}>
                      {days < 0 ? 'Expired' : `${days}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Equipped Assets */}
      <div className="ch-section">
        <div className="ch-section-header">
          <h2 className="ch-section-title">Equipped Assets</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ch-add-btn" onClick={() => onTabChange('equipment')}>
              View all
            </button>
            <button className="ch-add-btn" onClick={() => setShowAddSheet(true)}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {equippedAssets.length === 0 && !loading ? (
          <div className="ch-empty">
            <Package size={32} style={{ color: '#2A3A50', marginBottom: 12 }} />
            <p>No assets equipped yet</p>
            <p className="ch-empty-sub">Add your property, vehicle, or documents to get started</p>
            <button className="ch-empty-btn" onClick={() => setShowAddSheet(true)}>
              <Plus size={14} /> Equip Your First Asset
            </button>
          </div>
        ) : (
          <div className="ch-asset-grid">
            {(Object.entries(assetsByType) as [AssetType, Asset[]][]).map(([type, typeAssets]) => {
              const config = ASSET_TYPE_CONFIG[type];
              return typeAssets.map(asset => {
                const assetMaint = maintenance.filter(m => m.asset_id === asset.id);
                const assetBills = bills.filter(b => b.asset_id === asset.id);
                const assetDocs = documents.filter(d => d.asset_id === asset.id);
                const Icon = config.icon;

                return (
                  <button
                    key={asset.id}
                    className="ch-asset-card"
                    onClick={() => navigate(`/character/asset/${asset.id}`)}
                    style={{ '--accent': config.color } as React.CSSProperties}
                  >
                    <div className="ch-asset-icon">
                      <Icon size={22} style={{ color: config.color }} />
                    </div>
                    <div className="ch-asset-info">
                      <div className="ch-asset-name">{asset.nickname || asset.name}</div>
                      <div className="ch-asset-type">{config.label}</div>
                      <div className="ch-asset-meta">
                        {assetBills.length > 0 && (
                          <span className="ch-asset-tag">
                            <DollarSign size={10} /> {assetBills.length} bill{assetBills.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {assetMaint.length > 0 && (
                          <span className="ch-asset-tag">
                            <Wrench size={10} /> {assetMaint.length}
                          </span>
                        )}
                        {assetDocs.length > 0 && (
                          <span className="ch-asset-tag">
                            <FileText size={10} /> {assetDocs.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: '#5A7A9A', flexShrink: 0 }} />
                  </button>
                );
              });
            })}
          </div>
        )}
      </div>

      {/* Hub Cards (Equipment + Junction) */}
      <div className="ch-cards">
        <button className="ch-card" onClick={() => onTabChange('equipment')}>
          <div className="ch-card-header">
            <div className="ch-card-icon" style={{ background: 'rgba(212, 175, 55, 0.1)' }}>
              <Shield size={24} style={{ color: '#D4AF37' }} />
            </div>
            <div className="ch-card-title">Gear & Clothing</div>
          </div>
          <div className="ch-card-body">
            <p className="ch-card-description">Your RPG equipment loadout</p>
            <div className="ch-card-stat">
              {equippedItems.length} item{equippedItems.length !== 1 ? 's' : ''} equipped
            </div>
          </div>
          <div className="ch-card-footer">
            <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
          </div>
        </button>

        {!junctionLoading && (
          <button className="ch-card" onClick={() => onTabChange('junction')}>
            <div className="ch-card-header">
              <div className="ch-card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <Sparkles size={24} style={{ color: '#A855F7' }} />
              </div>
              <div className="ch-card-title">Junction</div>
            </div>
            <div className="ch-card-body">
              {hasJunction ? (
                <>
                  <p className="ch-card-description">Your spiritual path & practices</p>
                  <div className="ch-card-stat">{tradition?.name} • {userJunction?.junction_xp || 0} XP</div>
                </>
              ) : (
                <>
                  <p className="ch-card-description ch-card-teaser">Discover your spiritual path</p>
                  <div className="ch-card-stat ch-card-teaser-cta">Choose a wisdom tradition</div>
                </>
              )}
            </div>
            <div className="ch-card-footer">
              <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
            </div>
          </button>
        )}
      </div>

      {/* Add Asset Sheet */}
      <AddAssetSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} />
    </>
  );
}

// ── Add Asset Bottom Sheet ──

function AddAssetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const addAsset = useAssetsStore(s => s.addAsset);
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const handleTypeSelect = (type: AssetType) => {
    setSelectedType(type);
    setStep('details');
  };

  const handleSave = async () => {
    if (!selectedType || !name.trim()) return;
    setSaving(true);
    const asset = await addAsset({
      asset_type: selectedType,
      name: name.trim(),
      nickname: nickname.trim() || null,
    });
    setSaving(false);
    if (asset) {
      showToast(`${name} equipped!`, '✅', ASSET_TYPE_CONFIG[selectedType].color);
      onClose();
      setStep('type');
      setSelectedType(null);
      setName('');
      setNickname('');
      navigate(`/character/asset/${asset.id}`);
    }
  };

  const handleClose = () => {
    onClose();
    setStep('type');
    setSelectedType(null);
    setName('');
    setNickname('');
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === 'type' ? 'Equip Asset' : `Add ${selectedType ? ASSET_TYPE_CONFIG[selectedType].label : ''}`}
      icon={<Plus size={16} />}
    >
      {step === 'type' ? (
        <div className="ch-type-grid">
          {(Object.entries(ASSET_TYPE_CONFIG) as [AssetType, typeof ASSET_TYPE_CONFIG['property']][]).map(([type, config]) => (
            <button
              key={type}
              className="ch-type-btn"
              onClick={() => handleTypeSelect(type as AssetType)}
            >
              <div className="ch-type-icon" style={{ background: `${config.color}15`, color: config.color }}>
                <config.icon size={24} />
              </div>
              <span className="ch-type-label">{config.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="ch-add-form">
          <div className="ch-form-field">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={selectedType === 'vehicle' ? 'e.g. Toyota Corolla 2018' : selectedType === 'property' ? 'e.g. 42 Smith St, Melbourne' : 'Name'}
              autoFocus
            />
          </div>
          <div className="ch-form-field">
            <label>Nickname (optional)</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={selectedType === 'vehicle' ? 'e.g. The Beast' : selectedType === 'property' ? 'e.g. Home Base' : 'Short name'}
            />
          </div>
          <div className="ch-form-actions">
            <button className="ch-form-back" onClick={() => { setStep('type'); setSelectedType(null); }}>
              Back
            </button>
            <button
              className="ch-form-save"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? 'Saving...' : 'Equip'}
            </button>
          </div>
          <p className="ch-form-hint">You can add bills, maintenance, and documents after saving.</p>
        </div>
      )}
    </BottomSheet>
  );
}
