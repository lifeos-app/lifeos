/**
 * PlayerHousing.tsx — Main housing page
 *
 * Cozy, personal space in Life City. Isometric room view with
 * placed items, trophy shelf, companion display, and theme selection.
 */

import React, { useState } from 'react';
import { usePlayerHousing, LIGHTING_OPTIONS } from './usePlayerHousing';
import { HouseThemes } from './HouseThemes';
import { HouseEditor } from './HouseEditor';
import { HouseVisitor } from './HouseVisitor';
import { useHousingStore, HOUSE_THEMES } from '../../stores/housingStore';

export function PlayerHousing() {
  const {
    myHouse,
    editMode,
    gridSnap,
    trophies,
    companionItems,
    unlockedThemes,
    error,
    toggleEditMode,
    selectItem,
    saveChanges,
  } = usePlayerHousing();

  const [activeTab, setActiveTab] = useState<'room' | 'themes' | 'visit'>('room');
  const [lighting, setLighting] = useState<string>('ambient');

  const theme = useHousingStore((s) => {
    const themeId = s.myHouse?.theme || 'default';
    return HOUSE_THEMES.find((t) => t.id === themeId) || HOUSE_THEMES[0];
  });

  const items = myHouse?.items || [];
  const wallItems = items.filter(i => i.type === 'wall');
  const floorItems = items.filter(i => i.type === 'floor' || i.type === 'furniture');
  const decoItems = items.filter(i => i.type === 'decoration');
  const lightingItems = items.filter(i => i.type === 'lighting');

  const lightingClass = LIGHTING_OPTIONS.find(l => l.id === lighting)?.class || '';

  // Rarity colors
  const rarityBorder: Record<string, string> = {
    common: 'border-gray-500',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400',
  };
  const rarityGlow: Record<string, string> = {
    common: '',
    rare: 'shadow-blue-400/30 shadow-md',
    epic: 'shadow-purple-400/40 shadow-lg',
    legendary: 'shadow-yellow-400/50 shadow-lg animate-pulse',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0f2d4a] to-[#0a1628] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3 bg-gradient-to-b from-[#0a1628] to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🏠 My Space
            </h1>
            <p className="text-xs text-[#8BA4BE] mt-0.5">
              {myHouse?.theme === 'default' ? 'Cozy Cabin' : theme?.name || 'Home'} • {myHouse?.visitorCount || 0} visitors
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleEditMode}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                editMode
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                  : 'bg-white/5 text-[#8BA4BE] border border-white/10'
              }`}
            >
              {editMode ? '✏️ Editing' : '✏️ Edit'}
            </button>
            {editMode && (
              <button
                onClick={saveChanges}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/50 hover:bg-[#39FF14]/30 transition-all"
              >
                💾 Save
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1">
          {(['room', 'themes', 'visit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                  : 'text-[#8BA4BE] hover:text-white'
              }`}
            >
              {tab === 'room' ? '🏠 Room' : tab === 'themes' ? '🎨 Themes' : '👥 Visit'}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-20">
        {activeTab === 'room' && (
          <div className="space-y-4">
            {/* Room View */}
            <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${theme?.bgClass || 'from-amber-900/20 to-stone-900/30'} ${lightingClass} transition-all`}
                 style={{ minHeight: 320 }}>
              {/* Isometric Room Grid */}
              <div className="relative p-4" style={{ minHeight: 300 }}>
                {/* Room Title */}
                <div className="absolute top-2 left-4 z-10 text-xs text-white/40 font-mono">
                  {theme?.icon} {theme?.name} • Grid {gridSnap ? 'ON' : 'OFF'}
                </div>

                {/* The Grid */}
                <div className="grid gap-1" style={{
                  gridTemplateColumns: `repeat(8, 1fr)`,
                  gridTemplateRows: `repeat(6, 48px)`,
                }}>
                  {/* Background cells */}
                  {Array.from({ length: 48 }).map((_, i) => {
                    const col = i % 8;
                    const row = Math.floor(i / 8);
                    return (
                      <div
                        key={`cell-${i}`}
                        className={`border border-white/5 rounded-sm transition-colors ${
                          editMode ? 'hover:border-[#00D4FF]/30 cursor-pointer' : ''
                        }`}
                        onClick={() => editMode && selectItem(null)}
                      />
                    );
                  })}
                </div>

                {/* Placed Items overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 ${rarityBorder[item.rarity]} ${rarityGlow[item.rarity]} bg-[#0F2D4A]/80 backdrop-blur-sm flex flex-col items-center justify-center transition-all hover:scale-105 ${
                        useHousingStore.getState().selectedItemId === item.id ? 'ring-2 ring-[#00D4FF]' : ''
                      }`}
                      style={{
                        left: `${(item.x / 8) * 100}%`,
                        top: `${(item.y / 6) * 100}%`,
                        width: `${(item.width / 8) * 100}%`,
                        height: `${(item.height / 6) * 100}%`,
                      }}
                      onClick={() => selectItem(item.id)}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-[9px] text-white/60 truncate max-w-full px-0.5">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Bottom Bar — Lighting & Visitor Count */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-[#0a1628]/90 to-transparent">
                <div className="flex gap-1">
                  {LIGHTING_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setLighting(opt.id)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        lighting === opt.id
                          ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                      title={opt.name}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-white/40">
                  👥 {myHouse?.visitorCount || 0} visitors
                </span>
              </div>
            </div>

            {/* Edit Mode: House Editor */}
            {editMode && (
              <HouseEditor />
            )}

            {/* Trophy Shelf */}
            {trophies.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#D4AF37] mb-3 flex items-center gap-2">
                  🏆 Trophy Shelf
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {trophies.map(trophy => (
                    <div
                      key={trophy.id}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 ${rarityBorder[trophy.rarity]} ${rarityGlow[trophy.rarity]} bg-[#0F2D4A]/60 flex flex-col items-center justify-center`}
                    >
                      <span className="text-xl">{trophy.icon}</span>
                      <span className="text-[8px] text-white/50 truncate px-0.5">{trophy.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Companion Display */}
            {companionItems.length > 0 && (
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#F97316] mb-3 flex items-center gap-2">
                  🐾 Companion Corner
                </h3>
                <div className="flex gap-2">
                  {companionItems.map(comp => (
                    <div
                      key={comp.id}
                      className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-900/20 to-amber-900/20 border border-orange-500/30 flex flex-col items-center justify-center"
                    >
                      <span className="text-2xl">{comp.icon}</span>
                      <span className="text-[9px] text-white/50">{comp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#00D4FF]">{items.length}</div>
                <div className="text-xs text-[#8BA4BE]">Items</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#D4AF37]">{trophies.length}</div>
                <div className="text-xs text-[#8BA4BE]">Trophies</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-[#39FF14]">{unlockedThemes.length}</div>
                <div className="text-xs text-[#8BA4BE]">Themes</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'themes' && <HouseThemes />}
        {activeTab === 'visit' && <HouseVisitor />}
      </div>
    </div>
  );
}