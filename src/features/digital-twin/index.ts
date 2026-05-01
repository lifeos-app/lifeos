/**
 * Digital Twin — Barrel export
 *
 * AI behavioral model that learns your patterns and intervenes before you fall off.
 */

export { DigitalTwin, default } from './DigitalTwin';
export { TwinDashboard } from './TwinDashboard';
export { PredictionFeed } from './PredictionFeed';
export { InterventionPanel } from './InterventionPanel';
export { PatternDiscovery } from './PatternDiscovery';
export {
  useDigitalTwin,
  type BehavioralTraits,
  type BehavioralProfile,
  type BehavioralPattern,
  type Prediction,
  type Intervention,
  type BehavioralArchetype,
  type TwinState,
} from './useDigitalTwin';