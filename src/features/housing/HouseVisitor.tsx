/**
 * HouseVisitor.tsx — Visit other players' houses
 *
 * Read-only house view, leave gifts, guestbook messages,
 * rate houses, and browse featured rooms.
 */

import { useState, useMemo } from 'react';
import { useHousingStore, HOUSE_THEMES, type PlayerHouse, type HouseVisitor } from '../../stores/housingStore';
import { useMarketStore } from '../../stores/marketStore';

// Mock featured houses for demo
const MOCK_HOUSES: PlayerHouse[] = [
  {
    id: 'featured-1',
    userId: 'user-alex',
    username: 'AlexTheExplorer',
    theme: 'forest',
    items: [
      { id: '1', type: 'furniture', name: 'Bookshelf', icon: '📚', rarity: 'common', x: 0, y: 0, width: 1, height: 2, source: 'purchase', equipped: true },
      { id: '2', type: 'trophy', name: 'Streak Master', icon: '🔥', rarity: 'rare', x: 2, y: 0, width: 1, height: 1, source: 'achievement', sourceId: 'streak_master', equipped: true },
      { id: '3', type: 'decoration', name: 'Crystal Orb', icon: '🔮', rarity: 'rare', x: 4, y: 3, width: 1, height: 1, source: 'purchase', equipped: true },
      { id: '4', type: 'companion', name: 'Companion Bed', icon: '🐾', rarity: 'common', x: 6, y: 4, width: 1, height: 1, source: 'purchase', equipped: true },
      { id: '5', type: 'lighting', name: 'Fairy Lights', icon: '✨', rarity: 'rare', x: 5, y: 0, width: 1, height: 1, source: 'purchase', equipped: true },
    ],
    visitors: [],
    visitorCount: 142,
    lastDecoratedAt: '2026-04-28T10:00:00Z',
    rating: 4.7,
    ratingCount: 38,
  },
  {
    id: 'featured-2',
    userId: 'user-luna',
    username: 'LunaWarrior',
    theme: 'cosmic',
    items: [
      { id: '1', type: 'trophy', name: 'War Champion', icon: '⚔️', rarity: 'epic', x: 0, y: 0, width: 1, height: 1, source: 'war_reward', equipped: true },
      { id: '2', type: 'trophy', name: 'Realm Explorer', icon: '🗺️', rarity: 'legendary', x: 1, y: 0, width: 1, height: 1, source: 'achievement', sourceId: 'realm_explorer', equipped: true },
      { id: '3', type: 'furniture', name: 'Grand Piano', icon: '🎹', rarity: 'epic', x: 3, y: 2, width: 2, height: 1, source: 'achievement', equipped: true },
      { id: '4', type: 'wall', name: 'Victory Banner', icon: '🚩', rarity: 'rare', x: 5, y: 0, width: 2, height: 1, source: 'war_reward', equipped: true },
      { id: '5', type: 'floor', name: 'Potted Plant', icon: '🪴', rarity: 'common', x: 6, y: 4, width: 1, height: 1, source: 'purchase', equipped: true },
    ],
    visitors: [],
    visitorCount: 289,
    lastDecoratedAt: '2026-04-30T18:00:00Z',
    rating: 4.9,
    ratingCount: 67,
  },
  {
    id: 'featured-3',
    userId: 'user-kai',
    username: 'KaiSage',
    theme: 'ocean',
    items: [
      { id: '1', type: 'furniture', name: 'Cozy Bed', icon: '🛏️', rarity: 'common', x: 0, y: 3, width: 2, height: 2, source: 'purchase', equipped: true },
      { id: '2', type: 'decoration', name: 'Music Box', icon: '🎵', rarity: 'rare', x: 3, y: 1, width: 1, height: 1, source: 'quest', equipped: true },
      { id: '3', type: 'lighting', name: 'Warm Lantern', icon: '🪔', rarity: 'common', x: 5, y: 0, width: 1, height: 1, source: 'purchase', equipped: true },
      { id: '4', type: 'floor', name: 'Woven Rug', icon: '🟫', rarity: 'common', x: 2, y: 4, width: 2, height: 1, source: 'purchase', equipped: true },
    ],
    visitors: [],
    visitorCount: 76,
    lastDecoratedAt: '2026-04-15T12:00:00Z',
    rating: 4.3,
    ratingCount: 15,
  },
];

