/**
 * useMarket.ts — Core hook for Market / Trade System
 *
 * Wraps the market store with business logic: filtering, cart,
 * purchases, gifting, trades, and coin earning.
 */

import { useCallback, useMemo } from 'react';
import {
  useMarketStore,
  MARKET_ITEMS,
  CATEGORY_CONFIG,
  COIN_MILESTONES,
  type MarketItem,
  type InventoryEntry,
  type PlayerInventory,
  type TradeOffer,
} from '../../stores/marketStore';

export type { MarketItem, InventoryEntry, PlayerInventory, TradeOffer };
export { MARKET_ITEMS, CATEGORY_CONFIG, COIN_MILESTONES };

export function useMarket() {
  const store = useMarketStore();
  const {
    inventory,
    trades,
    featuredItemIds,
    searchQuery,
    selectedCategory,
    cart,
    error,
    loading,
  } = store;

  // Get filtered items
  const filteredItems = useMemo(() => store.getFilteredItems(), [searchQuery, selectedCategory]);

  // Featured items
  const featuredItems = useMemo(
    () => MARKET_ITEMS.filter((item) => featuredItemIds.includes(item.id) && item.available),
    [featuredItemIds]
  );

  // Cart items with totals
  const cartItems = useMemo(
    () => cart.map((id) => MARKET_ITEMS.find((m) => m.id === id)).filter(Boolean) as MarketItem[],
    [cart]
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems]
  );

  // Owned items with details
  const ownedItems = useMemo(
    () =>
      inventory.items
        .map((entry) => {
          const item = MARKET_ITEMS.find((m) => m.id === entry.itemId);
          return item ? { ...item, quantity: entry.quantity, acquiredAt: entry.acquiredAt } : null;
        })
        .filter(Boolean) as (MarketItem & { quantity: number; acquiredAt: string })[],
    [inventory]
  );

  // Total collection value
  const collectionValue = useMemo(() => store.getInventoryValue(), [inventory]);

  // Check ownership
  const ownsItem = useCallback(
    (itemId: string) => store.ownsItem(itemId),
    [inventory]
  );

  // Purchase
  const purchaseItem = useCallback(
    (itemId: string) => store.purchaseItem(itemId),
    [store]
  );

  // Gift
  const giftItem = useCallback(
    (itemId: string, toUsername: string) => store.giftItem(itemId, toUsername),
    [store]
  );

  // Cart operations
  const addToCart = useCallback((id: string) => store.addToCart(id), [store]);
  const removeFromCart = useCallback((id: string) => store.removeFromCart(id), [store]);
  const clearCart = useCallback(() => store.clearCart(), [store]);
  const checkout = useCallback(() => store.checkout(), [store]);

  // Search/filter
  const setSearchQuery = useCallback((q: string) => store.setSearchQuery(q), [store]);
  const setSelectedCategory = useCallback(
    (c: MarketItem['category'] | 'all') => store.setSelectedCategory(c),
    [store]
  );

  // Trade operations
  const proposeTrade = useCallback(
    (trade: Omit<TradeOffer, 'id' | 'status' | 'createdAt' | 'updatedAt'>) =>
      store.proposeTrade(trade),
    [store]
  );
  const acceptTrade = useCallback((id: string) => store.acceptTrade(id), [store]);
  const rejectTrade = useCallback((id: string) => store.rejectTrade(id), [store]);
  const counterTrade = useCallback(
    (id: string, newOffer: Partial<TradeOffer>) => store.counterTrade(id, newOffer),
    [store]
  );
  const cancelTrade = useCallback((id: string) => store.cancelTrade(id), [store]);

  // Coin earning
  const addCoins = useCallback(
    (amount: number, reason: string) => store.addCoins(amount, reason),
    [store]
  );

  return {
    // State
    inventory,
    coins: inventory.coins,
    trades,
    featuredItems,
    filteredItems,
    searchQuery,
    selectedCategory,
    cart,
    cartItems,
    cartTotal,
    ownedItems,
    collectionValue,
    error,
    loading,

    // Actions
    ownsItem,
    purchaseItem,
    giftItem,
    addToCart,
    removeFromCart,
    clearCart,
    checkout,
    setSearchQuery,
    setSelectedCategory,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    counterTrade,
    cancelTrade,
    addCoins,
  };
}