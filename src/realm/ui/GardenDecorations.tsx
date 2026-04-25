/**
 * GardenDecorations -- Achievement-unlocked garden decoration panel
 *
 * Shows unlocked decorations as an icon grid with progress toward next unlocks.
 * "Place in Garden" button persists to localStorage.
 * Collapsible, max 4 shown by default.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, TreePine } from 'lucide-react';
import { useGamificationContext } from '../../lib/gamification/context';
import {
  GARDEN_DECORATIONS,
  getUnlockedDecorations,
  getNextDecorationProgress,
  getPlacedDecorations,
  placeDecoration,
  removeDecoration,
  type GardenDecoration,
} from '../../lib/garden-decorations';

const MAX_VISIBLE = 4;

export function GardenDecorations() {
  const gam = useGamificationContext();
  const [expanded, setExpanded] = useState(false);
  const [placed, setPlaced] = useState<string[]>(() => getPlacedDecorations());

  const userAchievements = useMemo(() =>
    gam.achievements.map(a => ({
      achievement_id: a.achievementId,
      unlocked_at: a.unlockedAt,
      progress: a.progress,
    })),
    [gam.achievements],
  );

  const unlocked = useMemo(() => getUnlockedDecorations(userAchievements), [userAchievements]);
  const nextProgress = useMemo(() => getNextDecorationProgress(userAchievements), [userAchievements]);

  const visibleUnlocked = expanded ? unlocked : unlocked.slice(0, MAX_VISIBLE);
  const visibleNext = expanded ? nextProgress.slice(0, 4) : nextProgress.slice(0, 2);

  const handlePlace = useCallback((id: string) => {
    if (placed.includes(id)) {
      removeDecoration(id);
      setPlaced(prev => prev.filter(p => p !== id));
    } else {
      placeDecoration(id);
      setPlaced(prev => [...prev, id]);
    }
  }, [placed]);

  if (unlocked.length === 0 && nextProgress.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'pointer',
          padding: 0,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <TreePine size={14} style={{ color: '#39FF14' }} />
        <span>Garden Decorations</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
        }}>
          {unlocked.length}/{GARDEN_DECORATIONS.length}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Unlocked decorations grid */}
      {unlocked.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 6,
          marginTop: 8,
        }}>
          {visibleUnlocked.map(dec => {
            const isPlaced = placed.includes(dec.id);
            return (
              <div
                key={dec.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '6px 4px',
                  background: isPlaced
                    ? 'rgba(57,255,20,0.08)'
                    : 'rgba(255,255,255,0.03)',
                  border: isPlaced
                    ? '1px solid rgba(57,255,20,0.2)'
                    : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>{dec.icon}</span>
                <span style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.7)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}>
                  {dec.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlace(dec.id); }}
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: isPlaced
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(57,255,20,0.15)',
                    color: isPlaced
                      ? 'rgba(255,255,255,0.5)'
                      : '#39FF14',
                    fontWeight: 500,
                  }}
                >
                  {isPlaced ? 'Remove' : 'Place'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Next unlock progress */}
      {visibleNext.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 4,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Next Unlocks
          </div>
          {visibleNext.map(item => {
            const pct = item.needed > 0 ? (item.progress / item.needed) * 100 : 0;
            return (
              <div
                key={item.decoration.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.5 }}>{item.decoration.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: 2,
                  }}>
                    <span>{item.decoration.name}</span>
                    <span>{item.progress}/{item.needed}</span>
                  </div>
                  <div style={{
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(pct, 100)}%`,
                      background: 'rgba(0,212,255,0.6)',
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View All / Collapse */}
      {unlocked.length > MAX_VISIBLE && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 6,
            padding: '4px 0',
            background: 'none',
            border: 'none',
            color: '#00D4FF',
            fontSize: 11,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          View All ({unlocked.length})
        </button>
      )}
    </div>
  );
}
