/**
 * Tauri Adapter — re-exports from tauri-api.ts
 *
 * This file is the build-time alias target for Tauri desktop builds.
 * Vite resolve.alias '@lifeos/db-adapter' points here when
 * TAURI_ENV_PLATFORM is set.
 */

export { supabase as db, supabase, dedup } from '../../tauri-api';