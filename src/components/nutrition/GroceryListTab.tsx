import { useState, useMemo } from 'react';
import {
  Check, Plus, RefreshCw, Share2, ShoppingCart,
  ChevronDown, ChevronRight, Trash2, X,
  Leaf, Milk, Beef, Package, Snowflake, Wheat, GlassWater, Layers,
} from 'lucide-react';
import type { GroceryItem, DietMeal } from '../../hooks/useNutrition';

interface GroceryListTabProps {
  items: GroceryItem[];
  weekStart: string;
  activeMeals: DietMeal[];
  onGenerate: (meals: DietMeal[]) => void;
  onToggle: (itemId: string) => void;
  onAddManual: (name: string, quantity?: number, unit?: string, aisle?: string) => void;
  onDelete: (itemId: string) => void;
}

const AISLE_ICON: Record<string, React.ReactNode> = {
  produce: <Leaf size={18} />,
  dairy: <Milk size={18} />,
  protein: <Beef size={18} />,
  pantry: <Layers size={18} />,
  frozen: <Snowflake size={18} />,
  bakery: <Wheat size={18} />,
  beverages: <GlassWater size={18} />,
  other: <Package size={18} />,
};

const AISLE_CONFIG: Record<string, { label: string; order: number }> = {
  produce: { label: 'Produce', order: 1 },
  dairy: { label: 'Dairy', order: 2 },
  protein: { label: 'Protein / Meat', order: 3 },
  pantry: { label: 'Pantry', order: 4 },
  frozen: { label: 'Frozen', order: 5 },
  bakery: { label: 'Bakery', order: 6 },
  beverages: { label: 'Beverages', order: 7 },
  other: { label: 'Other', order: 8 },
};

export function GroceryListTab({ items, weekStart, activeMeals, onGenerate, onToggle, onAddManual, onDelete }: GroceryListTabProps) {
  const [collapsedAisles, setCollapsedAisles] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newAisle, setNewAisle] = useState('other');

  // Group items by aisle
  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {};
    for (const item of items) {
      const aisle = item.aisle || 'other';
      if (!groups[aisle]) groups[aisle] = [];
      groups[aisle].push(item);
    }
    // Sort aisles
    return Object.entries(groups).sort(
      ([a], [b]) => (AISLE_CONFIG[a]?.order || 99) - (AISLE_CONFIG[b]?.order || 99)
    );
  }, [items]);

  const totalItems = items.length;
  const checkedItems = items.filter(i => i.is_checked).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  const toggleAisle = (aisle: string) => {
    setCollapsedAisles(prev => {
      const next = new Set(prev);
      if (next.has(aisle)) next.delete(aisle);
      else next.add(aisle);
      return next;
    });
  };

  const handleAddItem = () => {
    if (!newName.trim()) return;
    onAddManual(newName.trim(), newQty ? parseFloat(newQty) : undefined, newUnit || undefined, newAisle);
    setNewName('');
    setNewQty('');
    setNewUnit('');
    setShowAddForm(false);
  };

  const handleShare = async () => {
    const lines: string[] = ['🛒 Grocery List\n'];
    for (const [aisle, aisleItems] of groupedItems) {
      const config = AISLE_CONFIG[aisle] || AISLE_CONFIG.other;
      lines.push(`■ ${config.label}`);
      for (const item of aisleItems) {
        const check = item.is_checked ? '✅' : '⬜';
        const qty = item.quantity ? ` × ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '';
        lines.push(`  ${check} ${item.name}${qty}`);
      }
      lines.push('');
    }
    const text = lines.join('\n');

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Grocery List', text });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        alert('List copied to clipboard!');
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('List copied to clipboard!');
      }
    } catch {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          alert('List copied to clipboard!');
        }
      } catch { /* ignore */ }
    }
  };

  const weekLabel = new Date(weekStart + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="grocery-tab fade-in">
      {/* Header Card */}
      <div className="grocery-header-card glass-card">
        <div className="ghc-top">
          <div className="ghc-info">
            <h3><ShoppingCart size={16} /> Grocery List</h3>
            <span className="ghc-week">Week of {weekLabel}</span>
          </div>
          <div className="ghc-stats">
            <span className="ghc-count">{checkedItems}/{totalItems}</span>
            <span className="ghc-label">items</span>
          </div>
        </div>

        {/* Progress Bar */}
        {totalItems > 0 && (
          <div className="ghc-progress">
            <div className="ghc-progress-bar">
              <div className="ghc-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="ghc-progress-pct">{Math.round(progress)}%</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="ghc-actions">
          <button className="btn-glow-sm" onClick={() => onGenerate(activeMeals)}>
            <RefreshCw size={14} /> {items.length > 0 ? 'Regenerate' : 'Generate from Meals'}
          </button>
          <button className="btn-ghost-sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} /> Add Item
          </button>
          {items.length > 0 && (
            <button className="btn-ghost-sm" onClick={handleShare}>
              <Share2 size={14} /> Share
            </button>
          )}
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="grocery-add-form glass-card fade-in">
          <div className="gaf-row">
            <input
              type="text"
              placeholder="Item name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              autoFocus
            />
            <input
              type="number"
              placeholder="Qty"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              className="gaf-qty"
            />
            <input
              type="text"
              placeholder="Unit"
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              className="gaf-unit"
            />
          </div>
          <div className="gaf-aisle-row">
            {Object.entries(AISLE_CONFIG).map(([key, config]) => (
              <button
                key={key}
                className={`gaf-aisle-pill ${newAisle === key ? 'active' : ''}`}
                onClick={() => setNewAisle(key)}
              >
                {AISLE_ICON[key] ?? <Package size={12} />} {config.label}
              </button>
            ))}
          </div>
          <div className="gaf-actions">
            <button className="btn-glow-sm" onClick={handleAddItem}>
              <Check size={14} /> Add
            </button>
            <button className="btn-ghost-sm" onClick={() => setShowAddForm(false)}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Grocery List by Aisle */}
      {items.length > 0 ? (
        <div className="grocery-aisles">
          {groupedItems.map(([aisle, aisleItems]) => {
            const config = AISLE_CONFIG[aisle] || AISLE_CONFIG.other;
            const isCollapsed = collapsedAisles.has(aisle);
            const aisleChecked = aisleItems.filter(i => i.is_checked).length;

            return (
              <div key={aisle} className="grocery-aisle-section">
                <button
                  className="gas-header"
                  onClick={() => toggleAisle(aisle)}
                >
                  <span className="gas-icon">{AISLE_ICON[aisle] ?? <Package size={18} />}</span>
                  <span className="gas-label">{config.label}</span>
                  <span className="gas-count">{aisleChecked}/{aisleItems.length}</span>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>

                {!isCollapsed && (
                  <div className="gas-items">
                    {aisleItems.map(item => (
                      <div
                        key={item.id}
                        className={`gas-item ${item.is_checked ? 'checked' : ''}`}
                      >
                        <button
                          className={`gas-checkbox ${item.is_checked ? 'done' : ''}`}
                          onClick={() => onToggle(item.id)}
                        >
                          {item.is_checked && <Check size={14} />}
                        </button>
                        <span className="gas-item-name">{item.name}</span>
                        {item.quantity && (
                          <span className="gas-item-qty">
                            × {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                        {item.is_manual && <span className="gas-manual-badge">manual</span>}
                        <button
                          className="gas-item-del"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grocery-empty glass-card">
          <ShoppingCart size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3>No Items Yet</h3>
          <p>Generate a grocery list from your meal plan, or add items manually.</p>
        </div>
      )}
    </div>
  );
}
