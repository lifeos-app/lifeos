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
import { createServer } from 'node:http';
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
// Local OAuth Callback Server
// ─────────────────────────────────────────────────────────────
// On Linux, custom protocol handlers (lifeos://) lose the URL
// fragment (#access_token=...) when the OS routes the URL back.
// Solution: spin up a temporary localhost HTTP server that serves
// a page to extract the fragment and post the tokens to Electron.
// ═══════════════════════════════════════════════════════════════

let oauthCallbackServer = null;
let oauthCallbackPort = null;
let pendingOAuthResolve = null;

function startOAuthCallbackServer() {
  if (oauthCallbackServer) return oauthCallbackPort;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${oauthCallbackPort}`);

      if (url.pathname === '/auth/callback') {
        // Serve the HTML page that extracts the hash fragment and posts it back
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html><head><title>LifeOS — Logging in...</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0A1628;color:#E2E8F0}
.card{text-align:center;padding:48px;background:#111827;border:1px solid #1A3A5C;border-radius:12px;max-width:400px}
h2{color:#00D4FF;margin:0 0 12px}.spin{display:inline-block;width:24px;height:24px;border:3px solid #1A3A5C;border-top-color:#00D4FF;border-radius:50%;animation:rot 0.6s linear infinite;margin-bottom:12px}
@keyframes rot{to{transform:rotate(360deg)}}</style></head>
<body><div class="card"><div class="spin"></div><h2>Almost there!</h2><p>Redirecting back to LifeOS...</p></div>
<script>
// The tokens are in the URL hash fragment — extract them and post back
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const access_token = params.get('access_token');
const refresh_token = params.get('refresh_token');
if (access_token && refresh_token) {
  // Send tokens to the local Electron server
  fetch('/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token, refresh_token })
  }).then(() => {
    document.querySelector('.card').innerHTML = '<h2>✓ Logged in!</h2><p>You can close this tab and return to LifeOS.</p>';
  }).catch(err => {
    document.querySelector('.card').innerHTML = '<h2>Error</h2><p>' + err.message + '</p>';
  });
} else {
  document.querySelector('.card').innerHTML = '<h2>No tokens found</h2><p>Please try again from the LifeOS app.</p>';
}
</script></body></html>`);
        return;
      }

      if (url.pathname === '/auth/token' && req.method === 'POST') {
        // Receive tokens from the callback page
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const tokens = JSON.parse(body);
            if (tokens.access_token && tokens.refresh_token) {
              // Forward tokens to the Electron renderer via the pending callback
              if (pendingOAuthResolve) {
                pendingOAuthResolve(tokens);
                pendingOAuthResolve = null;
              }
              // Also dispatch directly to the renderer if window is available
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.executeJavaScript(`
                  (function() {
                    window.dispatchEvent(new CustomEvent('electron-auth-callback', {
                      detail: { access_token: '${tokens.access_token}', refresh_token: '${tokens.refresh_token}' }
                    }));
                  })();
                `);
                mainWindow.focus();
              }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end('{"error":"invalid json"}');
          }
        });
        return;
      }

      // 404 for anything else
      res.writeHead(404);
      res.end('Not found');
    });

    // Listen on a fixed port for OAuth callbacks (32123 is easy to remember)
    // This port must be registered in the Supabase dashboard redirect URLs
    const OAUTH_PORT = 32123;
    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      const port = server.address().port;
      oauthCallbackServer = server;
      oauthCallbackPort = port;
      console.log(`[oauth] Local callback server listening on http://127.0.0.1:${port}`);
      resolve(port);
    });

    server.on('error', (err) => {
      console.error('[oauth] Callback server error:', err);
      reject(err);
    });
  });
}

function stopOAuthCallbackServer() {
  if (oauthCallbackServer) {
    oauthCallbackServer.close();
    oauthCallbackServer = null;
    oauthCallbackPort = null;
  }
}

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
    icon: join(__dirname, '..', 'public', 'icon-512.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
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

  // Get the OAuth callback port (starts the server if needed)
  ipcMain.handle('oauth:get-callback-port', async () => {
    const port = await startOAuthCallbackServer();
    return port;
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
      oauthCallbackPort,
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
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,VaapiVideoDecodeLinuxGL');
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
}

app.whenReady().then(async () => {
  // Initialize database
  initDatabase(dbPath);

  // Register custom protocol for media files
  registerMediaProtocol();

  // Register IPC handlers
  registerIpcHandlers();

  // Start OAuth callback server on startup (lazy — only starts when first requested)
  // The server starts when oauth:get-callback-port IPC is called from the renderer.

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

// GPU process crash handler — prevents hard exit on Jetson ARM
app.on('gpu-process-crashed', (_event, details) => {
  console.error('[electron] GPU process crashed:', details);
  // Don't exit — let the app continue with software rendering fallback
});

// Render process gone handler — try to recover window
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[electron] Render process gone:', details);
  // Try to reload the window if possible
  if (!details.killed && mainWindow && !mainWindow.isDestroyed()) {
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
  stopOAuthCallbackServer();
});
