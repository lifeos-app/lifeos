/**
 * MarketItemCard.tsx — Item display component
 *
 * Shows item icon with rarity glow, name, description, price,
 * Buy/Gift buttons, and preview mode.
 */

import React, { useState } from 'react';
import { useMarket } from './useMarket';
import type { MarketItem } from '../../stores/marketStore';
import { CATEGORY_CONFIG } from '../../stores/marketStore';

interface MarketItemCardProps {
  item: MarketItem;
  variant?: 'grid' | 'list' | 'compact';
  onPurchase?: () => void;
}

export function MarketItemCard({ item, variant = 'grid', onPurchase }: MarketItemCardProps) {
  const { coins, ownsItem, purchaseItem, addToCart, cart } = useMarket();
  const [showGift, setShowGift] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const owned = ownsItem(item.id);
  const inCart = cart.includes(item.id);
  const canAfford = coins >= item.price;
  const categoryConfig = CATEGORY_CONFIG[item.category];

  // Rarity styling
  const rarityColors: Record<string, { border: string; glow: string; label: string; bg: string }> = {
    common: { border: 'border-gray-500/40', glow: '', label: 'Common', bg: 'from-gray-800/40 to-gray-900/40' },
    rare: { border: 'border-blue-400/50', glow: 'shadow-blue-400/20 shadow-md', label: 'Rare', bg: 'from-blue-900/30 to-blue-800/20' },
    epic: { border: 'border-purple-400/60', glow: 'shadow-purple-400/30 shadow-lg', label: 'Epic', bg: 'from-purple-900/30 to-purple-800/20' },
    legendary: { border: 'border-yellow-400/70', glow: 'shadow-yellow-400/40 shadow-lg', label: 'Legendary', bg: 'from-yellow-900/30 to-yellow-800/20' },
  };
  const rarity = rarityColors[item.rarity] || rarityColors.common;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg border ${rarity.border} bg-gradient-to-r ${rarity.bg} ${rarity.glow} transition-all hover:scale-[1.02]`}>
        <span className="text-xl">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.name}</div>
          <div className="text-xs text-[#FACC15]">🪙 {item.price}</div>
        </div>
        {owned ? (
          <span className="text-xs text-[#39FF14]">✓</span>
        ) : (
          <button
            onClick={() => {
              if (onPurchase) onPurchase();
              else purchaseItem(item.id);
            }}
            disabled={!canAfford}
            className="px-2 py-1 bg-[#00D4FF]/20 text-[#00D4FF] rounded text-xs font-medium hover:bg-[#00D4FF]/30 disabled:opacity-30"
          >
            Buy
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`relative rounded-xl border-2 ${rarity.border} bg-gradient-to-b ${rarity.bg} ${rarity.glow} overflow-hidden transition-all hover:scale-[1.02] hover:-translate-y-0.5`}>
        {/* Rarity badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            item.rarity === 'legendary' ? 'bg-yellow-400/20 text-yellow-300' :
            item.rarity === 'epic' ? 'bg-purple-400/20 text-purple-300' :
            item.rarity === 'rare' ? 'bg-blue-400/20 text-blue-300' :
            'bg-gray-400/20 text-gray-300'
          }`}>
            {rarity.label}
          </span>
        </div>

        {/* Item Preview */}
        <button
          onClick={() => setShowPreview(true)}
          className="w-full aspect-square flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors"
        >
          <span className="text-5xl">{item.icon}</span>
        </button>

        {/* Item Info */}
        <div className="p-3">
          {/* Category */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px]">{categoryConfig.icon}</span>
            <span className="text-[10px]" style={{ color: categoryConfig.color }}>{categoryConfig.label}</span>
          </div>

          {/* Name */}
          <h4 className="font-semibold text-sm text-white truncate">{item.name}</h4>

          {/* Description */}
          <p className="text-xs text-[#8BA4BE] mt-1 line-clamp-2 leading-relaxed">{item.description}</p>

          {/* Price */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className="text-sm font-bold text-[#FACC15] flex items-center gap-1">
              🪙 {item.price}
            </span>
            {owned ? (
              <span className="text-xs text-[#39FF14] font-medium">✓ Owned</span>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmBuy(true)}
                  disabled={!canAfford}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    canAfford
                      ? 'bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setShowGift(true)}
                  className="px-2.5 py-1.5 bg-[#39FF14]/20 text-[#39FF14] rounded-lg text-xs font-medium hover:bg-[#39FF14]/30 transition-all"
                >
                  Gift
                </button>
              </div>
            )}
          </div>

          {!canAfford && !owned && (
            <p className="text-[10px] text-red-400 mt-1">Not enough coins</p>
          )}

          {inCart && !owned && (
            <p className="text-[10px] text-[#00D4FF] mt-1">In cart</p>
          )}

          {/* Seasonal badge */}
          {item.source === 'seasonal' && (
            <div className="absolute top-2 left-2 bg-purple-500/30 text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full">
              🎪 Seasonal
            </div>
          )}
        </div>
      </div>

      {/* Buy Confirmation Modal */}
      {confirmBuy && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmBuy(false)}>
          <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">{item.icon} {item.name}</h3>
            <p className="text-sm text-[#8BA4BE] mb-4">{item.description}</p>
            <p className="text-lg font-bold text-[#FACC15] mb-4">🪙 {item.price} coins</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  purchaseItem(item.id);
                  setConfirmBuy(false);
                  onPurchase?.();
                }}
                disabled={!canAfford}
                className="flex-1 py-2 bg-[#00D4FF] text-black rounded-lg font-medium hover:bg-[#00D4FF]/80 disabled:opacity-30 transition-all"
              >
                Confirm Purchase
              </button>
              <button
                onClick={() => setConfirmBuy(false)}
                className="px-4 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {showGift && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowGift(false)}>
          <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">🎁 Gift {item.name}</h3>
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
                  const { useMarketStore } = require('../../stores/marketStore');
                  useMarketStore.getState().giftItem(item.id, giftRecipient.trim());
                  setShowGift(false);
                  setGiftRecipient('');
                }
              }}
                disabled={!giftRecipient.trim()}
                className="flex-1 py-2 bg-[#39FF14]/20 text-[#39FF14] rounded-lg font-medium hover:bg-[#39FF14]/30 disabled:opacity-30 transition-all"
              >
                Send Gift
              </button>
              <button
                onClick={() => setShowGift(false)}
                className="px-4 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <span className="text-7xl">{item.icon}</span>
            </div>
            <h3 className="text-lg font-bold text-center mb-1">{item.name}</h3>
            <span className={`text-xs block text-center mb-3 ${
              item.rarity === 'legendary' ? 'text-yellow-300' :
              item.rarity === 'epic' ? 'text-purple-300' :
              item.rarity === 'rare' ? 'text-blue-300' : 'text-gray-300'
            }`}>
              {rarity.label} {categoryConfig.icon} {categoryConfig.label}
            </span>
            <p className="text-sm text-[#8BA4BE] text-center mb-4">{item.description}</p>
            <div className="text-center text-lg font-bold text-[#FACC15]">🪙 {item.price}</div>
            <button
              onClick={() => setShowPreview(false)}
              className="w-full mt-4 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}