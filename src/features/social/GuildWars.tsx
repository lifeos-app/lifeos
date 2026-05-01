// LifeOS Social — Guild Wars Page
// War dashboard: active wars, upcoming, past results, declare war, live scoreboards, history, leaderboard, rewards

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Swords, Flame, Trophy, Clock, Eye, BarChart3, Crown
} from 'lucide-react';
import { useGuildWars, WAR_TYPE_CONFIG } from './useGuildWars';
import { WarScoreboard } from './WarScoreboard';
import { WarRewards } from './WarRewards';
import { WarDeclaration } from './WarDeclaration';
import type { GuildWar } from './useGuildWars';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface GuildWarsProps {
  guildId: string;
  userId: string;
  userRole: 'owner' | 'admin' | 'member';
  guildName?: string;
}

type ViewMode = 'dashboard' | 'scoreboard' | 'history' | 'leaderboard' | 'rewards';

// ═══════════════════════════════════════════════════
// WAR STATUS BADGE
// ═══════════════════════════════════════════════════

function WarStatusBadge({ status }: { status: GuildWar['status'] }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    pending:   { color: '#FACC15', bg: 'rgba(250,204,21,0.1)',  border: 'rgba(250,204,21,0.3)',  label: '⏳ Pending' },
    accepted:  { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   label: '✅ Accepted' },
    active:    { color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', label: '🔥 Active' },
    declined:  { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: '❌ Declined' },
    completed: { color: '#A855F7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', label: '🏆 Completed' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 6,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.color,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════
// WAR CARD
// ═══════════════════════════════════════════════════

function WarCard({
  war,
  guildId,
  onClick,
  onAccept,
  onDecline,
  guildNames,
}: {
  war: GuildWar;
  guildId: string;
  userId?: string;
  onClick: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  guildNames: Record<string, string>;
}) {
  const isChallenger = guildId === war.challenger_guild_id;
  const opponentId = isChallenger ? war.defender_guild_id : war.challenger_guild_id;
  const typeConfig = WAR_TYPE_CONFIG[war.type];
  const isWin = war.status === 'completed' && war.winner_id === guildId;
  const isLoss = war.status === 'completed' && war.winner_id && war.winner_id !== guildId;

  return (
    <div
      className="gw-war-card"
      style={warCardStyle(war.status)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{typeConfig.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: typeConfig.color }}>{typeConfig.label}</span>
        </div>
        <WarStatusBadge status={war.status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>
            {isChallenger ? 'You' : guildNames[war.challenger_guild_id] || 'Challenger'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: war.challenger_score > war.defender_score ? '#22C55E' : '#F9FAFB' }}>
            {war.challenger_score}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#64748B' }}>VS</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>
            {!isChallenger ? 'You' : guildNames[opponentId] || 'Defender'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: war.defender_score > war.challenger_score ? '#22C55E' : '#F9FAFB' }}>
            {war.defender_score}
          </div>
        </div>
      </div>

      {/* Result indicator */}
      {war.status === 'completed' && (
        <div style={{
          textAlign: 'center',
          marginTop: 8,
          fontSize: 12,
          fontWeight: 600,
          color: isWin ? '#22C55E' : isLoss ? '#EF4444' : '#94A3B8',
        }}>
          {isWin ? '🏆 Victory!' : isLoss ? '💪 Good effort!' : '🤝 Draw'}
        </div>
      )}

      {/* Pending actions for defender */}
      {war.status === 'pending' && !isChallenger && onAccept && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(34,197,94,0.4)',
              background: 'rgba(34,197,94,0.1)',
              color: '#22C55E',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            ⚔️ Accept Challenge
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDecline?.(); }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.06)',
              color: '#EF4444',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Decline
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#64748B' }}>
          {war.duration_days}d war
        </span>
        {war.spectators.length > 0 && (
          <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={10} /> {war.spectators.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function GuildWars({ guildId, userId, userRole, guildName }: GuildWarsProps) {
  const {
    wars, activeWars, pendingWars, completedWars,
    earnedRewards, loading, error, declareWar,
    acceptWar, declineWar, getWinLossDisplay, getWarRankings,
  } = useGuildWars(guildId, userId);

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [guildNames, setGuildNames] = useState<Record<string, string>>({});

  // Load guild names for wars
  useEffect(() => {
    const ids = new Set<string>();
    for (const w of wars) {
      ids.add(w.challenger_guild_id);
      ids.add(w.defender_guild_id);
    }
    if (ids.size === 0) return;

    const loadNames = async () => {
      try {
        const { supabase } = await import('../../lib/data-access');
        const { data } = await supabase
          .from('goal_groups')
          .select('id, name')
          .in('id', Array.from(ids));

        if (data) {
          const map: Record<string, string> = {};
          for (const g of data as any[]) {
            map[g.id] = g.name;
          }
          // Also set our own guild name
          if (guildName) map[guildId] = guildName;
          setGuildNames(map);
        }
      } catch {
        // Fallback: just use IDs
        if (guildName) {
          setGuildNames({ [guildId]: guildName });
        }
      }
    };
    void loadNames();
  }, [wars, guildId, guildName]);

  const selectedWar = useMemo(() => wars.find(w => w.id === selectedWarId), [wars, selectedWarId]);

  const canDeclare = userRole === 'owner' || userRole === 'admin';
  const wlDisplay = getWinLossDisplay(guildId);
  const rankings = getWarRankings();

  const handleDeclareWar = useCallback((params: Parameters<typeof declareWar>[0]) => {
    declareWar(params);
  }, [declareWar]);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="gw-container" style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Flame size={22} style={{ color: '#F97316' }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#F9FAFB', margin: 0 }}>Guild Wars</h3>
          <span style={countBadgeStyle}>{wars.length}</span>
          <span style={wlBadgeStyle}>{wlDisplay}</span>
        </div>
        {canDeclare && (
          <button
            className="gw-declare-btn"
            onClick={() => setShowDeclaration(true)}
            style={declareWarBtnStyle}
          >
            <Swords size={14} /> Declare War
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={subTabBarStyle}>
        {([
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3, color: '#F97316' },
          { id: 'history', label: 'History', icon: Clock, color: '#A855F7' },
          { id: 'leaderboard', label: 'Rankings', icon: Crown, color: '#FFD700' },
          { id: 'rewards', label: 'Rewards', icon: Trophy, color: '#22C55E' },
        ] as const).map((tab) => {
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              style={subTabStyle(isActive, tab.color)}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading wars...</div>}

      {/* ── DASHBOARD ────────────────────────────────────────── */}
      {viewMode === 'dashboard' && (
        <>
          {/* Active Wars */}
          {activeWars.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <Flame size={14} style={{ color: '#F97316' }} />
                <span style={{ fontWeight: 700, color: '#F97316' }}>Active Wars</span>
                <span style={countBadgeStyle}>{activeWars.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeWars.map((war) => (
                  <WarCard
                    key={war.id}
                    war={war}
                    guildId={guildId}
                    userId={userId}
                    onClick={() => { setSelectedWarId(war.id); setViewMode('scoreboard'); }}
                    guildNames={guildNames}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Wars */}
          {pendingWars.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <Clock size={14} style={{ color: '#FACC15' }} />
                <span style={{ fontWeight: 700, color: '#FACC15' }}>Pending Challenges</span>
                <span style={countBadgeStyle}>{pendingWars.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingWars.map((war) => (
                  <WarCard
                    key={war.id}
                    war={war}
                    guildId={guildId}
                    userId={userId}
                    onClick={() => { setSelectedWarId(war.id); setViewMode('scoreboard'); }}
                    onAccept={() => acceptWar(war.id)}
                    onDecline={() => declineWar(war.id)}
                    guildNames={guildNames}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent completed */}
          {completedWars.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <Trophy size={14} style={{ color: '#A855F7' }} />
                <span style={{ fontWeight: 700, color: '#A855F7' }}>Recent Results</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {completedWars.slice(0, 5).map((war) => (
                  <WarCard
                    key={war.id}
                    war={war}
                    guildId={guildId}
                    userId={userId}
                    onClick={() => { setSelectedWarId(war.id); setViewMode('scoreboard'); }}
                    guildNames={guildNames}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeWars.length === 0 && pendingWars.length === 0 && completedWars.length === 0 && (
            <div style={emptyStateStyle}>
              <Swords size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', marginBottom: 4 }}>
                No wars yet!
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                Challenge another guild to a friendly competition
              </div>
              {canDeclare && (
                <button onClick={() => setShowDeclaration(true)} style={declareWarBtnStyle}>
                  <Swords size={14} /> Declare Your First War
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SCOREBOARD (selected war) ────────────────────────── */}
      {viewMode === 'scoreboard' && selectedWar && (
        <>
          <button
            onClick={() => setViewMode('dashboard')}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back to Dashboard
          </button>
          <WarScoreboard
            war={selectedWar}
            guildId={guildId}
            userId={userId}
            challengerName={guildNames[selectedWar.challenger_guild_id] || 'Challenger'}
            defenderName={guildNames[selectedWar.defender_guild_id] || 'Defender'}
          />
        </>
      )}

      {viewMode === 'scoreboard' && !selectedWar && (
        <div style={emptyStateStyle}>
          <Eye size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div style={{ fontSize: 13, color: '#64748B' }}>Select a war to view its scoreboard</div>
          <button onClick={() => setViewMode('dashboard')} style={{ marginTop: 12, fontSize: 12, color: '#F97316', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      {/* ── HISTORY ───────────────────────────────────────────── */}
      {viewMode === 'history' && (
        <>
          <div style={sectionHeaderStyle}>
            <Clock size={14} style={{ color: '#A855F7' }} />
            <span style={{ fontWeight: 700, color: '#A855F7' }}>War History</span>
          </div>
          {completedWars.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 13, color: '#64748B' }}>No completed wars yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {completedWars.map((war) => (
                <WarCard
                  key={war.id}
                  war={war}
                  guildId={guildId}
                  userId={userId}
                  onClick={() => { setSelectedWarId(war.id); setViewMode('scoreboard'); }}
                  guildNames={guildNames}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LEADERBOARD ──────────────────────────────────────── */}
      {viewMode === 'leaderboard' && (
        <>
          <div style={sectionHeaderStyle}>
            <Crown size={14} style={{ color: '#FFD700' }} />
            <span style={{ fontWeight: 700, color: '#FFD700' }}>War Rankings</span>
          </div>
          {rankings.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: 13, color: '#64748B' }}>No guilds ranked yet — win wars to appear here!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rankings.map((ranking, i) => {
                const isMyGuild = ranking.guild_id === guildId;
                return (
                  <div
                    key={ranking.guild_id}
                    style={{
                      ...rankingRowStyle,
                      background: isMyGuild ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
                      border: isMyGuild ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={rankBadgeStyle(i)}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isMyGuild ? '#F97316' : '#F9FAFB' }}>
                        {guildNames[ranking.guild_id] || ranking.guild_id.slice(0, 6)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {ranking.record.wins}W / {ranking.record.losses}L
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD700' }}>
                      {ranking.points}
                    </div>
                    <span style={{ fontSize: 10, color: '#64748B' }}>pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── REWARDS ───────────────────────────────────────────── */}
      {viewMode === 'rewards' && (
        <WarRewards
          rewards={earnedRewards}
          warWins={completedWars.filter(w => w.winner_id === guildId).length}
          guildName={guildName}
        />
      )}

      {/* ── WAR DECLARATION MODAL ──────────────────────────────── */}
      {showDeclaration && (
        <WarDeclaration
          challengerGuildId={guildId}
          challengerGuildName={guildName || 'Your Guild'}
          onDeclare={handleDeclareWar}
          onClose={() => setShowDeclaration(false)}
        />
      )}

      {/* Styles */}
      <style>{guildWarsStyles}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const containerStyle: React.CSSProperties = {
  padding: 4,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.06)',
  color: '#94A3B8',
  fontWeight: 600,
};

const wlBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'rgba(249,115,22,0.08)',
  border: '1px solid rgba(249,115,22,0.2)',
  color: '#F97316',
  fontWeight: 600,
};

const declareWarBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 10,
  border: '1px solid rgba(249,115,22,0.4)',
  background: 'rgba(249,115,22,0.1)',
  color: '#F97316',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
};

const subTabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 16,
  overflowX: 'auto',
};

function subTabStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 8,
    border: active ? `1px solid ${color}44` : '1px solid rgba(255,255,255,0.06)',
    background: active ? `${color}10` : 'transparent',
    color: active ? color : '#94A3B8',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

function warCardStyle(status: GuildWar['status']): React.CSSProperties {
  return {
    padding: '14px 16px',
    borderRadius: 12,
    background: status === 'active' ? 'rgba(249,115,22,0.04)' : 'rgba(255,255,255,0.02)',
    border: status === 'active' ? '1px solid rgba(249,115,22,0.15)' : '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  textAlign: 'center',
};

const rankingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 10,
};

function rankBadgeStyle(index: number): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    background: index === 0 ? 'rgba(255,215,0,0.1)' : index === 1 ? 'rgba(192,192,192,0.1)' : index === 2 ? 'rgba(205,127,50,0.1)' : 'rgba(255,255,255,0.04)',
    flexShrink: 0,
  };
}

export const guildWarsStyles = `
.gw-war-card:hover {
  background: rgba(255,255,255,0.04) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.gw-declare-btn:hover {
  box-shadow: 0 0 16px rgba(249,115,22,0.2);
  background: rgba(249,115,22,0.15) !important;
}

.gw-declare-btn:active {
  transform: scale(0.97);
}
`;