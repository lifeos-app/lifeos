import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { onUpdateAvailable, applyUpdate } from '../lib/sw-register';
import './UpdateNotification.css';

export function UpdateNotification() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    onUpdateAvailable((reg) => {
      setRegistration(reg);
    });
  }, []);

  const handleUpdate = () => {
    if (!registration) return;
    setUpdating(true);
    applyUpdate(registration);
    // The controllerchange event will trigger reload
  };

  const handleDismiss = () => {
    setRegistration(null);
  };

  if (!registration) return null;

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <RefreshCw size={14} className={updating ? 'un-spin' : ''} />
        <span>
          {updating ? 'Updating...' : 'A new version of LifeOS is available'}
        </span>
      </div>
      <div className="update-notification-actions">
        {!updating && (
          <>
            <button className="un-update-btn" onClick={handleUpdate} aria-label="Update app">
              Update now
            </button>
            <button className="un-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
