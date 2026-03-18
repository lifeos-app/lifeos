/**
 * BiomePicker — 2x3 grid modal for selecting realm biome
 *
 * Shows 6 biome cards with gradient backgrounds.
 * Selected biome gets a golden border + checkmark.
 */

import { useCallback } from 'react';
import { Check } from 'lucide-react';
import { BIOMES, BIOME_IDS, type BiomeId } from '../data/biomes';

interface BiomePickerProps {
  currentBiome: BiomeId;
  onSelect: (biome: BiomeId) => void;
  onClose: () => void;
}

export function BiomePicker({ currentBiome, onSelect, onClose }: BiomePickerProps) {
  const handleSelect = useCallback((id: BiomeId) => {
    onSelect(id);
  }, [onSelect]);

  return (
    <div className="realm-dialogue-backdrop" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(15,15,30,0.95)',
          borderRadius: 16,
          padding: 20,
          maxWidth: 360,
          width: '90vw',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h3 style={{
          color: '#FFD700',
          fontFamily: 'monospace',
          fontSize: 14,
          margin: '0 0 16px',
          textAlign: 'center',
        }}>
          Choose Biome
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          {BIOME_IDS.map(id => {
            const biome = BIOMES[id];
            const selected = id === currentBiome;
            // Build a gradient from the biome's grass fill
            const grassHex = biome.grassFill;

            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                style={{
                  background: `linear-gradient(135deg, ${grassHex}, ${darken(grassHex, 30)})`,
                  border: selected
                    ? '2px solid #FFD700'
                    : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '14px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  minHeight: 70,
                }}
              >
                {selected && (
                  <div style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#FFD700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Check size={12} color="#000" />
                  </div>
                )}
                <div style={{
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 4,
                }}>
                  {biome.name}
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  lineHeight: 1.3,
                }}>
                  {biome.description}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            display: 'block',
            margin: '16px auto 0',
            padding: '8px 24px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#C8D6E5',
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Darken a hex color by a fixed amount */
function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
