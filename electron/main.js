/**
 * LifeOS Electron Main Process
 *
 * Creates the BrowserWindow, initializes SQLite, registers IPC handlers,
 * and optionally initializes Steam (x86_64 only, graceful ARM64 fallback).
 *
 * IPC handlers are decomposed into focused modules under ./ipc/:
 *   db-handlers.js    → db:query, db:rpc
 *   file-handlers.js  → file:read, file:media, file:list
 *   app-handlers.js   → academy:overview, xp:add, context:get, steam:status, open-external, app:info
 *   auth-handlers.js  → open-auth-popup, cancel-auth-popup
 */

import { app, BrowserWindow, protocol, shell } from 'electron';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initDatabase,
  closeDatabase,
  getDbPath,
} from './database.js';
import { initSteam } from './steam.js';
import { registerDbHandlers } from './ipc/db-handlers.js';
import { registerFileHandlers, isPathAllowed } from './ipc/file-handlers.js';
import { registerAppHandlers } from './ipc/app-handlers.js';
import { registerAuthHandlers } from './ipc/auth-handlers.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const isDev = !app.isPackaged;

// Register lifeos-media:// as a privileged standard scheme so the renderer
// can use it as an audio/video src. Must be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
  { scheme: 'lifeos-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// extractTokensAndResolve() is now in ./ipc/auth-handlers.js

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
// activeAuthWin is now tracked in ./ipc/auth-handlers.js

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LifeOS — Command Center',
    icon: join(__dirname, '..', 'public', 'icon-512.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 via preload
    },
    show: false,
  });

  // Prevent the main window from generating spurious new windows.
  // All navigation to external URLs goes through shell.openExternal
  // or the auth popup. Without this, window.open() calls in the page
  // (e.g. Google OAuth's account picker / one-tap prompts) create
  // additional BrowserWindows — the "3 windows on sign-in" bug.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the system browser instead of a new Electron window
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' }; // never create a new Electron window
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

// isPathAllowed() and ALLOWED_DIRS are now in ./ipc/file-handlers.js

function registerMediaProtocol() {
  protocol.handle('lifeos-media', (request) => {
    // URL format: lifeos-media:///absolute/path/to/file.mp3
    // Path segments are percent-encoded to handle spaces and special chars.
    const raw = request.url.replace(/^lifeos-media:\/\//, '');
    const filePath = raw.split('/').map(s => decodeURIComponent(s)).join('/');
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
// IPC Handlers — delegated to focused modules under ./ipc/
// ═══════════════════════════════════════════════════════════════

function registerIpcHandlers() {
  registerDbHandlers();
  registerFileHandlers();
  registerAppHandlers({ dbPath, isDev });
  registerAuthHandlers({
    getMainWindow: () => mainWindow,
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

// ═══════════════════════════════════════════════════════════════
// GPU / Rendering — Jetson ARM fix
// Chromium's GPU process crashes on Jetson Orin Nano (exit_code=133).
// Use software rendering for Mesa/ARM compatibility.
// ═══════════════════════════════════════════════════════════════

const isJetson = process.arch === 'arm64' && process.platform === 'linux';
if (isJetson) {
  // Jetson Orin Nano: Mesa/ARM GPU crashes Chromium repeatedly.
  // Must use full software rendering stack — no GPU process at all.
  // These flags MUST be set before app.whenReady().
  app.disableHardwareAcceleration(); // kills GPU process entirely — Chromium falls back to Skia software rasterizer
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  // NOTE: do NOT add disable-software-rasterizer here — that kills the only rendering path left
  // after disableHardwareAcceleration(). SwiftShader/ANGLE also removed: they are GPU paths
  // and are irrelevant once hardware accel is disabled.
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,VaapiVideoDecodeLinuxGL');
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
  // Jetson /dev/shm has limited permissions and stale IPC files from NVIDIA services.
  // Tell Chromium to use /tmp instead — prevents FATAL shared memory errors.
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  // CRITICAL: The env TMPDIR may be set to /mnt/data/tmp/scratch, which overrides
  // Chromium's --disable-dev-shm-usage redirect from /dev/shm → /tmp. If TMPDIR
  // points to a path where shared memory creation fails, the renderer crashes with
  // exitCode 133 (SIGTRAP / GPU watchdog). Force TMPDIR to /tmp for the entire process.
  if (process.env.TMPDIR && process.env.TMPDIR !== '/tmp') {
    console.log(`[jetson] Overriding TMPDIR from ${process.env.TMPDIR} to /tmp for Chromium shared memory compatibility`);
    process.env.TMPDIR = '/tmp';
    process.env.TEMP = '/tmp';
    process.env.TMP = '/tmp';
  }
}

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

// Child process crash handler (replaces removed gpu-process-crashed event in Electron 39+)
app.on('child-process-gone', (_event, details) => {
  console.error('[electron] Child process gone:', details.type, details.reason, details.exitCode);
  // Don't exit — let the app continue with software rendering fallback
});

// Render process gone handler — try to recover window
// details.reason is a string in Electron 41: 'clean-exit'|'abnormal-exit'|'killed'|'crashed'|'oom'|'launch-failed'|'integrity-failure'
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[electron] Render process gone:', details.reason, 'exitCode:', details.exitCode);
  // Only auto-reload on abnormal exits, not on intentional kills
  if (details.reason !== 'killed' && details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload();
  }
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
