/**
 * LifeOS Steam Integration
 *
 * Provides Steam client initialization and license verification via steamworks.js.
 *
 * CRITICAL: steamworks.js will NOT work on ARM64/Jetson because the Steamworks SDK
 * is x86_64 only. This module MUST:
 *   - Wrap require('steamworks.js') in a try/catch
 *   - If it fails to load (ARM64, dev mode, no Steam), export no-op stubs
 *   - The app must run 100% fully functional without Steam
 *   - Never block app launch if Steam init fails
 *   - Log 'Steam not available — running in standalone mode' and continue normally
 */

let steamClient = null;
let steamAvailable = false;
let steamError = null;

/**
 * Initialize Steamworks. Call once at app startup.
 * Returns immediately — never blocks or throws.
 * @param {number} [appId] - Steam App ID (0 for dev/testing)
 */
export async function initSteam(appId = 0) {
  try {
    // Dynamic import — steamworks.js has native bindings that only exist for x86_64
    const steamworks = await import('steamworks.js');

    if (steamworks.init && typeof steamworks.init === 'function') {
      steamClient = steamworks.init(appId);
      steamAvailable = true;
      console.log('[steam] Steamworks initialized successfully');

      // Log Steam user info if available
      if (steamClient?.localplayer) {
        const name = steamClient.localplayer.getName();
        const id = steamClient.localplayer.getSteamId();
        console.log(`[steam] Logged in as: ${name} (${id})`);
      }
    } else if (steamworks.default?.init) {
      steamClient = steamworks.default.init(appId);
      steamAvailable = true;
      console.log('[steam] Steamworks initialized successfully (default export)');
    } else {
      throw new Error('steamworks.js has no init function');
    }
  } catch (err) {
    steamAvailable = false;
    steamError = err.message || String(err);
    console.log(`[steam] Steam not available — running in standalone mode (${steamError})`);
  }
}

/**
 * Get current Steam status for the renderer.
 * @returns {{ available: boolean, error: string | null, user: object | null }}
 */
export function getSteamStatus() {
  if (!steamAvailable || !steamClient) {
    return {
      available: false,
      error: steamError || 'Steam not initialized',
      user: null,
    };
  }

  try {
    const user = steamClient.localplayer
      ? {
          name: steamClient.localplayer.getName(),
          steamId: String(steamClient.localplayer.getSteamId()),
        }
      : null;

    return {
      available: true,
      error: null,
      user,
    };
  } catch (err) {
    return {
      available: true,
      error: null,
      user: null,
    };
  }
}

/**
 * Check if a specific DLC is owned.
 * @param {number} dlcAppId
 * @returns {boolean}
 */
export function isDlcOwned(dlcAppId) {
  if (!steamAvailable || !steamClient?.apps) return false;
  try {
    return steamClient.apps.isDlcInstalled(dlcAppId);
  } catch {
    return false;
  }
}

/**
 * Unlock a Steam achievement.
 * @param {string} achievementName
 * @returns {boolean}
 */
export function unlockAchievement(achievementName) {
  if (!steamAvailable || !steamClient?.achievement) return false;
  try {
    return steamClient.achievement.activate(achievementName);
  } catch {
    return false;
  }
}

/**
 * Run the Steam callback loop. Call periodically (e.g. every 100ms) if needed.
 * Some Steam features require regular callback processing.
 */
export function runCallbacks() {
  if (!steamAvailable || !steamClient) return;
  try {
    if (typeof steamClient.runCallbacks === 'function') {
      steamClient.runCallbacks();
    }
  } catch {
    // Ignore callback errors
  }
}
