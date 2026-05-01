/**
 * Location-Aware Context — Barrel Export
 *
 * Geofencing, auto-logging travel, context-aware UI switching.
 * Your phone finally understands where you are and what you need.
 */

export { LocationContextPage } from './LocationContext';
export { PlacesManager } from './PlacesManager';
export { LocationAutomations } from './LocationAutomations';
export { TravelLogView } from './TravelLogView';
export { LocationHistory } from './LocationHistory';
export { useLocationContext, haversineDistance } from './useLocationContext';
export type { SavedLocation, LocationAutomation, AutomationAction, TravelLog, LocationHistoryEntry, LocationType, ContextMode, TravelPurpose, AutomationTrigger } from '../../stores/locationStore';