/**
 * tab-coordinator.ts — BroadcastChannel-based multi-tab coordination
 *
 * Prevents race conditions when multiple tabs write concurrently by:
 * 1. Leader election: Only the leader tab runs periodic sync (every 5 min)
 * 2. Inter-tab messaging: Broadcasts local writes and sync completions
 * 3. Cache invalidation: Non-leader tabs invalidate stores on remote changes
 *
 * Leader election: Lowest sessionStorage tab ID wins. On leader close,
 * next-lowest tab takes over via BroadcastChannel.
 *
 * BroadcastChannel is available in all modern browsers, Electron
 * renderer processes, and web workers.
 */

import { logger } from '../utils/logger';
import type { TableName } from './local-db';

// ── BroadcastChannel Setup ──

const CHANNEL_NAME = 'lifeos-sync';

/**
 * Message types sent between tabs via BroadcastChannel.
 */
export type TabMessageType =
  | 'heartbeat'        // Leader heartbeat — tells others the leader is alive
  | 'leader-claim'     // Tab claims leadership
  | 'leader-resign'    // Leader tab is closing / resigning
  | 'local-write'     // A tab made a local DB write
  | 'sync-complete'   // The leader completed a sync cycle
  | 'force-invalidate'; // Request all tabs to invalidate caches

export interface TabMessage {
  type: TabMessageType;
  tabId: string;         // Sender's tab ID
  timestamp: number;     // When the message was sent
  table?: TableName;     // Relevant table (for local-write)
  recordId?: string;    // Relevant record ID (for local-write)
}

// ── Tab ID Management ──

const TAB_ID_KEY = 'lifeos_tab_id';

/**
 * Get or create a unique tab ID stored in sessionStorage.
 * sessionStorage is per-tab (not shared across tabs), making it ideal for
 * tab identification. Lowest ID = highest priority for leadership.
 */
