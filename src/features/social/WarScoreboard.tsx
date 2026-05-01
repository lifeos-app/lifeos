// LifeOS Social — Live War Scoreboard
// Side-by-side guild panels with animated progress, countdown, event feed, spectator cheers

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Swords, Clock, Users, Eye, Zap, Trophy, Flame, ChevronRight } from 'lucide-react';
import { useGuildWars, WAR_TYPE_CONFIG } from './useGuildWars';
import type { GuildWar, WarType, WarEvent } from './useGuildWars';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface WarScoreboardProps {
  war: GuildWar;
  guildId: string; // current user's guild
  userId: string;
  challengerName?: string;
  defenderName?: string;
}

interface AnimatedCounterProps {
  value: number;
  color: string;
  label: string;
}

// ═══════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════

function AnimatedCounter({ value, color, label }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prevRef.current = end;
  }, [value]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        className="ws-score-number"
        style={{
          fontSize: 36,
          fontWeight: 800,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          textShadow: `0 0 20px ${color}44`,
          transition: 'text-shadow 0.3s',
        }}
      >
        {display.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// COUNTDOWN
// ═══════════════════════════════════════════════════

function WarCountdown({ war, guildId, userId }: { war: GuildWar; guildId: string; userId: string }) {
  const { getTimeRemaining } = useGuildWars(guildId, userId);
  const time = getTimeRemaining(war.id);

  if (time.isPast) {
    return (
      <div className="ws-countdown ws-countdown--ended" style={countdownEndedStyle}>
        <Flame size={16} /> Battle Ended!
      </div>
    );
  }

  return (
    <div className="ws-countdown" style={countdownStyle}>
      <Clock size={14} style={{ opacity: 0.7 }} />
      <span>
        {time.days > 0 && `${time.days}d `}
        {time.hours}h {time.minutes}m remaining
      </span>
    </div>
  );
}

const countdownStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  fontSize: 13,
  color: '#94A3B8',
  justifyContent: 'center',
};

const countdownEndedStyle: React.CSSProperties = {
  ...countdownStyle,
  color: '#F97316',
  border: '1px solid rgba(249,115,22,0.3)',
  background: 'rgba(249,115,22,0.08)',
};

// ═══════════════════════════════════════════════════
// EVENTS FEED
// ═══════════════════════════════════════════════════

