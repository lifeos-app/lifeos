/**
 * Local API Adapter — re-exports from local-api.ts
 *
 * This file is the build-time alias target when VITE_USE_LOCAL_API is set
 * (or VITE_API_BASE_URL is set without a specific platform).
 */

export { supabase as db, supabase, dedup } from '../../local-api';