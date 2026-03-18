import { useState } from 'react';
import { Check, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import './IntegrationCard.css';

interface IntegrationCardProps {
  service: string;
  icon: React.ReactNode;
  connected: boolean;
  loading?: boolean;
  comingSoon?: boolean;
  description?: string;
  onConnect: () => void;
  onDisconnect?: () => void;
  children?: React.ReactNode; // Expandable settings
}

export function IntegrationCard({
  service,
  icon,
  connected,
  loading,
  comingSoon,
  description,
  onConnect,
  onDisconnect,
  children,
}: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`integration-card ${connected ? 'connected' : ''} ${comingSoon ? 'coming-soon' : ''}`}>
      <div className="integration-card-main">
        <div className="integration-card-icon">{icon}</div>
        <div className="integration-card-info">
          <div className="integration-card-header">
            <h4 className="integration-card-name">{service}</h4>
            <span className={`integration-card-status ${connected ? 'connected' : 'disconnected'}`}>
              <span className="integration-status-dot" />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {description && <p className="integration-card-desc">{description}</p>}
        </div>
        <div className="integration-card-actions">
          {comingSoon ? (
            <span className="integration-coming-soon-badge">Coming Soon</span>
          ) : loading ? (
            <button className="integration-btn" disabled>
              <Loader2 size={14} className="spin" /> Connecting...
            </button>
          ) : connected ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {children && (
                <button
                  className="integration-btn secondary"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Settings
                </button>
              )}
              {onDisconnect && (
                <button className="integration-btn danger" onClick={onDisconnect}>
                  <X size={14} /> Disconnect
                </button>
              )}
            </div>
          ) : (
            <button className="integration-btn primary" onClick={onConnect}>
              <Check size={14} /> Connect
            </button>
          )}
        </div>
      </div>
      {expanded && children && (
        <div className="integration-card-settings">
          {children}
        </div>
      )}
    </div>
  );
}
