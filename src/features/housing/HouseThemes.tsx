/**
 * HouseThemes.tsx — Theme selector
 *
 * Preview themes, view unlock conditions, apply themes,
 * and see seasonal themes.
 */

import React from 'react';
import { usePlayerHousing, HOUSE_THEMES } from './usePlayerHousing';
import type { HouseTheme } from '../../stores/housingStore';

export function HouseThemes() {
  const { myHouse, unlockedThemes, getThemeStatus, tryUnlockTheme, setTheme } = usePlayerHousing();
  const currentTheme = myHouse?.theme || 'default';

  const unlockLabels: Record<HouseTheme['unlockType'], string> = {
    default: 'Free',
    level: 'Unlock at Level',
    achievement: 'Achievement Required',
    purchase: 'Available for Purchase',
  };

  const unlockIcons: Record<HouseTheme['unlockType'], string> = {
    default: '✅',
    level: '🎯',
    achievement: '🏆',
    purchase: '🪙',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">🎨 Room Themes</h2>
      <p className="text-sm text-[#8BA4BE]">Transform your space with unique themes</p>

      <div className="space-y-3">
        {HOUSE_THEMES.map(theme => {
          const status = getThemeStatus(theme.id);
          const isCurrent = currentTheme === theme.id;
          const isUnlocked = status === 'unlocked';
          const isUnlockable = status === 'unlockable';

          let unlockText = '';
          if (theme.unlockType === 'default') unlockText = 'Free';
          else if (theme.unlockType === 'level') unlockText = `Level ${theme.unlockRequirement}`;
          else if (theme.unlockType === 'achievement') unlockText = `${theme.unlockRequirement}`;
          else if (theme.unlockType === 'purchase') unlockText = `${theme.unlockRequirement} coins`;

          return (
            <div
              key={theme.id}
              className={`rounded-xl overflow-hidden border transition-all ${
                isCurrent
                  ? 'border-[#00D4FF]/60 ring-2 ring-[#00D4FF]/30'
                  : isUnlocked
                  ? 'border-white/10 hover:border-[#00D4FF]/30'
                  : 'border-white/5 opacity-70'
              }`}
            >
              {/* Theme Preview */}
              <div
                className={`bg-gradient-to-br ${theme.bgClass} p-6 relative overflow-hidden`}
                style={{ minHeight: 120 }}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-20 text-7xl">
                  {theme.previewEmoji}
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{theme.icon}</span>
                    <h3 className="font-bold text-lg">{theme.name}</h3>
                    {isCurrent && (
                      <span className="text-xs bg-[#00D4FF]/30 text-[#00D4FF] px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70">{theme.description}</p>
                </div>
              </div>

              {/* Theme Actions */}
              <div className="p-3 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8BA4BE]">
                    {unlockIcons[theme.unlockType]} {unlockLabels[theme.unlockType]}
                  </span>
                  <span className="text-xs text-white/30">
                    {unlockText}
                  </span>
                </div>

                <div className="flex gap-2">
                  {isUnlocked && !isCurrent && (
                    <button
                      onClick={() => setTheme(theme.id)}
                      className="px-3 py-1.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg text-xs font-medium hover:bg-[#00D4FF]/30 transition-all"
                    >
                      Apply
                    </button>
                  )}
                  {isUnlockable && !isUnlocked && (
                    <button
                      onClick={() => tryUnlockTheme(theme.id)}
                      className="px-3 py-1.5 bg-[#FACC15]/20 text-[#FACC15] rounded-lg text-xs font-medium hover:bg-[#FACC15]/30 transition-all"
                    >
                      {theme.unlockType === 'purchase' ? `Buy (${theme.unlockRequirement} 🪙)` : 'Unlock'}
                    </button>
                  )}
                  {!isUnlocked && !isUnlockable && (
                    <span className="text-xs text-white/30 flex items-center gap-1">
                      🔒 Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seasonal Notice */}
      <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-purple-300 mb-1">🌌 Seasonal Themes</h3>
        <p className="text-xs text-white/50">
          Special themes appear during events! Check back during solstices, equinoxes, and holidays
          for limited-time room themes.
        </p>
      </div>
    </div>
  );
}