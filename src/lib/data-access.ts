/**
 * DEPRECATED: use build-time alias injection via data-access/index.ts
 *
 * This file is kept for reference only. The new data-access barrel
 * (src/lib/data-access/index.ts) selects the correct adapter at build
 * time via Vite resolve.alias, eliminating runtime environment detection
 * bugs and removing dead code paths from each platform build.
 *
 * See TD-016 for the architectural rationale.
 *
 * This file now re-exports everything from the new barrel for backward
 * compatibility. All existing `import { ... } from './data-access'` and
 * `import { ... } from '../lib/data-access'` will resolve here, then
 * re-export from the build-time-injected adapter.
 */

export { db, supabase, dedup, getEnvironment, query, insert, update, remove, subscribe } from './data-access/index';
export type { DataEnvironment, QueryResult } from './data-access/index';