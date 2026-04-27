/**
 * File IPC Handlers
 *
 * Registers IPC channels for file operations:
 *   file:read  → readAllowedFile(path)      — text file reading
 *   file:media → readMediaBytes(path)       — binary media reading
 *   file:list  → listAllowedDirectory(path) — directory listing
 *
 * Also owns the isPathAllowed() security helper and ALLOWED_DIRS
 * used by the lifeos-media:// custom protocol in main.js.
 */

import { ipcMain, app } from 'electron';
import { resolve, join } from 'node:path';
import { readAllowedFile, readMediaBytes, listAllowedDirectory } from '../database.js';

// Media directories allowed for the lifeos-media:// protocol.
// Override at runtime by setting LIFEOS_ALLOWED_DIRS (colon-separated paths).
const _defaultAllowedDirs = [
  '/mnt/data/tmp/academy/',
  join(app.getPath('home'), 'clawd', 'lifeOS_data') + '/',
];
const ALLOWED_DIRS = process.env.LIFEOS_ALLOWED_DIRS
  ? process.env.LIFEOS_ALLOWED_DIRS.split(':').filter(Boolean).map(d => d.endsWith('/') ? d : d + '/')
  : _defaultAllowedDirs;

export function isPathAllowed(filePath) {
  try {
    const real = resolve(filePath);
    return ALLOWED_DIRS.some(dir => real.startsWith(dir));
  } catch {
    return false;
  }
}

export function registerFileHandlers() {
  // File reading (text)
  ipcMain.handle('file:read', (_event, filePath) => {
    return readAllowedFile(filePath);
  });

  // Media reading (binary — returns Buffer for IPC transfer)
  ipcMain.handle('file:media', (_event, filePath) => {
    return readMediaBytes(filePath);
  });

  // Directory listing
  ipcMain.handle('file:list', (_event, dirPath) => {
    return listAllowedDirectory(dirPath);
  });
}