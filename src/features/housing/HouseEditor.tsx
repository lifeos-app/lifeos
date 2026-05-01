/**
 * HouseEditor.tsx — Room editing interface
 *
 * Grid overlay, item palette, drag-to-place, keyboard navigation,
 * delete, rotate, and save/cancel controls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlayerHousing } from './usePlayerHousing';
import { FURNITURE_CATALOG, GRID_WIDTH, GRID_HEIGHT } from '../../stores/housingStore';

const TYPE_TABS: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'furniture', label: 'Furniture', icon: '🪑' },
  { id: 'trophy', label: 'Trophies', icon: '🏆' },
  { id: 'decoration', label: 'Decor', icon: '🔮' },
  { id: 'companion', label: 'Companion', icon: '🐾' },
  { id: 'wall', label: 'Wall', icon: '🚩' },
  { id: 'floor', label: 'Floor', icon: '🟫' },
  { id: 'lighting', label: 'Light', icon: '💡' },
];

export function HouseEditor() {
  const {
    myHouse,
    gridSnap,
    selectedItem,
    selectedItemId,
    placeItemFromCatalog,
    removeItem,
    moveItem,
    selectItem,
    toggleGridSnap,
  } = usePlayerHousing();

  const [paletteTab, setPaletteTab] = useState('all');
  const [dragItem, setDragItem] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const items = myHouse?.items || [];

  // Arrow key movement
  useEffect(() => {
    if (!selectedItemId) return;
    const handler = (e: KeyboardEvent) => {
      const item = items.find((i) => i.id === selectedItemId);
      if (!item) return;
      const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (dx || dy) {
        e.preventDefault();
        moveItem(item.id, item.x + dx, item.y + dy);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeItem(item.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItemId, items, moveItem, removeItem]);

  // Filtered palette
  const filteredCatalog = FURNITURE_CATALOG.filter(
    (item) => paletteTab === 'all' || item.type === paletteTab
  );

  // Handle grid cell click
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (dragItem !== null) {
        placeItemFromCatalog(dragItem, x, y);
        setDragItem(null);
      }
    },
    [dragItem, placeItemFromCatalog]
  );

  // Handle rotation
  const handleRotate = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      // Swap positions for rotation feel
      moveItem(itemId, item.y, item.x);
    },
    [items, moveItem]
  );

  const rarityBorder: Record<string, string> = {
    common: 'border-gray-500/50',
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

  return (
    <div className="space-y-4">
      {/* Editing Toolbar */}
      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
        <button
          onClick={toggleGridSnap}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            gridSnap
              ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40'
              : 'bg-white/5 text-[#8BA4BE] border border-white/10'
          }`}
        >
          📐 Snap {gridSnap ? 'ON' : 'OFF'}
        </button>
        {selectedItemId && (
          <>
            <button
              onClick={() => handleRotate(selectedItemId)}
              className="px-2 py-1 rounded text-xs bg-white/5 text-[#8BA4BE] border border-white/10 hover:text-white transition-all"
            >
              🔄 Rotate
            </button>
            <button
              onClick={() => removeItem(selectedItemId)}
              className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all"
            >
              🗑️ Delete
            </button>
          </>
        )}
        <div className="ml-auto text-xs text-white/30">
          {selectedItem ? `Selected: ${selectedItem.name}` : 'Click item to select • Click grid to place'}
        </div>
      </div>

      {/* Item Palette */}
      <div className="bg-white/5 rounded-xl p-3">
        <h3 className="text-xs font-semibold text-[#8BA4BE] mb-2">Item Palette</h3>

        {/* Type Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setPaletteTab(tab.id)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-all ${
                paletteTab === tab.id
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                  : 'text-[#8BA4BE] hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Item Grid */}
        <div className="grid grid-cols-4 gap-2">
          {filteredCatalog.map((item, idx) => {
            const catalogIdx = FURNITURE_CATALOG.indexOf(item);
            return (
              <button
                key={item.name + idx}
                onClick={() => setDragItem(catalogIdx)}
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  dragItem === catalogIdx
                    ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]'
                    : `${rarityBorder[item.rarity]} bg-[#0F2D4A]/40 hover:bg-[#0F2D4A]/70 text-white/80`
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[9px] truncate w-full text-center mt-0.5">{item.name}</span>
                <span className="text-[8px] text-white/30">{rarityLabel[item.rarity]}</span>
              </button>
            );
          })}
        </div>

        {dragItem !== null && (
          <div className="mt-2 p-2 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg text-xs text-[#00D4FF] text-center animate-pulse">
            Click on the grid to place {FURNITURE_CATALOG[dragItem]?.name}
          </div>
        )}
      </div>

      {/* Interactive Grid */}
      <div className="bg-white/5 rounded-xl p-3">
        <h3 className="text-xs font-semibold text-[#8BA4BE] mb-2">Room Layout</h3>
        <div
          ref={gridRef}
          className="relative grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_HEIGHT}, 48px)`,
          }}
        >
          {Array.from({ length: GRID_WIDTH * GRID_HEIGHT }).map((_, i) => {
            const col = i % GRID_WIDTH;
            const row = Math.floor(i / GRID_WIDTH);
            return (
              <div
                key={`edit-${i}`}
                className="border border-white/5 rounded-sm hover:border-[#00D4FF]/40 cursor-pointer transition-colors min-h-[44px]"
                onClick={() => handleCellClick(col, row)}
              />
            );
          })}
        </div>

        {/* Items overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ position: 'relative' }}>
          <div className="relative" style={{ minHeight: GRID_HEIGHT * 50 }}>
            {items.map(item => (
              <div
                key={item.id}
                className={`absolute cursor-pointer rounded border-2 transition-all ${
                  selectedItemId === item.id
                    ? 'border-[#00D4FF] ring-2 ring-[#00D4FF]/30'
                    : rarityBorder[item.rarity]
                } bg-[#0F2D4A]/80 flex flex-col items-center justify-center hover:scale-105`}
                style={{
                  left: `${(item.x / GRID_WIDTH) * 100}%`,
                  top: `${(item.y / GRID_HEIGHT) * 100}%`,
                  width: `${(item.width / GRID_WIDTH) * 100}%`,
                  height: `${(item.height / GRID_HEIGHT) * 100}%`,
                }}
                onClick={() => selectItem(item.id)}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[8px] text-white/50 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}