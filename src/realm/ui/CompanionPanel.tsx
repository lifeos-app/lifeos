/**
 * Companion Panel — The Realm
 *
 * Shows companion animal info, bond level, naming flow.
 * Same styling as PlantInfoPanel (.realm-dialogue-box).
 */

import { useState } from 'react';
import { Heart, Moon, Sun } from 'lucide-react';
import type { UserCompanion, FaunaSpecies } from '../data/companions';
import { BOND_THRESHOLDS, getBondLevel, BOND_DESCRIPTIONS } from '../data/companions';

interface CompanionPanelProps {
  companion: UserCompanion;
  species: FaunaSpecies;
  onClose: () => void;
  onName: (name: string) => void;
}

export function CompanionPanel({ companion, species, onClose, onName }: CompanionPanelProps) {
  const [nameInput, setNameInput] = useState('');
  const [naming, setNaming] = useState(false);

  const bondLevel = getBondLevel(companion.bond_xp);
  const currentThreshold = BOND_THRESHOLDS[bondLevel - 1] ?? 0;
  const nextThreshold = BOND_THRESHOLDS[bondLevel] ?? BOND_THRESHOLDS[BOND_THRESHOLDS.length - 1];
  const bondProgress = bondLevel >= 10 ? 1 : (companion.bond_xp - currentThreshold) / (nextThreshold - currentThreshold);
  const bondDesc = BOND_DESCRIPTIONS[bondLevel] ?? 'Following at a distance';

  const activityIcon = species.activity_pattern === 'nocturnal'
    ? <Moon size={14} />
    : <Sun size={14} />;

  const stateLabel = companion.state === 'sleeping'
    ? 'Sleeping...'
    : companion.state === 'resting'
      ? 'Resting'
      : 'Active';

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length > 0 && trimmed.length <= 20) {
      onName(trimmed);
      setNaming(false);
    }
  };

  return (
    <div className="realm-dialogue-backdrop" onClick={onClose}>
      <div className="realm-dialogue-box" onClick={e => e.stopPropagation()}>
        <div className="realm-dialogue-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Heart size={16} />
          {companion.companion_name || 'Unnamed Companion'}
        </div>

        {/* Species info */}
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 2 }}>
          {species.common_name}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>
          {species.scientific_name}
        </div>

        <div className="realm-dialogue-text">
          {/* Bond level */}
          <div style={{ marginBottom: 6 }}>
            <strong>Bond Level:</strong> {bondLevel}/10
            <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {bondDesc}
            </span>
          </div>
          {bondLevel < 10 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                height: 6,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: bondLevel >= 7 ? '#FFD700' : '#FF69B4',
                  height: '100%',
                  width: `${bondProgress * 100}%`,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>
                {companion.bond_xp - currentThreshold} / {nextThreshold - currentThreshold} XP to next level
              </div>
            </div>
          )}

          {/* State + activity */}
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>State:</strong> {stateLabel}
            <span style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {activityIcon} {species.activity_pattern}
            </span>
          </div>

          {/* Description */}
          <div style={{
            marginBottom: 8,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            fontStyle: 'italic',
            borderLeft: '2px solid rgba(255,255,255,0.15)',
            paddingLeft: 8,
          }}>
            {species.description}
          </div>

          {/* Naming flow */}
          {!companion.companion_name && !naming && (
            <button
              onClick={() => setNaming(true)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              Give your companion a name
            </button>
          )}

          {naming && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={20}
                placeholder="Enter a name..."
                autoFocus
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); }}
              />
              <button
                onClick={handleSaveName}
                style={{
                  background: 'rgba(255,215,0,0.2)',
                  border: '1px solid rgba(255,215,0,0.4)',
                  color: '#FFD700',
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="realm-dialogue-hint">tap outside to close</div>
      </div>
    </div>
  );
}
