/**
 * InventoryView.tsx — Your collection
 *
 * Grid of owned items with filtering, sorting,
 * equip/use, gifting, and total collection value.
 */

import React, { useState, useMemo } from 'react';
import { useMarket, CATEGORY_CONFIG, MARKET_ITEMS } from './useMarket';

type SortBy = 'name' | 'rarity' | 'date' | 'value';
type FilterBy = 'all' | 'cosmetic' | 'companion_skin' | 'furniture' | 'realm_deco' | 'boost' | 'bundle';

const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function InventoryView() {
  const { ownedItems, collectionValue, coins, giftItem } = useMarket();
  const [filter, setFilter] = useState<FilterBy>('all');
  const [sortBy, setSortBy] = useState<SortBy>('rarity');
  const [showGift, setShowGift] = useState<string | null>(null);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftSent, setGiftSent] = useState<string | null>(null);

  // Filter + sort
  const displayItems = useMemo(() => {
    let items = [...ownedItems];
    if (filter !== 'all') items = items.filter(i => i.category === filter);
    items.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'rarity': return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
        case 'date': return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
        case 'value': return b.price - a.price;
        default: return 0;
      }
    });
    return items;
  }, [ownedItems, filter, sortBy]);

  const rarityColors: Record<string, { border: string; glow: string; label: string; bg: string }> = {
    common: { border: 'border-gray-500/40', glow: '', label: 'Common', bg: 'from-gray-800/40' },
    rare: { border: 'border-blue-400/50', glow: 'shadow-blue-400/10 shadow-sm', label: 'Rare', bg: 'from-blue-900/30' },
    epic: { border: 'border-purple-400/60', glow: 'shadow-purple-400/20 shadow-md', label: 'Epic', bg: 'from-purple-900/30' },
    legendary: { border: 'border-yellow-400/70', glow: 'shadow-yellow-400/30 shadow-lg', label: 'Legendary', bg: 'from-yellow-900/30' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🎒 My Collection</h2>
        <div className="text-sm font-bold text-[#FACC15]">
          🪙 {coins}
        </div>
      </div>

      {/* Collection Value */}
      <div className="bg-gradient-to-r from-[#D4AF37]/10 to-[#FACC15]/10 border border-[#D4AF37]/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#D4AF37]">Collection Value</div>
            <div className="text-2xl font-bold text-[#FACC15]">🪙 {collectionValue.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#8BA4BE]">Items Owned</div>
            <div className="text-2xl font-bold text-white">{ownedItems.length}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'cosmetic', 'companion_skin', 'furniture', 'realm_deco', 'boost', 'bundle'] as FilterBy[]).map(f => {
          const config = f === 'all' ? { icon: '📦', label: 'All' } : CATEGORY_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'bg-white/5 text-[#8BA4BE]'
              }`}
            >
              {config.icon} {config.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-white/40">Sort:</span>
        {([
          { id: 'rarity' as SortBy, label: 'Rarity' },
          { id: 'name' as SortBy, label: 'Name' },
          { id: 'date' as SortBy, label: 'Recent' },
          { id: 'value' as SortBy, label: 'Value' },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className={`px-2 py-0.5 rounded text-xs transition-all ${
              sortBy === s.id ? 'bg-white/10 text-white' : 'text-white/30'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {displayItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayItems.map(item => {
            const rarity = rarityColors[item.rarity] || rarityColors.common;
            return (
              <div
                key={item.id}
                className={`rounded-xl border-2 ${rarity.border} bg-gradient-to-b ${rarity.bg} ${rarity.glow} overflow-hidden`}
              >
                <div className="bg-black/20 p-4 text-center">
                  <span className="text-4xl">{item.icon}</span>
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                      item.rarity === 'legendary' ? 'bg-yellow-400/20 text-yellow-300' :
                      item.rarity === 'epic' ? 'bg-purple-400/20 text-purple-300' :
                      item.rarity === 'rare' ? 'bg-blue-400/20 text-blue-300' :
                      'bg-gray-400/20 text-gray-300'
                    }`}>
                      {rarity.label}
                    </span>
                    <span className="text-[10px] text-white/30">×{item.quantity}</span>
                  </div>
                  <h4 className="text-sm font-medium truncate">{item.name}</h4>
                  <p className="text-xs text-[#8BA4BE] line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                    <span className="text-xs text-[#FACC15]">🪙 {item.price}</span>
                    <button
                      onClick={() => setShowGift(item.id)}
                      className="text-xs text-[#39FF14] hover:underline"
                    >
                      Gift →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-[#8BA4BE]">
          <span className="text-4xl block mb-2">🎒</span>
          <p className="text-sm">Your collection is empty</p>
          <p className="text-xs mt-1">Browse the Bazaar to find treasures!</p>
        </div>
      )}

      {/* Gift Modal */}
      {showGift && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowGift(null)}>
          <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">🎁 Gift Item</h3>
            <p className="text-sm text-[#8BA4BE] mb-4">Send this item to another player</p>
            <input
              value={giftRecipient}
              onChange={e => setGiftRecipient(e.target.value)}
              placeholder="Enter username..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#39FF14]/50 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (giftRecipient.trim()) {
                    giftItem(showGift, giftRecipient.trim());
                    setGiftSent(showGift);
                    setTimeout(() => { setGiftSent(null); setShowGift(null); setGiftRecipient(''); }, 2000);
                  }
                }}
                disabled={!giftRecipient.trim() || giftSent === showGift}
                className="flex-1 py-2 bg-[#39FF14]/20 text-[#39FF14] rounded-lg font-medium hover:bg-[#39FF14]/30 disabled:opacity-30 transition-all"
              >
                {giftSent === showGift ? '✓ Sent!' : 'Send Gift'}
              </button>
              <button
                onClick={() => { setShowGift(null); setGiftRecipient(''); }}
                className="px-4 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}