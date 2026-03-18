/**
 * WorldMap — Full-screen interactive world map overlay
 *
 * Shows zone nodes connected by paths, player location,
 * zone detail cards on tap, and Life City (locked placeholder).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X, BookOpen, Hammer, Heart, Coins, Users, Building2,
  MapPin, Lock, ChevronRight,
} from 'lucide-react';
import type { PortalPlacement } from '../data/zones';
import { LIFE_TOWN } from '../data/zones';

interface WorldMapProps {
  visible: boolean;
  onClose: () => void;
  /** Current zone the player is in */
  currentZone?: string;
  /** Portals with runtime lock status */
  portals: (PortalPlacement & { locked: boolean })[];
  /** NPC count for population display */
  npcCount: number;
}

/** Zone node layout — positioned as percentage of map area */
interface ZoneNode {
  id: string;
  label: string;
  description: string;
  npcName?: string;
  icon: React.ReactNode;
  x: number; // % from left
  y: number; // % from top
  locked: boolean;
  isCurrent: boolean;
  isLifeCity: boolean;
  unlockCondition?: string;
  /** Connections to other zone IDs */
  connections: string[];
}

const ZONE_ICONS: Record<string, React.ReactNode> = {
  life_town: <MapPin size={18} />,
  wisdom_summit: <BookOpen size={18} />,
  ironworks: <Hammer size={18} />,
  healers_sanctuary: <Heart size={18} />,
  market_quarter: <Coins size={18} />,
  social_square: <Users size={18} />,
  life_city: <Building2 size={18} />,
};

const ZONE_DESCRIPTIONS: Record<string, string> = {
  life_town: 'The central hub of your journey. All paths lead here.',
  wisdom_summit: 'A peak of knowledge where journals become wisdom.',
  ironworks: 'Where goals are forged into steel.',
  healers_sanctuary: 'A sanctuary for body and mind.',
  market_quarter: 'Trade and manage your wealth.',
  social_square: 'Gather with guilds and friends.',
  life_city: 'Where all Life Towns converge — the multiplayer realm.',
};

const ZONE_NPCS: Record<string, string> = {
  life_town: 'The Guide, Aria, Grim, Mira, Felix, Elder Thane',
  wisdom_summit: 'Lorekeeper Mira',
  ironworks: 'Grim the Blacksmith',
  healers_sanctuary: 'Aria the Healer',
  market_quarter: 'Felix the Merchant',
  social_square: 'Elder Thane',
  life_city: 'Unknown',
};

function buildZoneNodes(
  currentZone: string,
  portals: (PortalPlacement & { locked: boolean })[],
): ZoneNode[] {
  const nodes: ZoneNode[] = [];

  // Life Town (center)
  nodes.push({
    id: 'life_town',
    label: 'Life Town',
    description: ZONE_DESCRIPTIONS.life_town,
    npcName: ZONE_NPCS.life_town,
    icon: ZONE_ICONS.life_town,
    x: 50,
    y: 40,
    locked: false,
    isCurrent: currentZone === 'life_town',
    isLifeCity: false,
    connections: portals.map(p => p.targetZone),
  });

  // Layout positions for each zone around Life Town
  const positions: Record<string, { x: number; y: number }> = {
    wisdom_summit: { x: 50, y: 10 },
    ironworks: { x: 15, y: 35 },
    healers_sanctuary: { x: 85, y: 35 },
    market_quarter: { x: 22, y: 72 },
    social_square: { x: 78, y: 72 },
    life_city: { x: 50, y: 90 },
  };

  for (const portal of portals) {
    const pos = positions[portal.targetZone] || { x: 50, y: 50 };
    nodes.push({
      id: portal.targetZone,
      label: portal.label,
      description: ZONE_DESCRIPTIONS[portal.targetZone] || 'An uncharted zone.',
      npcName: ZONE_NPCS[portal.targetZone],
      icon: ZONE_ICONS[portal.targetZone] || <MapPin size={18} />,
      x: pos.x,
      y: pos.y,
      locked: portal.locked,
      isCurrent: currentZone === portal.targetZone,
      isLifeCity: portal.targetZone === 'life_city',
      unlockCondition: portal.unlockCondition,
      connections: ['life_town'],
    });
  }

  return nodes;
}

function getUnlockLabel(condition?: string): string {
  switch (condition) {
    case 'journal_entry': return 'Write a journal entry';
    case 'first_goal': return 'Create your first goal';
    case 'health_log': return 'Log health metrics';
    case 'financial_entry': return 'Track an expense';
    case 'guild_join': return 'Join a guild';
    case 'multiplayer_enabled': return 'Coming soon';
    default: return 'Continue your journey';
  }
}