function WarEventsFeed({ events }: { events: WarEvent[] }) {
  const recent = useMemo(() => events.slice(-8).reverse(), [events]);

  if (recent.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: 16 }}>
        Waiting for the action to begin...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {recent.map((evt) => (
        <div key={evt.id} className="ws-event-item" style={eventItemStyle}>
          <span style={{ fontSize: 14 }}>{getEventIcon(evt.event_type)}</span>
          <span style={{ flex: 1, fontSize: 12, color: '#D1D5DB' }}>{evt.description}</span>
          <span style={{ fontSize: 10, color: '#64748B', flexShrink: 0 }}>
            {formatRelativeTime(evt.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getEventIcon(type: WarEvent['event_type']): string {
  switch (type) {
    case 'score': return '⚡';
    case 'milestone': return '🏆';
    case 'cheer': return '🎉';
    case 'declaration': return '⚔️';
    case 'acceptance': return '🤝';
    default: return '•';
  }
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

const eventItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
};

// ═══════════════════════════════════════════════════
// SPECTATOR CHEER BUTTONS
// ═══════════════════════════════════════════════════

const CHEER_EMOJIS = ['🔥', '💪', '🎉', '⚔️', '🏆', '❤️', '🎊', '🚀'];

function SpectatorCheerButtons({
  onCheer,
  isSpectator,
}: {
  onCheer: (emoji: string) => void;
  isSpectator: boolean;
}) {
  const [recentCheer, setRecentCheer] = useState<string | null>(null);

  const handleCheer = (emoji: string) => {
    onCheer(emoji);
    setRecentCheer(emoji);
    setTimeout(() => setRecentCheer(null), 1500);
  };

  if (!isSpectator) return null;

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
      {CHEER_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleCheer(emoji)}
          className="ws-cheer-btn"
          style={{
            ...cheerBtnStyle,
            transform: recentCheer === emoji ? 'scale(1.3)' : 'scale(1)',
            transition: 'transform 0.15s ease-out',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

const cheerBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function WarScoreboard({ war, guildId, userId, challengerName, defenderName }: WarScoreboardProps) {
  const { getWarProgress, getWarEvents, addWarEvent, addSpectator, removeSpectator } = useGuildWars(guildId, userId);

  const progress = getWarProgress(war.id);
  const events = getWarEvents(war.id);
  const isSpectator = !war.spectators.includes(userId) &&
    war.challenger_guild_id !== guildId &&
    war.defender_guild_id !== guildId;

  const isMyGuildChallenger = guildId === war.challenger_guild_id;
  const isMyGuildDefender = guildId === war.defender_guild_id;
  const isMyGuild = isMyGuildChallenger || isMyGuildDefender;

  const typeConfig = WAR_TYPE_CONFIG[war.type];
  const challengerColor = '#EF4444';
  const defenderColor = '#3B82F6';

  const handleSpectate = () => {
    if (isSpectator) {
      addSpectator(war.id);
    }
  };

  const handleCheer = (emoji: string) => {
    addWarEvent({
      war_id: war.id,
      guild_id: guildId,
      user_id: userId,
      event_type: 'cheer',
      description: `Spectator cheered ${emoji}`,
      score_delta: 0,
    });
  };

  return (
    <div className="ws-container" style={containerStyle}>
      {/* War Type Badge */}
      <div style={warTypeBadgeStyle(typeConfig.color)}>
        <span style={{ fontSize: 16 }}>{typeConfig.icon}</span>
        <span style={{ fontWeight: 600, color: typeConfig.color }}>{typeConfig.label}</span>
      </div>

      {/* Countdown */}
      {war.status === 'active' && (
        <WarCountdown war={war} guildId={guildId} userId={userId} />
      )}

      {war.status === 'pending' && (
        <div style={{ ...countdownStyle, color: '#FACC15', borderColor: 'rgba(250,204,21,0.3)', background: 'rgba(250,204,21,0.06)' }}>
          <Zap size={14} /> Awaiting response...
        </div>
      )}

      {war.status === 'completed' && (
        <div style={{ ...countdownStyle, color: war.winner_id ? '#22C55E' : '#94A3B8', borderColor: war.winner_id ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)' }}>
          <Trophy size={14} />
          {war.winner_id
            ? (war.winner_id === war.challenger_guild_id ? challengerName : defenderName) + ' Wins!'
            : 'Draw!'}
        </div>
      )}

      {/* Scoreboard */}
      <div style={scoreboardStyle}>
        {/* Challenger */}
        <div style={guildPanelStyle(isMyGuildChallenger)}>
          <div style={{ fontSize: 12, color: challengerColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ⚔️ Challenger
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB', margin: '8px 0 4px' }}>
            {challengerName || 'Challenger Guild'}
          </div>
          <AnimatedCounter
            value={war.challenger_score}
            color={challengerColor}
            label="Points"
          />
        </div>

        {/* VS divider */}
        <div style={vsStyle}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#64748B' }}>VS</div>
          {war.status === 'active' && (
            <div className="ws-vs-pulse" style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#F97316',
              marginTop: 4,
              animation: 'wsPulse 1.5s ease-in-out infinite',
            }} />
          )}
        </div>

        {/* Defender */}
        <div style={guildPanelStyle(isMyGuildDefender)}>
          <div style={{ fontSize: 12, color: defenderColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🛡️ Defender
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB', margin: '8px 0 4px' }}>
            {defenderName || 'Defender Guild'}
          </div>
          <AnimatedCounter
            value={war.defender_score}
            color={defenderColor}
            label="Points"
          />
        </div>
      </div>

      {/* Progress Bar (tug-of-war) */}
      {war.status === 'active' && (
        <div style={progressBarContainerStyle}>
          <div style={progressBarStyle(progress.challengerPercent, challengerColor, defenderColor)} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${progress.challengerPercent}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 12,
            fontWeight: 700,
            color: '#F9FAFB',
            transition: 'left 0.4s ease-out',
          }}>
            ⚔️
          </div>
        </div>
      )}

      {/* Spectator info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0' }}>
        <Eye size={12} style={{ color: '#64748B' }} />
        <span style={{ fontSize: 11, color: '#64748B' }}>
          {war.spectators.length} spectator{war.spectators.length !== 1 ? 's' : ''}
        </span>
        {!isMyGuild && !war.spectators.includes(userId) && war.status === 'active' && (
          <button
            onClick={handleSpectate}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid rgba(249,115,22,0.3)',
              background: 'rgba(249,115,22,0.08)',
              color: '#F97316',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Watch
          </button>
        )}
      </div>

      {/* Cheer buttons for spectators */}
      <SpectatorCheerButtons
        onCheer={handleCheer}
        isSpectator={war.spectators.includes(userId)}
      />

      {/* Events Feed */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📡 Live Feed
        </div>
        <WarEventsFeed events={events} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const containerStyle: React.CSSProperties = {
  background: 'rgba(15,15,20,0.6)',
  borderRadius: 16,
  padding: 20,
  border: '1px solid rgba(255,255,255,0.06)',
};

function warTypeBadgeStyle(color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    borderRadius: 8,
    background: `${color}11`,
    border: `1px solid ${color}33`,
    alignSelf: 'center',
    marginBottom: 16,
    width: 'fit-content',
  };
}

const scoreboardStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 16,
  alignItems: 'center',
  marginBottom: 16,
};

function guildPanelStyle(isMyGuild: boolean): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: isMyGuild ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
    border: isMyGuild ? '1px solid rgba(249,115,22,0.2)' : '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  };
}

const vsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0 4px',
};

const progressBarContainerStyle: React.CSSProperties = {
  position: 'relative',
  height: 12,
  borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  overflow: 'hidden',
  marginBottom: 12,
};

function progressBarStyle(challengerPct: number, challengerColor: string, defenderColor: string): React.CSSProperties {
  return {
    height: '100%',
    width: `${challengerPct}%`,
    background: `linear-gradient(90deg, ${challengerColor}88, ${challengerColor})`,
    borderRadius: 6,
    transition: 'width 0.6s ease-out',
    boxShadow: challengerPct > 50 ? `0 0 12px ${challengerColor}44` : 'none',
  };
}

// ═══════════════════════════════════════════════════
// CSS (injected as string for Vite compatibility)
// ═══════════════════════════════════════════════════

export const warScoreboardStyles = `
@keyframes wsPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.ws-cheer-btn:hover {
  background: rgba(255,255,255,0.08) !important;
  transform: scale(1.1) !important;
}

.ws-cheer-btn:active {
  transform: scale(0.95) !important;
}

.ws-event-item:hover {
  background: rgba(255,255,255,0.04) !important;
}
`;