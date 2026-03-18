// ═══════════════════════════════════════════════════════════
// EVENT OVERLAY SYSTEM — LifeOS
// Re-exports from event-overlay/ sub-components.
// This file maintains backwards compatibility for existing imports.
// ═══════════════════════════════════════════════════════════

export { useEventOverlay, EventOverlayProvider, EventOverlayPortal } from './event-overlay';
export type { ActiveEvent, OverlayState, EventOverlayContextValue, OverlayEventType, OverlayTab } from './event-overlay';
export { detectEventType } from './event-overlay';

// CSS import — stays here so existing side-effect is preserved
import './EventOverlay.css';
