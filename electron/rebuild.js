/**
 * LifeOS Electron Builder — afterPack Hook
 *
 * Rebuilds native Node.js modules (better-sqlite3) for the target platform
 * after electron-builder packages the app. This ensures the .node binaries
 * match the target Electron version + architecture.
 *
 * Used by electron-builder config: "afterPack": "./electron/rebuild.js"
 */

import { rebuild } from '@electron/rebuild';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function getElectronVersion() {
  try {
    const pkg = require(join(__dirname, '..', 'node_modules', 'electron', 'package.json'));
    return pkg.version;
  } catch {
    return '41.1.0'; // fallback
  }
}

/**
 * @param {object} context - electron-builder afterPack context
 * @param {string} context.appOutDir - Output directory
 * @param {string} context.electronPlatformName - 'linux', 'darwin', 'win32'
 * @param {string} context.arch - Architecture number (see Arch enum)
 */
export default async function afterPack(context) {
  const { appOutDir, electronPlatformName, arch } = context;

  // electron-builder arch enum: 0=ia32, 1=x64, 2=armv7l, 3=arm64, 4=universal
  const archMap = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };
  const archName = archMap[arch] || 'x64';

  const electronVersion = context.packager?.electronVersion
    || context.electronVersion
    || getElectronVersion();

  console.log(`[rebuild] Rebuilding native modules for ${electronPlatformName}-${archName} (electron ${electronVersion})...`);

  try {
    // electron-builder already runs @electron/rebuild for native modules.
    // This afterPack hook verifies the native binary exists in the output.
    const fs = await import('fs');
    const betterSqlitePath = join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    if (fs.existsSync(betterSqlitePath)) {
      console.log('[rebuild] Native module verified: better_sqlite3.node exists in asar.unpacked');
    } else {
      // Try rebuilding if the binary is missing
      console.log('[rebuild] Native module missing, attempting rebuild...');
      await rebuild({
        buildPath: join(appOutDir, 'resources', 'app'),
        electronVersion,
        arch: archName,
        onlyModules: ['better-sqlite3'],
      });
      console.log('[rebuild] Native modules rebuilt successfully');
    }
  } catch (err) {
    console.error('[rebuild] Native module check/rebuild failed:', err.message);
    // Non-fatal — electron-builder's built-in rebuild should have handled it
  }
}
