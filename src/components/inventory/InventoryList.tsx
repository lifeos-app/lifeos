/**
 * InventoryList — Filterable inventory grid with tabs, search, and sort.
 */

import { useState, useMemo } from 'react';
import {
  Search, SlidersHorizontal, Shirt, Briefcase, Dog, Dumbbell,
  Star, Plus, Gem, Heart,
} from 'lucide-react';
import { useInventoryStore, type ListType, type InventoryItem } from '../../stores/useInventoryStore';
import { BottomSheet } from '../BottomSheet';
import { AddItemSheet } from './AddItemSheet';
import { ItemDetail } from './ItemDetail';
import './inventory.css';

type SortKey = 'name' | 'created_at' | 'condition' | 'purchase_price';

const LIST_TABS: { id: ListType; label: string; icon: typeof Shirt }[] = [
  { id: 'personal', label: 'Personal', icon: Shirt },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'pets', label: 'Pets', icon: Dog },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
];

const CONDITION_ORDER: Record<string, number> = { new: 0, good: 1, worn: 2, damaged: 3 };

export function InventoryList() {
  const { items, loading } = useInventoryStore();
  const [activeList, setActiveList] = useState<ListType>('personal');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortMenu, setSortMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  const filteredItems = useMemo(() => {
    let list = items.filter(i => i.list_type === activeList);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'condition':
          return (CONDITION_ORDER[a.condition] || 0) - (CONDITION_ORDER[b.condition] || 0);
        case 'purchase_price':
          return (b.purchase_price || 0) - (a.purchase_price || 0);
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return list;
  }, [items, activeList, search, sortKey]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const tab of LIST_TABS) {
      c[tab.id] = items.filter(i => i.list_type === tab.id).length;
    }
    return c;
  }, [items]);

  const cycleSortKey = () => {
    const keys: SortKey[] = ['created_at', 'name', 'condition', 'purchase_price'];
    const idx = keys.indexOf(sortKey);
    setSortKey(keys[(idx + 1) % keys.length]);
  };

  return (
    <div className="inventory-section">
      {/* Tab Bar */}
      <div className="inv-tab-bar">
        {LIST_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`inv-tab ${activeList === tab.id ? 'active' : ''}`}
              onClick={() => setActiveList(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {counts[tab.id] > 0 && (
                <span className="inv-tab-count">{counts[tab.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Sort */}
      <div className="inv-search-bar">
        <Search size={15} />
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`inv-sort-btn ${sortKey !== 'created_at' ? 'active' : ''}`}
          onClick={cycleSortKey}
          title={`Sort: ${sortKey}`}
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="inv-empty">
          <p>Loading inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty-icon">
            <Gem size={24} />
          </div>
          <h4>No items yet</h4>
          <p>Tap + to add your first {activeList} item to the inventory.</p>
        </div>
      ) : (
        <div className="inv-grid">
          {filteredItems.map((item, i) => (
            <ItemCard
              key={item.id}
              item={item}
              index={i}
              onClick={() => setDetailItem(item)}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button className="inv-fab" onClick={() => setAddOpen(true)}>
        <Plus size={22} />
      </button>

      {/* Add Item Sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Item"
        icon={<Plus size={16} />}
        maxHeight={90}
      >
        <AddItemSheet
          defaultListType={activeList}
          onClose={() => setAddOpen(false)}
        />
      </BottomSheet>

      {/* Item Detail Sheet */}
      <BottomSheet
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.name || ''}
        maxHeight={90}
      >
        {detailItem && (
          <ItemDetail
            item={detailItem}
            onClose={() => setDetailItem(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// ── Item Card Component ──
function ItemCard({ item, index, onClick }: { item: InventoryItem; index: number; onClick: () => void }) {
  const bgColor = item.color || getCategoryColor(item.category);

  return (
    <div
      className={`inv-card ${item.is_equipped ? 'equipped' : ''} ${item.is_favorite ? 'favorite' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
    >
      <div className="inv-card-top">
        <div className="inv-card-swatch" style={{ background: `${bgColor}15` }}>
          <CategoryIcon category={item.category} color={bgColor} />
        </div>
        <div className="inv-card-badges">
          {item.is_equipped && (
            <span className="inv-card-badge equipped-badge">⚔</span>
          )}
          <span className={`inv-card-badge condition-${item.condition}`}>
            {item.condition}
          </span>
        </div>
      </div>
      <div className="inv-card-name">{item.name}</div>
      <div className="inv-card-meta">
        {item.brand && <span>{item.brand}</span>}
        {item.brand && item.size && <span>·</span>}
        {item.size && <span>{item.size}</span>}
      </div>
      {item.is_favorite && (
        <div className="inv-card-fav">
          <Heart size={10} fill="#D4AF37" />
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ category, color }: { category: string; color: string }) {
  const p = { size: 16, color };
  switch (category) {
    case 'clothing': return <Shirt {...p} />;
    case 'shoes': return <Shirt {...p} />;
    case 'accessories': return <Star {...p} />;
    case 'tech': return <Star {...p} />;
    case 'pet': return <Dog {...p} />;
    case 'fitness': return <Dumbbell {...p} />;
    default: return <Gem {...p} />;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'clothing': return '#00D4FF';
    case 'shoes': return '#A855F7';
    case 'accessories': return '#D4AF37';
    case 'tech': return '#39FF14';
    case 'pet': return '#F97316';
    case 'fitness': return '#EF4444';
    default: return '#818CF8';
  }
}
