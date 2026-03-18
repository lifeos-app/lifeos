// ═══════════════════════════════════════════════════════════
// useJunction — Re-export facade
//
// Split into focused modules:
//   useJunctionTypes.ts    — shared type definitions
//   useJunctionHelpers.ts  — icon mapping & utility functions
//   useJunctionData.ts     — core data hook (traditions, figures, XP, equip/switch)
//   useJunctionActions.ts  — practices, calendar, wisdom, practice logging
// ═══════════════════════════════════════════════════════════

// Types
export type {
  JunctionPath,
  JunctionTradition,
  JunctionFigure,
  JunctionPractice,
  JunctionCalendarEntry,
  JunctionWisdomEntry,
  UserJunction,
  JunctionXPProgress,
} from './useJunctionTypes';

// Core data hook
export { useJunction } from './useJunctionData';

// Action hooks
export {
  useJunctionPractices,
  useJunctionCalendar,
  useJunctionWisdom,
  useLogPractice,
} from './useJunctionActions';
