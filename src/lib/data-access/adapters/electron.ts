/**
 * Electron Adapter — re-exports from electron-api.ts
 *
 * This file is the build-time alias target for Electron desktop builds.
 * Vite resolve.alias '@lifeos/db-adapter' points here when mode === 'desktop'
 * and ELECTRON_ENV is set.
 */

export { supabase as db, supabase, dedup } from '../../electron-api';