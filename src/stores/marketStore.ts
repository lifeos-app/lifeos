/**
 * Market Store — Zustand with persist middleware
 *
 * Manages marketplace items, player inventory, coins, trading.
 * Offline-first with localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface MarketItem {
  id: string;
  name: string;
  description: string;
  category: 'cosmetic' | 'companion_skin' | 'furniture' | 'realm_deco' | 'boost' | 'bundle';
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  preview?: string;
  source: 'market' | 'achievement' | 'quest' | 'war' | 'seasonal';
  available: boolean;
  availableUntil?: string;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
  acquiredAt: string;
}

export interface PlayerInventory {
  coins: number;
  items: InventoryEntry[];
}

export interface TradeOffer {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  offeredItems: string[];
  offeredCoins: number;
  requestedItems: string[];
  requestedCoins: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'cancelled';
  message: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════
// MARKET CATALOG
// ═══════════════════════════════════════════════════

export const MARKET_ITEMS: MarketItem[] = [
  // Cosmetics
  { id: 'cos_001', name: 'Aurora Aura', description: 'A shimmering northern lights effect around your character', category: 'cosmetic', price: 500, rarity: 'rare', icon: '🌌', source: 'market', available: true },
  { id: 'cos_002', name: 'Golden Halo', description: 'A divine golden ring floating above your head', category: 'cosmetic', price: 1200, rarity: 'epic', icon: '😇', source: 'market', available: true },
  { id: 'cos_003', name: 'Shadow Cloak', description: 'A dark cloak that ripples with shadow energy', category: 'cosmetic', price: 800, rarity: 'rare', icon: '🧥', source: 'market', available: true },
  { id: 'cos_004', name: 'Phoenix Wings', description: 'Blazing wings of rebirth — legendary cosmetic', category: 'cosmetic', price: 5000, rarity: 'legendary', icon: '🔥', source: 'market', available: true },
  { id: 'cos_005', name: 'Sparkle Trail', description: 'Leave a trail of sparkles wherever you walk', category: 'cosmetic', price: 300, rarity: 'common', icon: '✨', source: 'market', available: true },
  { id: 'cos_006', name: 'Crown of Stars', description: '星辰皇冠 — a legendary crown from the cosmos', category: 'cosmetic', price: 8000, rarity: 'legendary', icon: '👑', source: 'achievement', available: true },

  // Companion Skins
  { id: 'skin_001', name: 'Frost Wolf', description: 'Transform your companion into an ice-furred wolf', category: 'companion_skin', price: 600, rarity: 'rare', icon: '🐺', source: 'market', available: true },
  { id: 'skin_002', name: 'Royal Lion', description: 'A noble lion skin for your companion', category: 'companion_skin', price: 2000, rarity: 'epic', icon: '🦁', source: 'market', available: true },
  { id: 'skin_003', name: 'Phoenix Companion', description: 'A reborn phoenix — the rarest companion skin', category: 'companion_skin', price: 10000, rarity: 'legendary', icon: '🦅', source: 'war', available: true },
  { id: 'skin_004', name: 'Shadow Cat', description: 'A sleek, dark feline companion', category: 'companion_skin', price: 450, rarity: 'common', icon: '🐈‍⬛', source: 'market', available: true },

  // Furniture
  { id: 'furn_001', name: 'Crystal Chandelier', description: 'Elegant crystal light fixture for your house', category: 'furniture', price: 400, rarity: 'rare', icon: '💎', source: 'market', available: true },
  { id: 'furn_002', name: 'Velvet Throne', description: 'A luxurious throne befitting a champion', category: 'furniture', price: 1500, rarity: 'epic', icon: '🪑', source: 'market', available: true },
  { id: 'furn_003', name: 'Enchanted Globe', description: 'A miniature world that slowly rotates', category: 'furniture', price: 250, rarity: 'common', icon: '🌍', source: 'market', available: true },

  // Realm Decorations
  { id: 'realm_001', name: 'Victory Monument', description: 'A stone monument celebrating your achievements', category: 'realm_deco', price: 1000, rarity: 'epic', icon: '🗿', source: 'war', available: true },
  { id: 'realm_002', name: 'Zen Garden', description: 'A peaceful garden for your Life City district', category: 'realm_deco', price: 700, rarity: 'rare', icon: '⛩️', source: 'market', available: true },
  { id: 'realm_003', name: 'War Torch', description: 'A burning torch from the war arena', category: 'realm_deco', price: 500, rarity: 'rare', icon: '🔥', source: 'war', available: true },

  // Boosts
  { id: 'boost_001', name: 'XP Flood', description: 'Gain 500 XP instantly', category: 'boost', price: 200, rarity: 'common', icon: '⚡', source: 'market', available: true },
  { id: 'boost_002', name: '2x XP Weekend', description: 'Double XP for 48 hours', category: 'boost', price: 800, rarity: 'rare', icon: '📈', source: 'market', available: true },
  { id: 'boost_003', name: 'Streak Shield', description: 'Protect your streak for 1 day', category: 'boost', price: 150, rarity: 'common', icon: '🛡️', source: 'market', available: true },

  // Bundles
  { id: 'bundle_001', name: 'Starter Pack', description: '3 furniture items + 500 coins + spark trail', category: 'bundle', price: 1500, rarity: 'rare', icon: '🎁', source: 'market', available: true },
  { id: 'bundle_002', name: 'Warrior Bundle', description: 'Shadow Cloak + War Torch + Victory Banner', category: 'bundle', price: 3000, rarity: 'epic', icon: '⚔️', source: 'market', available: true },
  { id: 'bundle_003', name: 'Cosmic Collection', description: 'Aurora Aura + Crown of Stars + Crystal Sanctum theme', category: 'bundle', price: 12000, rarity: 'legendary', icon: '🌌', source: 'seasonal', available: true, availableUntil: '2026-06-30' },
];

// ═══════════════════════════════════════════════════
// COIN EARNING MILESTONES
// ═══════════════════════════════════════════════════

export const COIN_MILESTONES: Record<string, { coins: number; label: string }> = {
  first_login: { coins: 100, label: 'Welcome Bonus' },
  daily_login: { coins: 10, label: 'Daily Login' },
  xp_100: { coins: 50, label: '100 XP Earned' },
  xp_500: { coins: 200, label: '500 XP Earned' },
  xp_1000: { coins: 500, label: '1,000 XP Earned' },
  quest_complete: { coins: 75, label: 'Quest Complete' },
  war_win: { coins: 300, label: 'War Victory' },
  streak_7: { coins: 100, label: '7-Day Streak' },
  streak_30: { coins: 500, label: '30-Day Streak' },
};

export const COIN_TO_XP_RATE = 0.1; // 1 coin = 0.1 XP

// ═══════════════════════════════════════════════════
// CATEGORY CONFIG
// ═══════════════════════════════════════════════════

export const CATEGORY_CONFIG: Record<MarketItem['category'], { label: string; icon: string; color: string }> = {
  cosmetic: { label: 'Cosmetics', icon: '✨', color: '#A855F7' },
  companion_skin: { label: 'Companion Skins', icon: '🐾', color: '#F97316' },
  furniture: { label: 'Furniture', icon: '🪑', color: '#D4AF37' },
  realm_deco: { label: 'Realm Decorations', icon: '🏰', color: '#22C55E' },
  boost: { label: 'Boosts', icon: '⚡', color: '#FACC15' },
  bundle: { label: 'Bundles', icon: '🎁', color: '#EF4444' },
};

// ═══════════════════════════════════════════════════
// STORE STATE & ACTIONS
// ═══════════════════════════════════════════════════

interface MarketState {
  inventory: PlayerInventory;
  trades: TradeOffer[];
  featuredItemIds: string[];
  searchQuery: string;
  selectedCategory: MarketItem['category'] | 'all';
  cart: string[]; // item IDs
  loading: boolean;
  error: string | null;

  // Actions
  purchaseItem: (itemId: string) => boolean;
  giftItem: (itemId: string, toUsername: string) => boolean;
  addCoins: (amount: number, reason: string) => void;
  proposeTrade: (trade: Omit<TradeOffer, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => TradeOffer;
  acceptTrade: (tradeId: string) => void;
  rejectTrade: (tradeId: string) => void;
  counterTrade: (tradeId: string, newOffer: Partial<TradeOffer>) => TradeOffer;
  cancelTrade: (tradeId: string) => void;
  addToCart: (itemId: string) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  checkout: () => boolean;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: MarketItem['category'] | 'all') => void;
  getFilteredItems: () => MarketItem[];
  ownsItem: (itemId: string) => boolean;
  getInventoryValue: () => number;
  refreshFromServer: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      inventory: { coins: 100, items: [] }, // Start with 100 welcome coins
      trades: [],
      featuredItemIds: ['cos_004', 'skin_003', 'bundle_003', 'cos_006'],
      searchQuery: '',
      selectedCategory: 'all',
      cart: [],
      loading: false,
      error: null,

      purchaseItem: (itemId) => {
        const item = MARKET_ITEMS.find((m) => m.id === itemId);
        if (!item || !item.available) {
          set({ error: 'Item not available' });
          return false;
        }
        const inv = get().inventory;
        if (inv.coins < item.price) {
          set({ error: 'Not enough coins!' });
          return false;
        }
        const now = new Date().toISOString();
        set({
          inventory: {
            coins: inv.coins - item.price,
            items: [
              ...inv.items,
              { itemId, quantity: 1, acquiredAt: now },
            ],
          },
          cart: get().cart.filter((id) => id !== itemId),
        });
        logger.info(`[market] Purchased: ${item.name} for ${item.price} coins`);
        return true;
      },

      giftItem: (itemId, toUsername) => {
        const inv = get().inventory;
        const entry = inv.items.find((i) => i.itemId === itemId);
        if (!entry || entry.quantity <= 0) {
          set({ error: 'You don\'t own this item' });
          return false;
        }
        set({
          inventory: {
            ...inv,
            items: inv.items.map((i) =>
              i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i
            ).filter((i) => i.quantity > 0),
          },
        });
        logger.info(`[market] Gifted ${itemId} to ${toUsername}`);
        return true;
      },

      addCoins: (amount, reason) => {
        set((s) => ({
          inventory: { ...s.inventory, coins: s.inventory.coins + amount },
        }));
        logger.info(`[market] +${amount} coins: ${reason}`);
      },

      proposeTrade: (tradeData) => {
        const trade: TradeOffer = {
          ...tradeData,
          id: genId(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ trades: [...s.trades, trade] }));
        return trade;
      },

      acceptTrade: (tradeId) => {
        const now = new Date().toISOString();
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId ? { ...t, status: 'accepted' as const, updatedAt: now } : t
          ),
        }));
        // In production, items would be swapped here
      },

      rejectTrade: (tradeId) => {
        const now = new Date().toISOString();
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId ? { ...t, status: 'rejected' as const, updatedAt: now } : t
          ),
        }));
      },

      counterTrade: (tradeId, newOffer) => {
        const now = new Date().toISOString();
        const original = get().trades.find((t) => t.id === tradeId);
        if (!original) return original!;
        const countered: TradeOffer = {
          ...original,
          ...newOffer,
          id: genId(),
          status: 'pending',
          message: `Counter-offer for: ${original.message}`,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          trades: [
            ...s.trades.map((t) =>
              t.id === tradeId ? { ...t, status: 'countered' as const, updatedAt: now } : t
            ),
            countered,
          ],
        }));
        return countered;
      },

      cancelTrade: (tradeId) => {
        const now = new Date().toISOString();
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId ? { ...t, status: 'cancelled' as const, updatedAt: now } : t
          ),
        }));
      },

      addToCart: (itemId) => {
        if (!get().cart.includes(itemId)) {
          set((s) => ({ cart: [...s.cart, itemId] }));
        }
      },

      removeFromCart: (itemId) => {
        set((s) => ({ cart: s.cart.filter((id) => id !== itemId) }));
      },

      clearCart: () => set({ cart: [] }),

      checkout: () => {
        const cart = get().cart;
        const inv = get().inventory;
        let totalCost = 0;
        for (const id of cart) {
          const item = MARKET_ITEMS.find((m) => m.id === id);
          if (item) totalCost += item.price;
        }
        if (inv.coins < totalCost) {
          set({ error: `Need ${totalCost - inv.coins} more coins!` });
          return false;
        }
        const now = new Date().toISOString();
        const newItems: InventoryEntry[] = cart.map((id) => ({ itemId: id, quantity: 1, acquiredAt: now }));
        set({
          inventory: {
            coins: inv.coins - totalCost,
            items: [...inv.items, ...newItems],
          },
          cart: [],
        });
        logger.info(`[market] Checkout: ${cart.length} items for ${totalCost} coins`);
        return true;
      },

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSelectedCategory: (category) => set({ selectedCategory: category }),

      getFilteredItems: () => {
        const { searchQuery, selectedCategory } = get();
        return MARKET_ITEMS.filter((item) => {
          const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
          return matchesSearch && matchesCategory && item.available;
        });
      },

      ownsItem: (itemId) => {
        return get().inventory.items.some((i) => i.itemId === itemId && i.quantity > 0);
      },

      getInventoryValue: () => {
        const inv = get().inventory;
        let value = 0;
        for (const entry of inv.items) {
          const item = MARKET_ITEMS.find((m) => m.id === entry.itemId);
          if (item) value += item.price * entry.quantity;
        }
        return value;
      },

      refreshFromServer: async () => {
        set({ loading: true, error: null });
        try {
          const { supabase } = await import('../lib/data-access');
          const { data, error } = await supabase
            .from('player_inventory')
            .select('*');
          if (error) throw error;
          if (data) {
            // Merge server data with local
            set({ inventory: data[0] as PlayerInventory || get().inventory });
          }
        } catch (err: any) {
          logger.error('[marketStore] refreshFromServer error:', err);
        } finally {
          set({ loading: false });
        }
      },

      setError: (error) => set({ error }),
    }),
    {
      name: 'lifeos-market',
      partialize: (state) => ({
        inventory: state.inventory,
        trades: state.trades,
      }),
    }
  )
);