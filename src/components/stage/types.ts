/**
 * Stage Character Types — Shared types for StageCanvas character rendering
 */

export interface StageCharacterAppearance {
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  classIcon: string;
  name: string;
  level: number;
}

export interface StageCharacterBubble {
  text: string;
  startTime: number;       // performance.now()
  duration: number;        // ms, or Infinity for persistent
}

export interface StageCharacter {
  id: string;                      // 'sage' | 'warrior' | 'merchant' | 'player'
  cx: number;                      // X position on stage (0-1 normalized)
  cy: number;                      // Y position on stage (0-1 normalized)
  appearance: StageCharacterAppearance;
  direction: 'left' | 'right' | 'down';
  isMoving: boolean;
  walkFrame: number;
  mood: number;                    // 1-5
  visible: boolean;
  alpha: number;                   // for fade-in/out animations
  bubble?: StageCharacterBubble;
}
