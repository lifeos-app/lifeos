import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, ArrowRight, Check, Clock, Loader2, Search, Shield, AlertTriangle, X } from 'lucide-react';
import type { JunctionTradition } from '../../hooks/useJunction';
import { TraditionHeroBg, TraditionIcon } from './TraditionIcons';
import { TRADITION_CATEGORIES, FALLBACK_TRADITIONS, CATEGORY_TABS, type TraditionCategory } from './constants';

export function SwitchJunctionModal({
  currentTradition,
  allTraditions,
  equippedAt,
  onSwitch,
  onClose,
}: {
  currentTradition: JunctionTradition;
  allTraditions: JunctionTradition[];
  equippedAt: string;
  onSwitch: (newTraditionId: string) => Promise<{ error?: string; success?: boolean }>;
  onClose: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<TraditionCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<JunctionTradition | null>(null);
  const [switching, setSwitching] = useState(false);

  const daysSinceEquip = useMemo(() => {
    const equipped = new Date(equippedAt);
    return Math.floor((Date.now() - equipped.getTime()) / (1000 * 60 * 60 * 24));
  }, [equippedAt]);
  const cooldownRemaining = Math.max(0, 7 - daysSinceEquip);
  const canSwitch = cooldownRemaining === 0;

  const traditions = allTraditions.length > 0 ? allTraditions : FALLBACK_TRADITIONS;

  const filteredTraditions = useMemo(() => {
    let filtered = traditions.filter(t => t.id !== currentTradition.id && t.available);
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(t => TRADITION_CATEGORIES[t.slug] === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return filtered;
  }, [traditions, currentTradition.id, categoryFilter, searchQuery]);

  const handleSwitch = async () => {
    if (!selectedTarget || !canSwitch) return;
    setSwitching(true);
    await onSwitch(selectedTarget.id);
    setSwitching(false);
  };

  const categoryTabs: TraditionCategory[] = CATEGORY_TABS;

  return createPortal(
    <div className="jnc-switch-overlay" onClick={onClose}>
      <div className="jnc-switch-modal" onClick={e => e.stopPropagation()}>
        <button className="jnc-switch-close" onClick={onClose} aria-label="Close"><X size={16} /></button>

        <div className="jnc-switch-header">
          <ArrowLeftRight size={20} />
          <div className="jnc-switch-title">Switch Junction</div>
        </div>

        {!canSwitch && (
          <div className="jnc-cooldown-warning">
            <Clock size={16} />
            <div>
              <div className="jnc-cooldown-title">Cooldown Active</div>
              <div className="jnc-cooldown-text">
                You can switch in <strong>{cooldownRemaining} day{cooldownRemaining !== 1 ? 's' : ''}</strong>. Junctions have a 7-day commitment period.
              </div>
            </div>
          </div>
        )}

        <div className="jnc-switch-current">
          <div className="jnc-switch-current-label">Current Junction</div>
          <div className="jnc-switch-current-card">
            <TraditionHeroBg slug={currentTradition.slug} />
            <span className="jnc-switch-current-icon"><TraditionIcon slug={currentTradition.slug} emoji={currentTradition.icon} size={28} /></span>
            <div>
              <div className="jnc-switch-current-name">{currentTradition.name}</div>
              <div className="jnc-switch-current-desc">Equipped {daysSinceEquip} day{daysSinceEquip !== 1 ? 's' : ''} ago</div>
            </div>
          </div>
        </div>

        {canSwitch && (
          <>
            <div className="jnc-switch-tabs">
              {categoryTabs.map(cat => (
                <button key={cat} className={`jnc-cat-tab ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>{cat}</button>
              ))}
            </div>

            <div className="jnc-search-bar jnc-switch-search">
              <Search size={14} className="jnc-search-icon" />
              <input type="text" placeholder="Search traditions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="jnc-search-input" />
              {searchQuery && <button className="jnc-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={14} /></button>}
            </div>

            <div className="jnc-switch-list">
              {filteredTraditions.map(t => (
                <div
                  key={t.id}
                  className={`jnc-switch-option ${selectedTarget?.id === t.id ? 'selected' : ''}`}
                  style={{ '--trad-color': t.color } as React.CSSProperties}
                  onClick={() => setSelectedTarget(t)}
                >
                  <TraditionHeroBg slug={t.slug} />
                  <span className="jnc-switch-option-icon"><TraditionIcon slug={t.slug} emoji={t.icon} size={24} /></span>
                  <div className="jnc-switch-option-info">
                    <div className="jnc-switch-option-name">{t.name}</div>
                    <div className="jnc-switch-option-desc">{t.description}</div>
                  </div>
                  {selectedTarget?.id === t.id && <Check size={16} className="jnc-switch-check" />}
                </div>
              ))}
              {filteredTraditions.length === 0 && (
                <div className="jnc-switch-empty">No traditions match your search</div>
              )}
            </div>

            {selectedTarget && (
              <div className="jnc-switch-confirm">
                <div className="jnc-switch-confirm-visual">
                  <div className="jnc-switch-from">
                    <TraditionIcon slug={currentTradition.slug} emoji={currentTradition.icon} size={28} />
                    <span>{currentTradition.name}</span>
                  </div>
                  <ArrowRight size={16} className="jnc-switch-arrow" />
                  <div className="jnc-switch-to">
                    <TraditionIcon slug={selectedTarget.slug} emoji={selectedTarget.icon} size={28} />
                    <span>{selectedTarget.name}</span>
                  </div>
                </div>

                <div className="jnc-switch-warnings">
                  <div className="jnc-switch-warn-item">
                    <AlertTriangle size={12} />
                    <span>You cannot change again for <strong>7 days</strong></span>
                  </div>
                  <div className="jnc-switch-warn-item safe">
                    <Shield size={12} />
                    <span>Your progress in {currentTradition.name} will be preserved</span>
                  </div>
                </div>

                <button className="jnc-switch-confirm-btn" onClick={handleSwitch} disabled={switching}>
                  {switching ? <><Loader2 size={14} className="spin" /> Switching…</> : <><ArrowLeftRight size={14} /> Switch to {selectedTarget.name}</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
