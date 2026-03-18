// ═══ EventOverlay barrel exports ═══

// Context & hook (used by EventDrawer, EventDetail, Schedule, Layout)
export { useEventOverlay, EventOverlayProvider } from './EventOverlayContext';

// Portal (optional — currently unused since EventDrawer handles UI)
export { EventOverlayPortal } from './OverlayPanel';

// Types & helpers
export type { ActiveEvent, OverlayState, EventOverlayContextValue, OverlayEventType, OverlayTab } from './types';
export { detectEventType } from './types';
