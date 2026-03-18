/**
 * Character Appearance Store
 *
 * Lightweight Zustand store caching the character's visual appearance
 * so MiniCharacter and other components can render without loading from Supabase each time.
 */

import { create } from 'zustand';
import { loadCharacter } from '../rpg/engine/CharacterManager';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../rpg/data/sprites';
import { getClassInfo } from '../rpg/data/classes';
import type { CharacterClass } from '../rpg/engine/types';
import { RealmEventBus } from '../realm/bridge/RealmEventBus';

interface CharacterAppearanceState {
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  classIcon: string;
  name: string;
  level: number;
  characterClass: CharacterClass;
  loaded: boolean;
  // New chibi fields
  hairStyleIdx: number;
  faceTypeIdx: number;
  eyeColor: string;
  topIdx: number;
  bottomIdx: number;
  shoesIdx: number;
  capeIdx: number;
  hatIdx: number;
  weaponIdx: number;
  topColor: string;
  bottomColor: string;
  shoesColor: string;
  set: (data: Partial<Omit<CharacterAppearanceState, 'loaded' | 'set' | 'loadFromSupabase'>>) => void;
  loadFromSupabase: (userId: string) => Promise<void>;
}

export const useCharacterAppearanceStore = create<CharacterAppearanceState>((set, get) => ({
  skinTone: SKIN_TONES[4],
  hairColor: HAIR_COLORS[0],
  bodyColor: '#4A90D9',
  classIcon: '⚔️',
  name: 'Adventurer',
  level: 1,
  characterClass: 'warrior',
  loaded: false,
  // Defaults
  hairStyleIdx: 0,
  faceTypeIdx: 0,
  eyeColor: '#2C1608',
  topIdx: 0,
  bottomIdx: 0,
  shoesIdx: 0,
  capeIdx: -1,
  hatIdx: -1,
  weaponIdx: -1,
  topColor: '#4A90D9',
  bottomColor: '#2C3E50',
  shoesColor: '#6B3A2A',

  set: (data) => set({ ...data, loaded: true }),

  loadFromSupabase: async (userId: string) => {
    if (get().loaded) return;
    // Immediately mark loaded to prevent concurrent calls / infinite retry
    set({ loaded: true });
    let char;
    try {
      char = await loadCharacter(userId);
    } catch {
      // Error loading — already marked loaded, keep defaults
      return;
    }
    if (!char) return; // No character yet — keep defaults, already marked loaded

    const classInfo = getClassInfo(char.characterClass);
    set({
      skinTone: SKIN_TONES[char.appearance.skinTone ?? 4] || SKIN_TONES[4],
      hairColor: HAIR_COLORS[char.appearance.hairColor ?? 0] || HAIR_COLORS[0],
      bodyColor: classInfo.color,
      classIcon: classInfo.icon,
      name: char.name,
      level: char.level,
      characterClass: char.characterClass,
      loaded: true,
      // New fields from DB (with fallbacks)
      hairStyleIdx: char.appearance.hairStyle ?? 0,
      faceTypeIdx: char.appearance.faceType ?? 0,
      eyeColor: EYE_COLORS[char.appearance.eyeColorIdx ?? 0] || '#2C1608',
      topIdx: char.appearance.outfit ?? 0,
      bottomIdx: char.appearance.bottomStyle ?? 0,
      shoesIdx: char.appearance.shoeStyle ?? 0,
      capeIdx: char.appearance.capeStyle ?? -1,
      hatIdx: char.appearance.hatStyle ?? -1,
      weaponIdx: char.appearance.weaponStyle ?? -1,
      topColor: classInfo.color,
      bottomColor: '#2C3E50',
      shoesColor: '#6B3A2A',
    });
  },
}));

// Subscribe to level_up events to keep level in sync
RealmEventBus.on('level_up', (event) => {
  const newLevel = (event.data as { newLevel: number }).newLevel;
  if (newLevel) {
    useCharacterAppearanceStore.setState({ level: newLevel });
  }
});
