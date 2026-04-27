/**
 * App-level IPC Handlers
 *
 * Registers IPC channels for application-level operations:
 *   academy:overview → getAcademyOverview()
 *   xp:add           → addXp(params)
 *   context:get      → getLifeContext()
 *   steam:status     → getSteamStatus()
 *   app:info         → version, platform, arch, electron, dbPath, isDev
 *   open-external    → shell.openExternal(url)
 */

import { ipcMain, shell, app } from 'electron';
import { getAcademyOverview, addXp, getLifeContext } from '../database.js';
import { getSteamStatus } from '../steam.js';

/**
 * @param {{ dbPath: string, isDev: boolean }} opts
 */
export function registerAppHandlers(opts) {
  // Academy overview
  ipcMain.handle('academy:overview', () => {
    return getAcademyOverview();
  });

  // XP system
  ipcMain.handle('xp:add', (_event, params) => {
    return addXp(params);
  });

  // Life context (aggregated dashboard data)
  ipcMain.handle('context:get', () => {
    return getLifeContext();
  });

  // Steam status
  ipcMain.handle('steam:status', () => {
    return getSteamStatus();
  });

  // Open URL in system browser
  ipcMain.handle('open-external', (_event, url) => {
    return shell.openExternal(url);
  });

  // App info
  ipcMain.handle('app:info', () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      dbPath: opts.dbPath,
      isDev: opts.isDev,
    };
  });
}