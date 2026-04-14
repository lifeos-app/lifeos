import { useState, useEffect, useCallback } from 'react';

/**
 * useNetworkStatus — Track online/offline state and connection quality.
 *
 * Returns:
 *   - online: boolean — whether the browser reports connectivity
 *   - connectionType: string | null — effective connection type ('4g', '3g', '2g', 'slow-2g') if available
 *   - downlink: number | null — estimated downlink speed in Mbps (if available)
 *   - rtt: number | null — estimated round-trip time in ms (if available)
 *   - since: Date | null — when the last online/offline transition occurred
 *
 * Uses Navigator Connection API (NetworkInformation) where available (Chrome, Edge).
 * Falls back to basic online/offline events elsewhere.
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [downlink, setDownlink] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [since, setSince] = useState<Date | null>(null);

  const updateConnectionInfo = useCallback(() => {
    const conn = (navigator as any).connection;
    if (conn) {
      setConnectionType(conn.effectiveType || null);
      setDownlink(conn.downlink ?? null);
      setRtt(conn.rtt ?? null);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setSince(new Date());
      updateConnectionInfo();
    };

    const goOffline = () => {
      setOnline(false);
      setSince(new Date());
      setConnectionType(null);
      setDownlink(null);
      setRtt(null);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // NetworkInformation change events (Chrome/Edge only)
    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (conn) {
        conn.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  return { online, connectionType, downlink, rtt, since } as const;
}