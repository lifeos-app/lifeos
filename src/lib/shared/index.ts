/**
 * SHARED INFRASTRUCTURE — LifeOS Feature Module Contract
 *
 * Features should import shared utilities from here, NOT from each other.
 * Cross-feature data flows through:
 *   1. Zustand stores (src/stores/)
 *   2. Shared types (src/types/)
 *   3. Shared utilities (src/lib/shared/ or src/utils/)
 *
 * Features NEVER import components from other feature pages.
 */

export { supabase } from '../supabase';
export { useUserStore } from '../../stores/useUserStore';
export { logger } from '../../utils/logger';
