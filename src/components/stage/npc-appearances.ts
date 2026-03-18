/**
 * NPC Appearance Definitions — Visual configs for NPC characters on stage
 *
 * These define how NPCs look when rendered via drawCharacter() on the StageCanvas.
 */

import type { StageCharacterAppearance } from './types';

export const NPC_APPEARANCES: Record<string, StageCharacterAppearance> = {
  sage: {
    skinTone: '#B8A090',      // weathered/aged skin — matches sage.png hooded mystic
    hairColor: '#D0D0D0',     // silver-white beard
    bodyColor: '#1A2A4A',     // dark navy hooded robe
    classIcon: '✝️',
    name: 'The Sage',
    level: 99,
  },
  warrior: {
    skinTone: '#D19A6B',
    hairColor: '#2C1608',     // dark hair
    bodyColor: '#8B0000',     // red armor
    classIcon: '⚔️',
    name: 'The Warrior',
    level: 50,
  },
  merchant: {
    skinTone: '#FDDBB4',
    hairColor: '#DAA520',     // golden hair
    bodyColor: '#8B6914',     // brown/gold outfit
    classIcon: '💰',
    name: 'The Merchant',
    level: 75,
  },
};

/** NPC-themed bubble colors for speech bubbles on the stage */
export const NPC_BUBBLE_COLORS: Record<string, { border: string; bg: string }> = {
  sage: {
    border: 'rgba(0, 212, 255, 0.4)',
    bg: 'rgba(0, 30, 60, 0.85)',
  },
  warrior: {
    border: 'rgba(57, 255, 20, 0.4)',
    bg: 'rgba(0, 30, 10, 0.85)',
  },
  merchant: {
    border: 'rgba(255, 215, 0, 0.4)',
    bg: 'rgba(40, 30, 0, 0.85)',
  },
  player: {
    border: 'rgba(74, 144, 217, 0.4)',
    bg: 'rgba(10, 20, 40, 0.85)',
  },
};
