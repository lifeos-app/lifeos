/**
 * Supabase Cloud Adapter — re-exports from supabase.ts
 *
 * This file is the build-time alias target for web/cloud builds.
 * Vite resolve.alias '@lifeos/db-adapter' points here when no
 * desktop/mobile mode is active.
 */

export { supabase as db, supabase, dedup } from '../../supabase';