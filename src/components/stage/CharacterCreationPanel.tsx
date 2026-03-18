/**
 * CharacterCreationPanel — Backward-compatible wrapper around MapleCreationPanel
 *
 * Keeps the exact same props interface so OnboardingQuest.tsx is untouched.
 * Internally delegates to MapleCreationPanel for the full customization UI,
 * then writes extended fields to the appearance store before calling the
 * original onConfirm with the legacy shape.
 */

import { useCallback } from 'react';
import { MapleCreationPanel } from './MapleCreationPanel';
import type { MapleCreationResult } from './MapleCreationPanel';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import './CharacterCreationPanel.css';

interface CharacterCreationPanelProps {
  initialClass: string;
  onConfirm: (appearance: { skinTone: string; hairColor: string; bodyColor: string; name: string }) => void;
  onUpdate: (appearance: { skinTone?: string; hairColor?: string; bodyColor?: string }) => void;
}

export function CharacterCreationPanel({ initialClass, onConfirm, onUpdate }: CharacterCreationPanelProps) {
  const handleConfirm = useCallback((result: MapleCreationResult) => {
    // Write extended fields to the appearance store so CharacterManager can read them
    useCharacterAppearanceStore.getState().set({
      hairStyleIdx: result.hairStyleIdx,
      faceTypeIdx: result.faceTypeIdx,
      eyeColor: result.eyeColor,
      topIdx: result.topIdx,
      bottomIdx: result.bottomIdx,
      shoesIdx: result.shoesIdx,
      capeIdx: result.capeIdx,
      hatIdx: result.hatIdx,
      weaponIdx: result.weaponIdx,
      topColor: result.topColor,
      bottomColor: result.bottomColor,
      shoesColor: result.shoesColor,
    });

    // Call original onConfirm with legacy shape only
    onConfirm({
      skinTone: result.skinTone,
      hairColor: result.hairColor,
      bodyColor: result.bodyColor,
      name: result.name,
    });
  }, [onConfirm]);

  const handleUpdate = useCallback((partial: Partial<MapleCreationResult>) => {
    // Forward only legacy fields
    const legacy: { skinTone?: string; hairColor?: string; bodyColor?: string } = {};
    if (partial.skinTone !== undefined) legacy.skinTone = partial.skinTone;
    if (partial.hairColor !== undefined) legacy.hairColor = partial.hairColor;
    if (partial.bodyColor !== undefined) legacy.bodyColor = partial.bodyColor;
    if (Object.keys(legacy).length > 0) {
      onUpdate(legacy);
    }
  }, [onUpdate]);

  return (
    <MapleCreationPanel
      initialClass={initialClass}
      onConfirm={handleConfirm}
      onUpdate={handleUpdate}
    />
  );
}
