import { useState, useEffect } from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import './GlobalLoadingSpinner.css';

const STUCK_TIMEOUT_MS = 10_000; // 10 seconds

export function GlobalLoadingSpinner() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleReload = () => {
    // Clear any stale SW caches then hard reload
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
    window.location.reload();
  };

  return (
    <div className="global-loading">
      <div className="global-loading-content">
        <div className="global-loading-icon-wrap">
          <Zap size={40} className="global-loading-icon" />
          <div className="global-loading-pulse" />
        </div>
        <div className="global-loading-brand">LifeOS</div>
        {!stuck ? (
          <div className="global-loading-bar-wrap">
            <div className="global-loading-bar" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{
              color: '#8BA4BE',
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
              margin: 0,
            }}>
              Taking longer than expected...
            </p>
            <button
              onClick={handleReload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: 8,
                color: '#00D4FF',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <RefreshCw size={16} /> Reload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
