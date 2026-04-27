/**
 * Capacitor Adapter — re-exports from capacitor-api.ts
 *
 * This file is the build-time alias target for Capacitor mobile builds.
 * Vite resolve.alias '@lifeos/db-adapter' points here when mode === 'capacitor'.
 */

export { supabase as db, supabase, dedup } from '../../capacitor-api';