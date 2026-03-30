/**
 * LifeOS Electron Main Process
 *
 * Creates the BrowserWindow, initializes SQLite, registers IPC handlers,
 * and optionally initializes Steam (x86_64 only, graceful ARM64 fallback).
 *
 * IPC channels mirror the Tauri command set:
 *   db:query       → execQuery(params)   — unified CRUD
 *   db:rpc         → execRpc(fn, params) — RPC calls
 *   file:read      → readAllowedFile(path)
 *   file:media     → readMediaBytes(path)
 *   file:list      → listAllowedDirectory(path)
 *   academy:overview → getAcademyOverview()
 *   xp:add         → addXp(params)
 *   context:get    → getLifeContext()
 */

import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initDatabase,
  closeDatabase,
  getDbPath,
  execQuery,
  execRpc,
  readAllowedFile,
  readMediaBytes,
  listAllowedDirectory,
  getAcademyOverview,
  addXp,
  getLifeContext,
} from './database.js';
import { initSteam, getSteamStatus } from './steam.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const isDev = !app.isPackaged;

// ═══════════════════════════════════════════════════════════════
// Database
// ═══════════════════════════════════════════════════════════════

// On Linux use ~/.lifeos/data.db (shared with Flask fallback);
// On Windows/macOS use standard Electron userData path
const dbPath = process.platform === 'linux'
  ? getDbPath()
  : getDbPath(app.getPath('userData'));

// ═══════════════════════════════════════════════════════════════
// Window
// ═══════════════════════════════════════════════════════════════

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LifeOS — Command Center',
    icon: join(__dirname, '..', 'public', 'favicon.svg'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 via preload
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const indexPath = join(__dirname, '..', 'dist', 'index.html');
  const hasBuiltFrontend = existsSync(indexPath);

  if (isDev && !hasBuiltFrontend) {
    // Dev mode without pre-built dist: load from Vite dev server
    const port = process.env.VITE_DEV_SERVER_PORT || 5173;
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production OR dev with pre-built dist
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ═══════════════════════════════════════════════════════════════
// Custom Protocol — serve media files (audio, images) from
// allowed directories without going through IPC for large files.
// URL: lifeos-media:///mnt/data/tmp/academy/study-music/file.mp3
// ═══════════════════════════════════════════════════════════════

const ALLOWED_DIRS = [
  '/mnt/data/tmp/academy/',
  '/mnt/data/prodigy/creative-engine/LifeOS/',
  '/home/tewedros/clawd/lifeOS_data/',
];

function isPathAllowed(filePath) {
  try {
    const real = resolve(filePath);
    return ALLOWED_DIRS.some(dir => real.startsWith(dir));
  } catch {
    return false;
  }
}

function registerMediaProtocol() {
  protocol.handle('lifeos-media', (request) => {
    const filePath = decodeURIComponent(request.url.replace('lifeos-media://', ''));
    if (!isPathAllowed(filePath) || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }

    const data = readFileSync(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
      mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac',
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
      svg: 'image/svg+xml', gif: 'image/gif',
      json: 'application/json', csv: 'text/csv', md: 'text/markdown',
    };

    return new Response(data, {
      headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// IPC Handlers
// ═══════════════════════════════════════════════════════════════

function registerIpcHandlers() {
  // Unified CRUD — the main data channel
  ipcMain.handle('db:query', (_event, params) => {
    return execQuery(params);
  });

  // RPC calls (e.g. get_table_columns)
  ipcMain.handle('db:rpc', (_event, fnName, fnParams) => {
    return execRpc(fnName, fnParams);
  });

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

  // Open URL in system browser (used for OAuth)
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
      dbPath,
      isDev,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// Deep Link Protocol — lifeos:// for Google OAuth callback
// ═══════════════════════════════════════════════════════════════

if (process.defaultApp) {
  // Dev mode: need to pass the script path for protocol registration
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('lifeos', process.execPath, [resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('lifeos');
}

// Single instance lock — second instance forwards deep link to first
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('lifeos://'));
    if (url && mainWindow) {
      handleAuthCallback(url);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Handle OAuth callback from lifeos:// deep link.
 * Extracts access_token and refresh_token from the URL fragment,
 * then dispatches a CustomEvent to the renderer process.
 */
function handleAuthCallback(url) {
  if (!mainWindow) return;
  // Tokens can be in hash (#) or query (?) depending on Supabase flow
  const hashPart = url.split('#')[1] || url.split('?')[1] || '';
  mainWindow.webContents.executeJavaScript(`
    (function() {
      var params = new URLSearchParams('${hashPart.replace(/'/g, "\\'")}');
      var access_token = params.get('access_token');
      var refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        window.dispatchEvent(new CustomEvent('electron-auth-callback', {
          detail: { access_token: access_token, refresh_token: refresh_token }
        }));
      }
    })();
  `);
}

// macOS: open-url event fires when the app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) handleAuthCallback(url);
});

// ═══════════════════════════════════════════════════════════════
// App Lifecycle
// ═══════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  // Initialize database
  initDatabase(dbPath);

  // Register custom protocol for media files
  registerMediaProtocol();

  // Register IPC handlers
  registerIpcHandlers();

  // Initialize Steam (x86_64 only, graceful fallback)
  await initSteam();

  // Create window
  createWindow();

  // macOS: re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  closeDatabase();
});
