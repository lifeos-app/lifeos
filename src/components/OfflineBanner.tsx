import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Database } from 'lucide-react';
import { isOnline, onOnlineChange, getQueueSize, replayQueue } from '../lib/offline';
import { getCacheTimestamp, CACHE_KEYS } from '../lib/offline-cache';
import './OfflineBanner.css';

function formatCacheAge(cachedAt: number): string {
  const diff = Date.now() - cachedAt;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [queueSize, setQueueSize] = useState(getQueueSize());
  const [syncing, setSyncing] = useState(false);
  const [showSynced, setShowSynced] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onOnlineChange((isOn) => {
      setOnline(isOn);
      setQueueSize(getQueueSize());
      if (isOn && getQueueSize() > 0) {
        handleSync();
      }
      if (!isOn) {
        updateCacheAge();
      }
    });

    // Periodic queue check
    const interval = setInterval(() => {
      setQueueSize(getQueueSize());
    }, 5000);

    // Check cache age when going offline
    if (!isOnline()) {
      updateCacheAge();
    }

    return () => { unsub(); clearInterval(interval); };
  }, []);

  const updateCacheAge = async () => {
    // Check the most recent cache timestamp across key stores
    const timestamps = await Promise.all([
      getCacheTimestamp(CACHE_KEYS.SCHEDULE_TASKS),
      getCacheTimestamp(CACHE_KEYS.HABITS),
      getCacheTimestamp(CACHE_KEYS.HEALTH_TODAY),
    ]);
    const latest = timestamps.filter(Boolean).sort((a, b) => (b || 0) - (a || 0))[0];
    if (latest) {
      setCacheAge(formatCacheAge(latest));
    } else {
      setCacheAge(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const { replayed } = await replayQueue();
    setSyncing(false);
    setQueueSize(getQueueSize());
    if (replayed > 0) {
      setShowSynced(true);
      setTimeout(() => setShowSynced(false), 3000);
    }
  };

  // Don't show anything when online with empty queue
  if (online && queueSize === 0 && !showSynced) return null;

  return (
    <div className={`offline-banner ${!online ? 'offline' : showSynced ? 'synced' : 'pending'}`} role="alert" aria-live="assertive">
      {!online ? (
        <>
          <WifiOff size={14} />
          <span>You're offline</span>
          {cacheAge && (
            <span className="ob-cache-age">
              <Database size={10} />
              Cached {cacheAge}
            </span>
          )}
          {queueSize > 0 && <span className="ob-queue">{queueSize} pending</span>}
        </>
      ) : showSynced ? (
        <>
          <RefreshCw size={14} />
          <span>Synced! Back online</span>
        </>
      ) : queueSize > 0 ? (
        <>
          <RefreshCw size={14} className={syncing ? 'ob-spin' : ''} />
          <span>{syncing ? 'Syncing...' : `${queueSize} changes to sync`}</span>
          {!syncing && (
            <button className="ob-sync-btn" onClick={handleSync} aria-label="Sync pending changes">Sync now</button>
          )}
        </>
      ) : null}
    </div>
  );
}
