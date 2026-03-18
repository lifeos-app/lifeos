/**
 * Plant Info Panel — The Realm
 *
 * Shows plant details when tapping a garden plant.
 * Species-aware with botanical facts, growth bar, and Lucide icons.
 */

import { Heart, Dumbbell, BookOpen, Coins, Flame, Cog, Palette, Leaf, Users, Activity } from 'lucide-react';
import type { GardenPlant } from '../bridge/DataBridge';
import { STAGE_NAMES } from '../data/flora';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  wellness:     <Heart size={16} />,
  fitness:      <Dumbbell size={16} />,
  learning:     <BookOpen size={16} />,
  finance:      <Coins size={16} />,
  spiritual:    <Flame size={16} />,
  productivity: <Cog size={16} />,
  creative:     <Palette size={16} />,
  social:       <Users size={16} />,
  health:       <Activity size={16} />,
  other:        <Leaf size={16} />,
};

const DORMANCY_MESSAGES: Record<number, { color: string; text: string }> = {
  1: { color: '#FFD54F', text: 'This plant is starting to fade. Log the habit to perk it up.' },
  2: { color: '#FFB74D', text: 'This plant is dormant. It needs your attention soon.' },
  3: { color: '#FF7043', text: 'Deep dormancy. This plant urgently needs care to survive.' },
};

interface PlantInfoPanelProps {
  plant: GardenPlant;
  onClose: () => void;
}

export function PlantInfoPanel({ plant, onClose }: PlantInfoPanelProps) {
  const icon = CATEGORY_ICONS[plant.category] || CATEGORY_ICONS.other;
  const stageName = STAGE_NAMES[plant.stage] || 'Unknown';
  const progress = plant.growthProgress ?? 0;
  const dormancyLevel = plant.dormancyLevel ?? 0;

  // Format growth rate display
  const growthRateLabel = plant.growthRate >= 200
    ? 'Fast grower'
    : plant.growthRate >= 50
      ? 'Moderate grower'
      : 'Slow grower';

  return (
    <div className="realm-dialogue-backdrop" onClick={onClose}>
      <div className="realm-dialogue-box realm-plant-info" onClick={e => e.stopPropagation()}>
        <div className="realm-dialogue-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon} {plant.name}
        </div>

        {/* Species name with italic scientific name */}
        {plant.scientificName ? (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>
            {plant.speciesName?.split('(')[0]?.trim()}
            {' '}<em style={{ color: 'rgba(255,255,255,0.4)' }}>(<i>{plant.scientificName}</i>)</em>
          </div>
        ) : plant.speciesName ? (
          <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>
            {plant.speciesName}
          </div>
        ) : null}

        <div className="realm-dialogue-text">
          <div style={{ marginBottom: 6 }}>
            <strong>Category:</strong> {plant.category}
          </div>

          {/* Growth stage + progress bar */}
          <div style={{ marginBottom: 6 }}>
            <strong>Growth:</strong> {stageName} (Stage {plant.stage}/5)
          </div>
          {plant.stage < 5 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                height: 6,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: plant.stage >= 4 ? '#FFD700' : '#4CAF50',
                  height: '100%',
                  width: `${progress * 100}%`,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Streak */}
          <div style={{ marginBottom: 6 }}>
            <strong>Streak:</strong> {plant.streakDays} day{plant.streakDays !== 1 ? 's' : ''}
          </div>

          {/* Growth rate */}
          {plant.growthRate > 0 && (
            <div style={{ marginBottom: 6, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {growthRateLabel} — {plant.growthRate.toLocaleString()} cm/year in nature
            </div>
          )}

          {/* Botanical fact */}
          {plant.description && (
            <div style={{
              marginBottom: 6,
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontStyle: 'italic',
              borderLeft: '2px solid rgba(255,255,255,0.15)',
              paddingLeft: 8,
            }}>
              {plant.description}
            </div>
          )}

          <div style={{ marginBottom: 6 }}>
            <strong>Today:</strong> {plant.isLoggedToday ? 'Logged' : 'Not yet'}
          </div>

          {/* Dormancy warning (multi-level) */}
          {dormancyLevel > 0 && DORMANCY_MESSAGES[dormancyLevel] && (
            <div style={{ color: DORMANCY_MESSAGES[dormancyLevel].color, marginTop: 8 }}>
              {DORMANCY_MESSAGES[dormancyLevel].text}
            </div>
          )}

          {!plant.isActive && (
            <div style={{ color: '#FF6B6B', marginTop: 8 }}>
              This plant has wilted. Reactivate the habit to revive it.
            </div>
          )}
        </div>
        <div className="realm-dialogue-hint">tap outside to close</div>
      </div>
    </div>
  );
}
