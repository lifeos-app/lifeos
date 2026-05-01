/**
 * Voice-First Mode — Barrel Export
 *
 * Hands-free logging for LifeOS. Say "log 3 hours work at Sonder, mood is good, energy 7"
 * and the Intent Engine parses it. Think driving between cleaning jobs.
 */

export { VoiceFirstMode, default } from './VoiceFirstMode';
export { VoiceFloatingButton } from './VoiceFloatingButton';
export { VoiceWaveform } from './VoiceWaveform';
export { VoiceCommandHistory } from './VoiceCommandHistory';
export { VoiceQuickActions } from './VoiceQuickActions';
export { VoiceSettings } from './VoiceSettings';
export {
  useVoiceCommand,
  type VoiceCommandResult,
  type VoiceCommandHistoryEntry,
  type VoiceSettings,
  type VoiceState,
  type UseVoiceCommandReturn,
} from './useVoiceCommand';