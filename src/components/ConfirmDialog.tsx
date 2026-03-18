import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = '#F43F5E',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  const content = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d1520',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `${confirmColor}15`,
              border: `1px solid ${confirmColor}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} style={{ color: confirmColor }} />
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              flex: 1,
            }}
          >
            {title}
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px',
              background: confirmColor,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
