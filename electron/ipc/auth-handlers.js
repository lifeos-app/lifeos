/**
 * Auth IPC Handlers
 *
 * Registers IPC channels for OAuth popup operations:
 *   open-auth-popup   → opens a child BrowserWindow for Google auth
 *   cancel-auth-popup → closes any in-progress auth popup
 *
 * Owns the activeAuthWin state used to track the in-progress OAuth popup.
 * Also exports extractTokensAndResolve() for potential reuse.
 */

import { ipcMain, BrowserWindow } from 'electron';

// Tracks the in-progress OAuth popup window
let activeAuthWin = null;

/**
 * Get the current active auth window (used by deep-link handler in main.js).
 */
export function getActiveAuthWin() {
  return activeAuthWin;
}

/**
 * Extract OAuth tokens from a redirect URL and resolve the auth popup promise.
 */
export function extractTokensAndResolve(url, authWin, timeout, resolve, resolved) {
  if (resolved.done) return;
  resolved.done = true;
  clearTimeout(timeout);

  try {
    // Tokens could be in the hash fragment (#) or query string (?)
    const hashOrQuery = url.split('#')[1] || url.split('?')[1] || '';
    const params = new URLSearchParams(hashOrQuery);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      resolve({ access_token, refresh_token });
    } else {
      resolve(null);
    }
  } catch (e) {
    console.error('[auth] Error extracting tokens:', e);
    resolve(null);
  }

  authWin.close();
}

/**
 * @param {{ getMainWindow: () => BrowserWindow | null }} opts
 *   Provides access to the main window (for centering the popup).
 *   We use a getter because mainWindow is set after app.whenReady().
 */
export function registerAuthHandlers(opts) {
  // Cancel any in-progress auth popup (called by the renderer's Cancel button)
  ipcMain.handle('cancel-auth-popup', () => {
    if (activeAuthWin && !activeAuthWin.isDestroyed()) {
      activeAuthWin.close();
      activeAuthWin = null;
    }
  });

  // OAuth popup — opens a child BrowserWindow for Google auth, centered on
  // the main window. Watches for navigation with tokens in the URL hash and
  // resolves the promise with extracted tokens.
  ipcMain.handle('open-auth-popup', async (_event, authUrl) => {
    // Close any existing auth popup before opening a new one
    if (activeAuthWin && !activeAuthWin.isDestroyed()) {
      activeAuthWin.close();
      activeAuthWin = null;
    }

    const mainWindow = opts.getMainWindow();

    return new Promise((resolve, reject) => {
      let resolved = { done: false };

      // Center the popup relative to the main window
      const [mx, my] = mainWindow ? mainWindow.getPosition() : [0, 0];
      const [mw, mh] = mainWindow ? mainWindow.getSize() : [1280, 800];
      const popupW = 480, popupH = 640;
      const x = Math.round(mx + (mw - popupW) / 2);
      const y = Math.round(my + (mh - popupH) / 2);

      const authWin = new BrowserWindow({
        width: popupW,
        height: popupH,
        x, y,
        parent: mainWindow || undefined,
        modal: false,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // Do NOT use sandbox: true here — Google's sign-in page needs localStorage,
          // postMessage, and iframe APIs that Electron's sandbox blocks, causing a
          // blank white page. We load Google's URL (not our code) so nodeIntegration
          // false + contextIsolation true is sufficient.
          sandbox: false,
        },
        title: 'Sign in with Google — LifeOS',
        autoHideMenuBar: true,
      });
      activeAuthWin = authWin;

      // Prevent the auth popup from creating MORE windows.
      // Google's sign-in page tries to open new windows for account picker,
      // CAPTCHA, one-tap prompts etc — these must NOT spawn more BrowserWindows.
      // Instead, navigate the SAME popup window to that URL.
      authWin.webContents.setWindowOpenHandler(({ url }) => {
        // Navigate the auth popup itself to the requested URL
        // (account picker, etc.) instead of opening a new window.
        authWin.loadURL(url);
        return { action: 'deny' };
      });

      authWin.loadURL(authUrl);

      const timeout = setTimeout(() => {
        if (!resolved.done) {
          resolved.done = true;
          authWin.close();
          reject(new Error('Auth timeout — try again'));
        }
      }, 120000);

      // Unified handler: check URL for tokens and resolve once.
      // With implicit flow, Supabase redirects to redirectTo#access_token=...
      // We intercept that before the page loads and extract the tokens.
      const tryResolveFromUrl = (url) => {
        if (resolved.done) return;
        // Implicit flow: tokens in URL hash
        if (url.includes('access_token=')) {
          extractTokensAndResolve(url, authWin, timeout, resolve, resolved);
          return;
        }
        // PKCE fallback: code in query params — send to renderer to exchange
        if (url.includes('app.runlifeos.com') && url.includes('code=')) {
          extractTokensAndResolve(url, authWin, timeout, resolve, resolved);
        }
      };

      // Stop the popup from navigating AWAY to our callback URL
      // (we want to read the tokens from it, not actually load the page)
      // Electron 41 passes a details object as first arg (url is details.url)
      authWin.webContents.on('will-redirect', (details) => {
        const url = typeof details === 'string' ? details : (details.url || '');
        if (url.includes('access_token=') || url.includes('#access_token=')) {
          if (typeof details.preventDefault === 'function') details.preventDefault();
          tryResolveFromUrl(url);
        }
      });

      // Primary event: fires after the page has navigated (including hash changes)
      authWin.webContents.on('did-navigate', (_event, url) => {
        tryResolveFromUrl(url);
      });

      // Hash changes within the same page (Supabase puts tokens after #)
      authWin.webContents.on('did-navigate-in-page', (_event, url) => {
        tryResolveFromUrl(url);
      });

      authWin.on('closed', () => {
        activeAuthWin = null;
        if (!resolved.done) {
          resolved.done = true;
          clearTimeout(timeout);
          resolve(null); // User closed the window without completing auth
        }
      });
    });
  });
}