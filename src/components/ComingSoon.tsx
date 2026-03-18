import { Construction, Sparkles } from 'lucide-react';

interface ComingSoonProps {
  feature: string;
  children: React.ReactNode;
}

/**
 * Wraps a page/section with a "Coming Soon" overlay.
 * The underlying content is still rendered but blurred and non-interactive.
 */
export function ComingSoon({ feature, children }: ComingSoonProps) {
  return (
    <div style={{ position: 'relative', minHeight: 300 }}>
      {/* Blurred content underneath */}
      <div style={{
        filter: 'blur(4px)',
        opacity: 0.4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {children}
      </div>

      {/* Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 14, 26, 0.75)',
        borderRadius: 16,
        zIndex: 10,
        gap: 16,
        padding: 32,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(0, 212, 255, 0.08)',
          border: '2px solid rgba(0, 212, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Construction size={28} style={{ color: '#00D4FF' }} />
        </div>

        <h2 style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#F9FAFB',
          textAlign: 'center',
          margin: 0,
        }}>
          Coming Soon
        </h2>

        <p style={{
          fontSize: 14,
          color: '#9CA3AF',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
          margin: 0,
        }}>
          The <strong style={{ color: '#00D4FF' }}>{feature}</strong> feature is still being built.
          We're working hard to bring it to you soon!
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          background: 'rgba(0, 212, 255, 0.06)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: 8,
          color: '#00D4FF',
          fontSize: 13,
          fontWeight: 500,
          marginTop: 4,
        }}>
          <Sparkles size={14} />
          Stay tuned for updates
        </div>
      </div>
    </div>
  );
}