export function HouseVisitor() {
  const { houses } = useHousingStore();
  const coins = useMarketStore((s) => s.inventory.coins);

  const allHouses = useMemo(() => [...MOCK_HOUSES, ...houses], [houses]);
  const [selectedHouse, setSelectedHouse] = useState<PlayerHouse | null>(null);
  const [guestMessage, setGuestMessage] = useState('');
  const [giftAmount, setGiftAmount] = useState(10);
  const [userRating, setUserRating] = useState(0);
  const [leftGift, setLeftGift] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const selectedTheme = selectedHouse
    ? HOUSE_THEMES.find((t) => t.id === selectedHouse.theme) || HOUSE_THEMES[0]
    : null;

  const rarityBorder: Record<string, string> = {
    common: 'border-gray-500/40',
    rare: 'border-blue-400/50',
    epic: 'border-purple-400/60',
    legendary: 'border-yellow-400/70',
  };

  const rarityLabel: Record<string, string> = {
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
  };

  const handleLeaveGift = () => {
    if (coins < giftAmount) return;
    useMarketStore.getState().addCoins(-giftAmount, `gift_to_${selectedHouse?.userId}`);
    setLeftGift(true);
  };

  const handleSendMessage = () => {
    if (!guestMessage.trim()) return;
    setMessageSent(true);
    setGuestMessage('');
    setTimeout(() => setMessageSent(false), 3000);
  };

  const handleRate = (rating: number) => {
    setUserRating(rating);
    if (selectedHouse) {
      useHousingStore.getState().rateHouse(selectedHouse.id, rating);
    }
  };

  // House detail view
  if (selectedHouse) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedHouse(null)}
          className="text-[#00D4FF] text-sm hover:underline flex items-center gap-1"
        >
          ← Back to houses
        </button>

        {/* House Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {selectedHouse.theme === 'default' ? '🏠' : selectedTheme?.icon} {selectedHouse.username}'s Space
            </h2>
            <p className="text-xs text-[#8BA4BE]">
              {selectedTheme?.name} • 👥 {selectedHouse.visitorCount} visitors • ⭐ {selectedHouse.rating.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Read-Only Room View */}
        <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${selectedTheme?.bgClass || 'from-amber-900/20 to-stone-900/30'}`}
             style={{ minHeight: 280 }}>
          <div className="relative p-4" style={{ minHeight: 260 }}>
            <div className="grid gap-1" style={{
              gridTemplateColumns: 'repeat(8, 1fr)',
              gridTemplateRows: 'repeat(6, 44px)',
            }}>
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="border border-white/5 rounded-sm" />
              ))}
            </div>

            {/* Items overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {selectedHouse.items.map(item => (
                <div
                  key={item.id}
                  className={`absolute rounded-lg border-2 ${rarityBorder[item.rarity]} bg-[#0F2D4A]/70 backdrop-blur-sm flex flex-col items-center justify-center`}
                  style={{
                    left: `${(item.x / 8) * 100}%`,
                    top: `${(item.y / 6) * 100}%`,
                    width: `${(item.width / 8) * 100}%`,
                    height: `${(item.height / 6) * 100}%`,
                  }}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[8px] text-white/50">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Guestbook */}
        <div className="bg-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">📖 Guestbook</h3>
          
          {/* Leave a message */}
          <div className="flex gap-2 mb-3">
            <input
              value={guestMessage}
              onChange={(e) => setGuestMessage(e.target.value)}
              placeholder="Leave a kind note..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00D4FF]/50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!guestMessage.trim()}
              className="px-3 py-2 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg text-sm font-medium hover:bg-[#00D4FF]/30 disabled:opacity-30 transition-all"
            >
              Send
            </button>
          </div>
          {messageSent && (
            <div className="text-xs text-[#39FF14] mb-2">✓ Message sent!</div>
          )}

          {/* Visitor messages */}
          {selectedHouse.visitors.length > 0 && (
            <div className="space-y-2">
              {selectedHouse.visitors.slice(-5).map((v, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  <span className="text-sm">{v.leftGift ? '🎁' : '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-[#8BA4BE]">{v.username}</span>
                    {v.message && <p className="text-xs text-white/60 truncate">{v.message}</p>}
                  </div>
                  <span className="text-[10px] text-white/30">
                    {new Date(v.visitedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Leave a Gift */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#39FF14] mb-2">🎁 Leave a Gift</h3>
            <p className="text-xs text-[#8BA4BE] mb-2">Send coins to the house owner</p>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setGiftAmount(Math.max(5, giftAmount - 5))}
                className="w-8 h-8 rounded bg-white/10 text-white flex items-center justify-center"
              >-</button>
              <span className="text-lg font-bold text-[#FACC15]">{giftAmount}</span>
              <button
                onClick={() => setGiftAmount(Math.min(coins, giftAmount + 5))}
                className="w-8 h-8 rounded bg-white/10 text-white flex items-center justify-center"
              >+</button>
            </div>
            <button
              onClick={handleLeaveGift}
              disabled={leftGift || coins < giftAmount}
              className="w-full py-2 bg-[#39FF14]/20 text-[#39FF14] rounded-lg text-sm font-medium hover:bg-[#39FF14]/30 disabled:opacity-30 transition-all"
            >
              {leftGift ? '✓ Gift Sent!' : `Send ${giftAmount} coins`}
            </button>
            <p className="text-[10px] text-white/30 mt-1">Your coins: {coins}</p>
          </div>

          {/* Rate */}
          <div className="bg-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#FACC15] mb-2">⭐ Rate This House</h3>
            <div className="flex gap-1 justify-center mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  className={`text-2xl transition-all ${
                    star <= userRating ? 'text-[#FACC15] scale-110' : 'text-white/20'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {userRating > 0 && (
              <p className="text-xs text-[#FACC15] text-center">You rated {userRating} star{userRating > 1 ? 's' : ''}!</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // House list view
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">🏠 Explore Houses</h2>
      <p className="text-sm text-[#8BA4BE]">Visit other players' spaces, leave gifts, and find inspiration!</p>

      {/* Featured Section */}
      <div>
        <h3 className="text-sm font-semibold text-[#D4AF37] mb-2">⭐ Featured Houses</h3>
        <div className="space-y-3">
          {allHouses.map(house => {
            const houseTheme = HOUSE_THEMES.find(t => t.id === house.theme) || HOUSE_THEMES[0];
            return (
              <button
                key={house.id}
                onClick={() => setSelectedHouse(house)}
                className="w-full text-left bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-all border border-white/5 hover:border-[#00D4FF]/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${houseTheme.bgClass} flex items-center justify-center text-xl`}>
                    {houseTheme.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{house.username}</div>
                    <div className="text-xs text-[#8BA4BE]">
                      {houseTheme.name} • {house.items.length} items
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#FACC15]">⭐ {house.rating.toFixed(1)}</span>
                      <span className="text-xs text-white/30">👥 {house.visitorCount}</span>
                    </div>
                  </div>
                  <div className="text-[#00D4FF] text-xl">→</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}