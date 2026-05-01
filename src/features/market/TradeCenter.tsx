/**
 * TradeCenter.tsx — Player-to-player trading
 *
 * Propose trades, negotiate, accept/reject/counter-offer,
 * and view trade history.
 */

import React, { useState } from 'react';
import { useMarket, MARKET_ITEMS } from './useMarket';
import type { TradeOffer } from '../../stores/marketStore';
import { useUserStore } from '../../stores/useUserStore';

export function TradeCenter() {
  const {
    inventory,
    coins,
    ownedItems,
    trades,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    counterTrade,
    cancelTrade,
  } = useMarket();

  const user = useUserStore((s) => s.user);
  const [mode, setMode] = useState<'active' | 'history' | 'new'>('active');
  const [newTradePartner, setNewTradePartner] = useState('');
  const [selectedOwnItems, setSelectedOwnItems] = useState<string[]>([]);
  const [selectedRequestedItems, setSelectedRequestedItems] = useState<string[]>([]);
  const [offeredCoins, setOfferedCoins] = useState(0);
  const [requestedCoins, setRequestedCoins] = useState(0);
  const [tradeMessage, setTradeMessage] = useState('');

  const activeTrades = trades.filter((t) => t.status === 'pending');
  const completedTrades = trades.filter((t) => t.status !== 'pending');

  const toggleOwnItem = (id: string) => {
    setSelectedOwnItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleRequestedItem = (id: string) => {
    setSelectedRequestedItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handlePropose = () => {
    if (!newTradePartner.trim()) return;
    proposeTrade({
      fromUserId: user?.id || '',
      fromUsername: user?.email?.split('@')[0] || 'You',
      toUserId: newTradePartner,
      toUsername: newTradePartner,
      offeredItems: selectedOwnItems,
      offeredCoins,
      requestedItems: selectedRequestedItems,
      requestedCoins,
      message: tradeMessage || 'Let\'s trade!',
    });
    // Reset
    setSelectedOwnItems([]);
    setSelectedRequestedItems([]);
    setOfferedCoins(0);
    setRequestedCoins(0);
    setNewTradePartner('');
    setTradeMessage('');
    setMode('active');
  };

  const statusColors: Record<TradeOffer['status'], { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-[#FACC15]/20', text: 'text-[#FACC15]', label: '⏳ Pending' },
    accepted: { bg: 'bg-[#39FF14]/20', text: 'text-[#39FF14]', label: '✓ Accepted' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: '✕ Rejected' },
    countered: { bg: 'bg-[#00D4FF]/20', text: 'text-[#00D4FF]', label: '🔄 Countered' },
    cancelled: { bg: 'bg-white/5', text: 'text-white/30', label: '🚫 Cancelled' },
  };

  const getItemName = (id: string) => {
    const item = MARKET_ITEMS.find(m => m.id === id);
    return item ? `${item.icon} ${item.name}` : id;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">🤝 Trade Center</h2>

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {[
          { id: 'active' as const, label: 'Active' },
          { id: 'new' as const, label: 'New Trade' },
          { id: 'history' as const, label: 'History' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === tab.id
                ? 'bg-[#FACC15]/20 text-[#FACC15]'
                : 'text-[#8BA4BE] hover:text-white'
            }`}
          >
            {tab.label} {tab.id === 'active' && activeTrades.length > 0 ? `(${activeTrades.length})` : ''}
          </button>
        ))}
      </div>

      {mode === 'active' && (
        <div className="space-y-3">
          {activeTrades.length === 0 ? (
            <div className="text-center py-8 text-[#8BA4BE]">
              <span className="text-3xl block mb-2">🤝</span>
              <p className="text-sm">No active trades</p>
              <p className="text-xs mt-1">Propose a trade to get started!</p>
            </div>
          ) : (
            activeTrades.map(trade => {
              const sc = statusColors[trade.status];
              return (
                <div key={trade.id} className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium text-sm">{trade.fromUsername === user?.email?.split('@')[0] ? 'You' : trade.fromUsername}</span>
                      <span className="text-[#8BA4BE] text-sm mx-1">→</span>
                      <span className="font-medium text-sm">{trade.toUsername}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#8BA4BE] mb-3">"{trade.message}"</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Offered:</span>
                      <div className="flex gap-1">
                        {trade.offeredItems.map(id => (
                          <span key={id} className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{getItemName(id)}</span>
                        ))}
                        {trade.offeredCoins > 0 && <span className="text-xs text-[#FACC15]">🪙 {trade.offeredCoins}</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Requested:</span>
                      <div className="flex gap-1">
                        {trade.requestedItems.map(id => (
                          <span key={id} className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{getItemName(id)}</span>
                        ))}
                        {trade.requestedCoins > 0 && <span className="text-xs text-[#FACC15]">🪙 {trade.requestedCoins}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Action buttons if trade is for this user */}
                  <div className="flex gap-2 mt-3 pt-2 border-t border-white/5">
                    <button
                      onClick={() => acceptTrade(trade.id)}
                      className="flex-1 py-1.5 bg-[#39FF14]/20 text-[#39FF14] rounded-lg text-xs font-medium hover:bg-[#39FF14]/30 transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => counterTrade(trade.id, {})}
                      className="flex-1 py-1.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg text-xs font-medium hover:bg-[#00D4FF]/30 transition-all"
                    >
                      Counter
                    </button>
                    <button
                      onClick={() => rejectTrade(trade.id)}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-4">
          {/* Partner */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">Trade Partner</h3>
            <input
              value={newTradePartner}
              onChange={e => setNewTradePartner(e.target.value)}
              placeholder="Enter username..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FACC15]/50"
            />
          </div>

          {/* Your Offer */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#00D4FF] mb-2">Your Offer</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {ownedItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleOwnItem(item.id)}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    selectedOwnItems.includes(item.id)
                      ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]'
                      : 'border-white/10 bg-[#0F2D4A]/40'
                  }`}
                >
                  <span className="text-lg block">{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">+ Coins:</span>
              <input
                type="number"
                min={0}
                max={coins}
                value={offeredCoins}
                onChange={e => setOfferedCoins(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-[#FACC15] focus:outline-none"
              />
            </div>
          </div>

          {/* Requested */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#FACC15] mb-2">You Want</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {MARKET_ITEMS.filter(m => !ownedItems.find(o => o.id === m.id)).slice(0, 12).map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleRequestedItem(item.id)}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    selectedRequestedItems.includes(item.id)
                      ? 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
                      : 'border-white/10 bg-[#0F2D4A]/40'
                  }`}
                >
                  <span className="text-lg block">{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">+ Coins:</span>
              <input
                type="number"
                min={0}
                value={requestedCoins}
                onChange={e => setRequestedCoins(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-[#FACC15] focus:outline-none"
              />
            </div>
          </div>

          {/* Message */}
          <div className="bg-white/5 rounded-xl p-4">
            <input
              value={tradeMessage}
              onChange={e => setTradeMessage(e.target.value)}
              placeholder="Add a message (optional)..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FACC15]/50"
            />
          </div>

          <button
            onClick={handlePropose}
            disabled={!newTradePartner.trim() || (selectedOwnItems.length === 0 && offeredCoins === 0)}
            className="w-full py-3 bg-[#FACC15] text-black rounded-xl font-bold text-sm hover:bg-[#FACC15]/80 disabled:opacity-30 transition-all"
          >
            Propose Trade
          </button>
        </div>
      )}

      {mode === 'history' && (
        <div className="space-y-3">
          {completedTrades.length === 0 ? (
            <div className="text-center py-8 text-[#8BA4BE]">
              <span className="text-3xl block mb-2">📜</span>
              <p className="text-sm">No trade history yet</p>
            </div>
          ) : (
            completedTrades.map(trade => {
              const sc = statusColors[trade.status];
              return (
                <div key={trade.id} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">
                      {trade.fromUsername} → {trade.toUsername}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {new Date(trade.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}