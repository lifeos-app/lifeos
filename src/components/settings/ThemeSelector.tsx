/**
 * ThemeSelector — 2x3 grid of visual themes for Settings > Preferences
 */
import { useState, useEffect, type JSX } from 'react';
import { Check, Lock } from 'lucide-react';
import { THEMES, getActiveTheme, setActiveTheme, type AppTheme } from '../../lib/themes';
import { useGamificationContext } from '../../lib/gamification/context';

export function ThemeSelector(): JSX.Element {
  const [activeId, setActiveId] = useState(getActiveTheme().id);
  const gam = useGamificationContext();
  const userLevel = gam.level || 1;

  // Listen for external theme changes
  useEffect(() => {
    const handler = (e: Event) => {
      const theme = (e as CustomEvent).detail as AppTheme;
      if (theme?.id) setActiveId(theme.id);
    };
    window.addEventListener('lifeos-theme-changed', handler);
    return () => window.removeEventListener('lifeos-theme-changed', handler);
  }, []);

  const handleSelect = (theme: AppTheme) => {
    // In early adopter mode, all themes are unlocked regardless of level
    setActiveTheme(theme.id);
    setActiveId(theme.id);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 10,
      }}>
        Visual Theme
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {THEMES.map(theme => {
          const isActive = theme.id === activeId;
          const isLocked = theme.unlocksAt != null && userLevel < theme.unlocksAt;
          return (
            <button
              key={theme.id}
              onClick={() => handleSelect(theme)}
              style={{
                padding: 12,
                background: 'rgba(255,255,255,0.04)',
                border: isActive ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                transition: 'border-color 0.2s',
              }}
              title={theme.description}
            >
              {/* Color preview */}
              <div style={{
                width: '100%', height: 32, borderRadius: 6, overflow: 'hidden',
                display: 'flex', gap: 0,
              }}>
                <div style={{ flex: 2, background: theme.colors.bg }} />
                <div style={{ flex: 1, background: theme.colors.accent }} />
                <div style={{ flex: 1, background: theme.colors.accentSecondary }} />
              </div>

              <span style={{
                fontSize: 11, fontWeight: 600, color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.7)',
              }}>
                {theme.name}
              </span>

              {isActive && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={10} color="#0A1628" strokeWidth={3} />
                </div>
              )}

              {isLocked && (
                <div style={{
                  position: 'absolute', bottom: 6, right: 6,
                  fontSize: 9, color: 'rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <Lock size={9} /> Lv.{theme.unlocksAt}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
