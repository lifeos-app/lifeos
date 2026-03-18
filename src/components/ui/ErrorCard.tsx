import { AlertTriangle, RefreshCw } from 'lucide-react';
import './ErrorCard.css';

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({ message, onRetry, className }: ErrorCardProps) {
  return (
    <div className={`error-card${className ? ` ${className}` : ''}`} role="alert">
      <AlertTriangle size={28} className="error-card-icon" aria-hidden="true" />
      <p className="error-card-message">{message}</p>
      {onRetry && (
        <button className="error-card-retry" onClick={onRetry} aria-label="Try again">
          <RefreshCw size={14} aria-hidden="true" /> Try Again
        </button>
      )}
    </div>
  );
}
