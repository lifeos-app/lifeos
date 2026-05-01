/**
 * Market.tsx — Main marketplace page
 *
 * Colorful bazaar experience with categories, featured carousel,
 * item cards, cart, search, and "My Inventory" tab.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useMarket, CATEGORY_CONFIG, MARKET_ITEMS } from './useMarket';
import { MarketItemCard } from './MarketItemCard';
import { InventoryView } from './InventoryView';
import { TradeCenter } from './TradeCenter';
import type { MarketItem } from '../../stores/marketStore';

type Tab = 'browse' | 'inventory' | 'trades';

export function Market() {
  const {
    inventory,
    coins,
    featuredItems,
    filteredItems,
    searchQuery,
    selectedCategory,
    cart,
    cartItems,
    cartTotal,
    error,
    addToCart,
    removeFromCart,
    clearCart,
    checkout,
    setSearchQuery,
    setSelectedCategory,
  } = useMarket();

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [showCart, setShowCart] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // Auto-rotate carousel
  useEffect(() => {
    if (featuredItems.length === 0) return;
    const timer = setInterval(() => {
      setCarouselIdx((prev) => (prev + 1) % featuredItems.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [featuredItems.length]);

  const categories: (MarketItem['category'] | 'all')[] = [
    'all', 'cosmetic', 'companion_skin', 'furniture', 'realm_deco', 'boost', 'bundle'
  ];

  const rarityBorder: Record<string, string> = {
    common: 'border-gray-500/30',
    rare: 'border-blue-400/40',
    epic: 'border-purple-400/50',
    legendary: 'border-yellow-400/60',
  };

  const rarityGlow: Record<string, string> = {
    common: '',
    rare: 'shadow-blue-400/10 shadow-sm',
    epic: 'shadow-purple-400/20 shadow-md',
    legendary: 'shadow-yellow-400/30 shadow-lg animate-pulse',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0f2d4a] to-[#0a1628] text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-[#0a1628]/90 backdrop-blur-lg border-b border-white/5 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">🏪 Bazaar</h1>
            <p className="text-xs text-[#8BA4BE]">Trade, collect, and express yourself</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-[#FACC15]/10 border border-[#FACC15]/30 rounded-lg">
              <span className="text-sm font-bold text-[#FACC15]">🪙 {coins}</span>
            </div>
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
            >
              🛒 Cart
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full text-[10px] flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { id: 'browse' as Tab, label: '🏪 Browse', color: '#00D4FF' },
            { id: 'inventory' as Tab, label: '🎒 Inventory', color: '#39FF14' },
            { id: 'trades' as Tab, label: '🤝 Trades', color: '#FACC15' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                  : 'text-[#8BA4BE] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Cart Slide-Down */}
      {showCart && cart.length > 0 && (
        <div className="sticky top-[120px] z-20 mx-4 mb-2 bg-[#0F2D4A] border border-[#00D4FF]/30 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#00D4FF]">🛒 Shopping Cart</h3>
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">Clear</button>
          </div>
          <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <span className="text-sm">{item.icon} {item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#FACC15]">🪙 {item.price}</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="font-bold">Total: 🪙 {cartTotal}</span>
            <button
              onClick={() => {
                const success = checkout();
                if (!success) setShowCart(false);
              }}
              disabled={coins < cartTotal}
              className="px-4 py-2 bg-[#00D4FF] text-black rounded-lg font-medium hover:bg-[#00D4FF]/80 disabled:opacity-30 transition-all"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pb-20">
        {activeTab === 'browse' && (
          <div className="space-y-4">
            {/* Featured Carousel */}
            {featuredItems.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#D4AF37] mb-2">⭐ Featured</h2>
                <div className="relative overflow-hidden rounded-xl">
                  <div
                    className="flex transition-transform duration-500"
                    style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
                  >
                    {featuredItems.map(item => {
                      const catConfig = CATEGORY_CONFIG[item.category];
                      return (
                        <div
                          key={item.id}
                          className="w-full flex-shrink-0"
                        >
                          <div className={`bg-gradient-to-br ${item.rarity === 'legendary' ? 'from-yellow-900/30 via-amber-900/20 to-[#0F2D4A]' : item.rarity === 'epic' ? 'from-purple-900/30 via-indigo-900/20 to-[#0F2D4A]' : 'from-blue-900/20 to-[#0F2D4A]'} p-6 flex items-center gap-4`}>
                            <span className="text-6xl">{item.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px]" style={{ color: catConfig.color }}>{catConfig.icon} {catConfig.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  item.rarity === 'legendary' ? 'bg-yellow-400/20 text-yellow-300' :
                                  item.rarity === 'epic' ? 'bg-purple-400/20 text-purple-300' : 'bg-blue-400/20 text-blue-300'
                                }`}>
                                  {item.rarity}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold">{item.name}</h3>
                              <p className="text-xs text-[#8BA4BE] mt-0.5">{item.description}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-lg font-bold text-[#FACC15]">🪙 {item.price}</span>
                                <MarketItemCard item={item} variant="compact" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Carousel dots */}
                  <div className="flex justify-center gap-1 mt-2 pb-1">
                    {featuredItems.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCarouselIdx(i)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          carouselIdx === i ? 'bg-[#00D4FF]' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00D4FF]/50 transition-all"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {categories.map(cat => {
                const isAll = cat === 'all';
                const config = isAll ? { icon: '📦', label: 'All', color: '#00D4FF' } : CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'text-white'
                        : 'text-[#8BA4BE] hover:text-white bg-white/5'
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: config.color + '20', color: config.color, border: `1px solid ${config.color}40` } : {}}
                  >
                    {config.icon} {config.label}
                  </button>
                );
              })}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map(item => (
                <MarketItemCard key={item.id} item={item} />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-[#8BA4BE]">
                <span className="text-4xl block mb-2">🔍</span>
                <p className="text-sm">No items found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'trades' && <TradeCenter />}
      </div>
    </div>
  );
}