function getTabId(): string {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    // Use a monotonic timestamp so earlier tabs get lower IDs
    id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

// ── Coordinator Class ──

/**
 * Callback type for when stores should be invalidated.
 * Called on 'local-write', 'sync-complete', and 'force-invalidate' messages.
 */
export type InvalidateCallback = (table?: TableName) => void;

export class TabCoordinator {
  private channel: BroadcastChannel | null = null;
  private readonly tabId: string;
  private _isLeader: boolean = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private leaderWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private onInvalidate: InvalidateCallback | null = null;
  private disposed = false;

  // Track known leader. Used by non-leaders to detect leader failure.
  private knownLeaderId: string | null = null;
  private lastLeaderHeartbeat: number = 0;

  // How often the leader sends heartbeats (ms)
  private static HEARTBEAT_INTERVAL = 10_000; // 10 seconds
  // How long without a heartbeat before a leader is considered dead (ms)
  private static LEADER_TIMEOUT = 30_000; // 30 seconds

  private _tabId: string;

  constructor() {
    this._tabId = getTabId();
  }

  // ── Public API ──

  /** Get this tab's unique ID */
  get tabId(): string {
    return this._tabId;
  }

  /** Whether this tab is the current leader (runs periodic sync) */
  get isLeader(): boolean {
    return this._isLeader;
  }

  /**
   * Initialize the coordinator. Sets up the BroadcastChannel,
   * begins leader election, and starts listening for messages.
   *
   * @param onInvalidate Callback when stores should be invalidated
   *                     (e.g., after another tab writes or sync completes)
   */
  init(onInvalidate: InvalidateCallback): void {
    if (this.channel) return; // already initialized
    this.onInvalidate = onInvalidate;

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this.handleMessage(event.data);
      };

      // Broadcast channel error handler
      this.channel.onmessageerror = () => {
        logger.warn('[tab-coord] BroadcastChannel message error');
      };
    } catch (e) {
      // BroadcastChannel not available (very old browser or SSR)
      logger.warn('[tab-coord] BroadcastChannel not available, running in single-tab mode:', e);
      this._isLeader = true;
      return;
    }

    logger.log(`[tab-coord] Initialized with tabId=${this.tabId}`);

    // Attempt to become leader immediately
    this.attemptLeadership();
  }

  /**
   * Broadcast that a local write has occurred.
   * Called by stores after localInsert/localUpdate/localDelete.
   * Other tabs will invalidate their caches for the affected table.
   */
  broadcastLocalWrite(table: TableName, recordId?: string): void {
    this.send({
      type: 'local-write',
      tabId: this.tabId,
      timestamp: Date.now(),
      table,
      recordId,
    });
  }

  /**
   * Broadcast that a sync cycle completed.
   * Called by the sync engine after pushing/pulling.
   * Other tabs will invalidate their caches to pick up server changes.
   */
  broadcastSyncComplete(): void {
    this.send({
      type: 'sync-complete',
      tabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  /**
   * Request all tabs to invalidate their caches.
   * Useful for manual refresh or after major operations.
   */
  broadcastForceInvalidate(): void {
    this.send({
      type: 'force-invalidate',
      tabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up. Should be called on tab close (beforeunload).
   * If this tab is the leader, it resigns so another tab can take over.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this._isLeader) {
      this.resignLeadership();
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.leaderWatchdogTimer) {
      clearTimeout(this.leaderWatchdogTimer);
      this.leaderWatchdogTimer = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    logger.log(`[tab-coord] Disposed tabId=${this.tabId}`);
  }

  // ── Leader Election ──

  /**
   * Attempt to claim leadership.
   * Strategy: Send a leader-claim message. The tab with the lowest
   * tabId (lexicographic) wins. Others defer.
   *
   * This is called on init and when the current leader is detected as dead.
   */
  private attemptLeadership(): void {
    // Claim leadership optimistically
    this.send({
      type: 'leader-claim',
      tabId: this.tabId,
      timestamp: Date.now(),
    });

    // We tentatively become leader. If a lower-ID tab responds,
    // we'll be demoted in handleMessage.
    this.becomeLeader();
  }

  /**
   * Become the leader: start heartbeats, start watchdog for others.
   */
  private becomeLeader(): void {
    if (this._isLeader) return;
    this._isLeader = true;
    this.knownLeaderId = this.tabId;
    this.lastLeaderHeartbeat = Date.now();

    logger.log(`[tab-coord] This tab is now the leader (tabId=${this.tabId})`);

    // Send periodic heartbeats so non-leaders know we're alive
    this.startHeartbeat();

    // Stop the leader watchdog (we ARE the leader now)
    if (this.leaderWatchdogTimer) {
      clearTimeout(this.leaderWatchdogTimer);
      this.leaderWatchdogTimer = null;
    }
  }

  /**
   * Demote from leader (a lower-ID tab claimed leadership).
   */
  private demote(): void {
    if (!this._isLeader) return;
    this._isLeader = false;

    logger.log(`[tab-coord] Demoted — another tab with lower ID claimed leadership`);

    // Stop sending heartbeats
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Start watching for the new leader's heartbeats
    this.startLeaderWatchdog();
  }

  /**
   * Resign leadership explicitly (on tab close).
   */
  private resignLeadership(): void {
    this.send({
      type: 'leader-resign',
      tabId: this.tabId,
      timestamp: Date.now(),
    });
    this._isLeader = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    logger.log(`[tab-coord] Resigned leadership (tabId=${this.tabId})`);
  }

  // ── Heartbeat & Watchdog ──

  /**
   * Leader sends periodic heartbeats so non-leaders know it's alive.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed || !this._isLeader) {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        return;
      }
      this.send({
        type: 'heartbeat',
        tabId: this.tabId,
        timestamp: Date.now(),
      });
    }, TabCoordinator.HEARTBEAT_INTERVAL);
  }

  /**
   * Non-leader watches for leader heartbeats.
   * If none received within LEADER_TIMEOUT, attempts to take over.
   */
  private startLeaderWatchdog(): void {
    this.scheduleLeaderCheck();
  }

  private scheduleLeaderCheck(): void {
    if (this.leaderWatchdogTimer) clearTimeout(this.leaderWatchdogTimer);
    this.leaderWatchdogTimer = setTimeout(() => {
      if (this.disposed || this._isLeader) return;

      const elapsed = Date.now() - this.lastLeaderHeartbeat;
      if (elapsed > TabCoordinator.LEADER_TIMEOUT) {
        logger.warn('[tab-coord] Leader heartbeat timeout — attempting to take over');
        this.attemptLeadership();
      } else {
        // Leader is still alive, reschedule check
        this.scheduleLeaderCheck();
      }
    }, TabCoordinator.LEADER_TIMEOUT);
  }

  // ── Message Handling ──

  private handleMessage(msg: TabMessage): void {
    if (!msg || !msg.type || msg.tabId === this.tabId) {
      // Ignore own messages and malformed messages
      return;
    }

    switch (msg.type) {
      case 'leader-claim': {
        // If the claiming tab has a lower ID than us, defer to them
        if (msg.tabId < this.tabId) {
          this.knownLeaderId = msg.tabId;
          this.lastLeaderHeartbeat = Date.now();
          if (this._isLeader) {
            this.demote();
          } else {
            // Already a follower — ensure watchdog is watching the new leader
            this.scheduleLeaderCheck();
          }
        }
        // If our tabId is lower, we re-assert leadership
        else if (this._isLeader) {
          // Send a heartbeat to prove we're still alive and the rightful leader
          this.send({
            type: 'heartbeat',
            tabId: this.tabId,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'heartbeat': {
        // Update known leader info
        if (msg.tabId < this.tabId) {
          this.knownLeaderId = msg.tabId;
          this.lastLeaderHeartbeat = Date.now();
        }
        break;
      }

      case 'leader-resign': {
        if (this.knownLeaderId === msg.tabId) {
          logger.log('[tab-coord] Leader resigned — attempting to take over');
          this.knownLeaderId = null;
          // Attempt to become the new leader
          this.attemptLeadership();
        }
        break;
      }

      case 'local-write': {
        // Another tab wrote to local DB — invalidate our cache
        logger.log(`[tab-coord] Received local-write from tab ${msg.tabId} for ${msg.table || 'unknown table'}`);
        if (this.onInvalidate) {
          this.onInvalidate(msg.table);
        }
        break;
      }

      case 'sync-complete': {
        // Leader completed sync — our cached data may be stale
        logger.log(`[tab-coord] Received sync-complete from tab ${msg.tabId}`);
        if (this.onInvalidate) {
          this.onInvalidate(); // Invalidate all stores
        }
        break;
      }

      case 'force-invalidate': {
        logger.log(`[tab-coord] Received force-invalidate from tab ${msg.tabId}`);
        if (this.onInvalidate) {
          this.onInvalidate();
        }
        break;
      }
    }
  }

  // ── Send Helper ──

  private send(msg: TabMessage): void {
    if (!this.channel || this.disposed) return;
    try {
      this.channel.postMessage(msg);
    } catch (e) {
      logger.warn('[tab-coord] Failed to send message:', e);
    }
  }
}

// ── Singleton ──

let _instance: TabCoordinator | null = null;

/**
 * Get the global TabCoordinator singleton.
 */
export function getTabCoordinator(): TabCoordinator {
  if (!_instance) {
    _instance = new TabCoordinator();
  }
  return _instance;
}

/**
 * Initialize the global TabCoordinator.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initTabCoordinator(onInvalidate: InvalidateCallback): TabCoordinator {
  const coord = getTabCoordinator();
  coord.init(onInvalidate);
  return coord;
}