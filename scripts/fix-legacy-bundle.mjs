/**
 * Post-build script: re-run Babel on the generated legacy bundle
 * to ensure optional chaining, nullish coalescing, and other Chrome 50
 * incompatible syntax are fully transpiled.
 *
 * Run after `npm run build`.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from '@babel/core';
import presetEnv from '@babel/preset-env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distAssets = resolve(__dirname, '../dist/assets');

const files = readdirSync(distAssets);
const legacyEntry = files.find(f => f.match(/^index-legacy-[A-Za-z0-9_-]+\.js$/));

if (!legacyEntry) {
  console.error('No index-legacy bundle found in dist/assets');
  process.exit(1);
}

const fullPath = resolve(distAssets, legacyEntry);
console.log(`[fix-legacy] Processing: ${legacyEntry}`);

const raw = readFileSync(fullPath, 'utf8');

// Check for modern syntax before
const optionalChainCount = (raw.match(/\?\./g) || []).length;
const nullishCount = (raw.match(/\?\?[^=]/g) || []).length;
console.log(`[fix-legacy] Before: ${optionalChainCount} ?. occurrences, ${nullishCount} ?? occurrences`);

const result = transformSync(raw, {
  babelrc: false,
  configFile: false,
  compact: true,
  targets: { chrome: '50' },
  assumptions: { setPublicClassFields: false },
  presets: [[presetEnv, {
    bugfixes: true,
    modules: false,
    shippedProposals: true,
    useBuiltIns: false,
  }]],
});

if (!result || !result.code) {
  console.error('[fix-legacy] Babel transform failed');
  process.exit(1);
}

const after = result.code;
const optionalChainAfter = (after.match(/\?\./g) || []).length;
const nullishAfter = (after.match(/\?\?[^=]/g) || []).length;
console.log(`[fix-legacy] After:  ${optionalChainAfter} ?. occurrences, ${nullishAfter} ?? occurrences`);

writeFileSync(fullPath, after, 'utf8');
console.log(`[fix-legacy] Done. Written to ${legacyEntry}`);
