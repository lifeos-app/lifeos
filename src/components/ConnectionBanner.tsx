import { useState } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { supabase } from '../lib/supabase';

/**
 * ConnectionBanner — shown when token refresh fails or Supabase is unreachable.
 * Does NOT sign the user out. Shows a banner with a retry button instead.
 */
export function ConnectionBanner() {
  const connectionError = useUserStore(s => s.connectionError);
  const setConnectionError = useUserStore(s => s.setConnectionError);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!connectionError || dismissed) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setConnectionError(false);
        setDismissed(false);
      }
    } catch {
      // Still offline — keep banner visible
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9998, // below UpdateBanner (9999)
      background: 'linear-gradient(135deg, #7C4B00 0%, #B06A00 100%)',
      color: '#FFF3E0',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: "'Poppins', sans-serif",
      boxShadow: '0 2px 12px rgba(176, 106, 0, 0.3)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <WifiOff size={16} />
        Connection issue — working offline
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 243, 224, 0.15)',
            color: '#FFF3E0',
            border: '1px solid rgba(255, 243, 224, 0.3)',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: "'Poppins', sans-serif",
            cursor: retrying ? 'not-allowed' : 'pointer',
            opacity: retrying ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: retrying ? 'spin 1s linear infinite' : 'none' }} />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            color: '#FFF3E0',
            border: '1px solid rgba(255, 243, 224, 0.3)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={13} />
        </button>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
