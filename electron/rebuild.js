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

  console.log(`[rebuild] Rebuilding native modules for ${electronPlatformName}-${archName}...`);

  try {
    await rebuild({
      buildPath: appOutDir,
      electronVersion: context.packager?.electronVersion || process.env.npm_package_devDependencies_electron?.replace('^', ''),
      arch: archName,
      // Only rebuild modules that have native bindings
      onlyModules: ['better-sqlite3'],
    });
    console.log('[rebuild] Native modules rebuilt successfully');
  } catch (err) {
    console.error('[rebuild] Failed to rebuild native modules:', err.message);
    // Don't throw — allow the build to continue. The native module may
    // still work if it was pre-built for the target platform.
  }
}
