import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

const CRASH_FLAG = 'lifeos_crashed';
const RECOVERED_DISMISSED = 'lifeos_crash_recovered_dismissed';

/**
 * CrashRecoveryBanner — detects if the app crashed on the previous load
 * (via sessionStorage flag) and shows a subtle recovery banner.
 *
 * Mechanism:
 * - AppErrorBoundary sets 'lifeos_crashed' on crash
 * - On successful mount, App.tsx clears the flag
 * - If the flag is present on load, this banner shows
 * - Dismissed state persists in sessionStorage for the session
 */
export function CrashRecoveryBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const crashed = sessionStorage.getItem(CRASH_FLAG);
      const dismissed = sessionStorage.getItem(RECOVERED_DISMISSED);
      if (crashed === 'true' && dismissed !== 'true') {
        setShow(true);
      }
      // Clear the crash flag now that we've recovered
      sessionStorage.removeItem(CRASH_FLAG);
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — skip
    }
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    try {
      sessionStorage.setItem(RECOVERED_DISMISSED, 'true');
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(5, 14, 26, 0.95)',
      backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(0, 212, 255, 0.15)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontFamily: "'Poppins', sans-serif",
      animation: 'crashBannerIn 0.3s ease-out',
    }}>
      <style>{`
        @keyframes crashBannerIn {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <span style={{
        fontSize: 13,
        color: '#9CA3AF',
      }}>
        ⚡ Recovered from crash — some features may need refreshing
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss crash recovery banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 6,
          color: '#6B7280',
          cursor: 'pointer',
          padding: '4px 8px',
          minWidth: 28,
          minHeight: 28,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}