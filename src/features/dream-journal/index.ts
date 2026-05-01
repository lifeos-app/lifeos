/**
 * Dream Journal & Subconscious Tracker — Barrel Export
 *
 * Log dreams, tag recurring themes, AI pattern-match symbols
 * across Junction's 18 traditions. Maps dreams to mood/health
 * the next day. Deeply aligned with the Hermetic/spiritual dimension.
 */

export { DreamJournal } from './DreamJournal';
export { DreamSymbolExplorer } from './DreamSymbolExplorer';
export { DreamCorrelations } from './DreamCorrelations';
export { DreamCalendar } from './DreamCalendar';
export { DreamInterpreter } from './DreamInterpreter';
export {
  useDreamJournal,
  DREAM_MOODS,
  DREAM_SYMBOLS,
  SYMBOL_DATABASE,
} from './useDreamJournal';
export type { DreamSymbol, SymbolMeaning } from './useDreamJournal';
export type { DreamEntry, DreamMood } from '../../stores/dreamStore';