export function WorldMap({ visible, onClose, currentZone = 'life_town', portals, npcCount }: WorldMapProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneNode | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedZone) setSelectedZone(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose, selectedZone]);

  // Clear selection when closing
  useEffect(() => {
    if (!visible) setSelectedZone(null);
  }, [visible]);

  if (!visible) return null;

  const nodes = buildZoneNodes(currentZone, portals);
  const lifeTown = nodes.find(n => n.id === 'life_town')!;
  const discoveredCount = nodes.filter(n => !n.locked).length;
  const lockedCount = nodes.filter(n => n.locked).length;

  return (
    <div className="worldmap-overlay" onClick={() => setSelectedZone(null)}>
      <div className="worldmap-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="worldmap-header">
          <h2 className="worldmap-title">The Realm</h2>
          <button className="worldmap-close" onClick={onClose} aria-label="Close map">
            <X size={18} />
          </button>
        </div>

        {/* Map Area */}
        <div className="worldmap-area">
          {/* Connection Lines (SVG) */}
          <svg className="worldmap-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
            {nodes.filter(n => n.id !== 'life_town').map(node => (
              <line
                key={`conn-${node.id}`}
                x1={lifeTown.x}
                y1={lifeTown.y}
                x2={node.x}
                y2={node.y}
                className={`worldmap-path${node.locked ? ' worldmap-path--locked' : ''}${node.isLifeCity ? ' worldmap-path--city' : ''}`}
              />
            ))}
          </svg>

          {/* Zone Nodes */}
          {nodes.map(node => (
            <button
              key={node.id}
              className={[
                'worldmap-node',
                node.isCurrent && 'worldmap-node--current',
                node.locked && 'worldmap-node--locked',
                node.isLifeCity && 'worldmap-node--city',
                selectedZone?.id === node.id && 'worldmap-node--selected',
              ].filter(Boolean).join(' ')}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone(node); }}
              aria-label={node.label}
            >
              <span className="worldmap-node-icon">{node.icon}</span>
              {node.locked && <Lock size={10} className="worldmap-node-lock" />}
              {node.isCurrent && <span className="worldmap-node-pulse" />}
              <span className="worldmap-node-label">{node.label}</span>
              {node.isLifeCity && <span className="worldmap-node-particles" />}
            </button>
          ))}
        </div>

        {/* Footer Stats */}
        <div className="worldmap-footer">
          <span>Zones: {discoveredCount} discovered · {lockedCount} locked</span>
          <span>Population: You + {npcCount} NPCs</span>
        </div>

        {/* Zone Detail Card */}
        {selectedZone && (
          <ZoneDetailCard
            node={selectedZone}
            onClose={() => setSelectedZone(null)}
          />
        )}
      </div>
    </div>
  );
}

// ═══ Zone Detail Card ═══
function ZoneDetailCard({ node, onClose }: { node: ZoneNode; onClose: () => void }) {
  return (
    <div className="worldmap-detail" onClick={e => e.stopPropagation()}>
      <div className="worldmap-detail-header">
        <span className="worldmap-detail-icon">{node.icon}</span>
        <h3 className="worldmap-detail-title">{node.label}</h3>
      </div>
      <p className="worldmap-detail-desc">{node.description}</p>
      {node.npcName && (
        <div className="worldmap-detail-row">
          <span className="worldmap-detail-key">NPCs:</span>
          <span>{node.npcName}</span>
        </div>
      )}
      <div className="worldmap-detail-row">
        <span className="worldmap-detail-key">Status:</span>
        <span style={{ color: node.locked ? '#FF6B6B' : '#39FF14' }}>
          {node.locked ? 'Locked' : node.isCurrent ? 'You are here' : 'Unlocked'}
        </span>
      </div>
      {node.locked && (
        <div className="worldmap-detail-hint">
          <Lock size={11} />
          <span>{getUnlockLabel(node.unlockCondition)}</span>
        </div>
      )}
      {!node.locked && !node.isCurrent && !node.isLifeCity && (
        <button className="worldmap-detail-btn" onClick={onClose}>
          Walk There
          <ChevronRight size={14} />
        </button>
      )}
      {node.isLifeCity && (
        <div className="worldmap-detail-coming">
          Coming Soon — Where all Life Towns converge
        </div>
      )}
    </div>
  );
}
