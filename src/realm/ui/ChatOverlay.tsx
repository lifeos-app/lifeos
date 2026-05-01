/**
 * ChatOverlay — Zone / Guild / Global chat panel
 *
 * Slide-up panel with message list, input, and emote shortcuts.
 * Guild tab uses real-time Supabase group messaging.
 * Global tab uses zone broadcast chat with / commands.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { EMOTE_COMMANDS, type ChatMessage, type ChatChannel } from '../multiplayer/types';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface ChatOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSend: (content: string) => boolean;
  messages: ChatMessage[];
  /** Guild chat integration */
  guildMessages?: ChatMessage[];
  onGuildSend?: (content: string) => boolean;
  /** User's guilds for dropdown */
  userGuilds?: Array<{ id: string; name: string; icon: string }>;
  /** Active guild ID for guild tab */
  activeGuildId?: string;
  onGuildSelect?: (guildId: string) => void;
  /** Global zone player count */
  zonePlayerCount?: number;
  /** Online players in zone for Global tab */
  zonePlayers?: Array<{ name: string; level: number; classIcon: string }>;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: string;
}

const EMOTE_LABELS: Record<string, string> = {
  '/wave': 'Wave',
  '/cheer': 'Cheer',
  '/gg': 'GG',
  '/brb': 'BRB',
  '/focus': 'Focus',
  '/dance': 'Dance',
  '/bow': 'Bow',
  '/roll': 'Roll Dice',
  '/tip': 'Tip',
};

const EMOTES = Object.keys(EMOTE_COMMANDS).map(cmd => ({
  cmd,
  label: EMOTE_LABELS[cmd] || cmd,
}));

const EXTRA_SLASH_COMMANDS: SlashCommand[] = [
  { command: '/roll', label: '/roll', description: 'Roll a dice (1-100)', icon: '🎲' },
  { command: '/tip', label: '/tip', description: 'Share a random productivity tip', icon: '💡' },
];

const PRODUCTIVITY_TIPS = [
  'Break big tasks into tiny steps!',
  'The 2-minute rule: if it takes <2 min, do it now.',
  'Stack habits: attach a new habit to an existing one.',
  'Review your goals weekly to stay on track.',
  'Celebrate small wins — they compound!',
  'Your streak is your superpower. Protect it.',
  'Set a specific time for each habit.',
  'Track your progress — what gets measured gets managed.',
  'Accountability partners double your success rate.',
  'Rest is productive. Take breaks to recharge.',
];

function getRollResult(): string {
  const roll = Math.floor(Math.random() * 100) + 1;
  return `🎲 rolls a ${roll}!`;
}

function getRandomTip(): string {
  const tip = PRODUCTIVITY_TIPS[Math.floor(Math.random() * PRODUCTIVITY_TIPS.length)];
  return `💡 Tip: ${tip}`;
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function ChatOverlay({
  visible,
  onClose,
  onSend,
  messages,
  guildMessages = [],
  onGuildSend,
  userGuilds = [],
  activeGuildId,
  onGuildSelect,
  zonePlayerCount = 0,
  zonePlayers = [],
}: ChatOverlayProps) {
  const [input, setInput] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [activeTab, setActiveTab] = useState<'zone' | 'guild' | 'global'>('zone');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showGuildDropdown, setShowGuildDropdown] = useState(false);

  // Determine active messages based on tab
  const activeMessages = activeTab === 'guild' ? guildMessages : messages;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Focus input when overlay opens
  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  const processSlashCommand = useCallback((text: string): string | null => {
    const lower = text.toLowerCase().trim();
    if (lower === '/roll') return getRollResult();
    if (lower === '/tip') return getRandomTip();
    return null;
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    // Check for special slash commands first
    const slashResult = processSlashCommand(text);
    if (slashResult) {
      const sent = onSend(slashResult);
      if (sent) setInput('');
      else {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 1000);
      }
      return;
    }

    // Route to appropriate sender based on tab
    const sendFn = activeTab === 'guild' && onGuildSend ? onGuildSend : onSend;
    const sent = sendFn(text);
    if (sent) {
      setInput('');
    } else {
      setRateLimited(true);
      setTimeout(() => setRateLimited(false), 1000);
    }
  }, [input, onSend, onGuildSend, activeTab, processSlashCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSend, onClose]);

  const handleEmote = useCallback((cmd: string) => {
    onSend(cmd);
  }, [onSend]);

  if (!visible) return null;

  return (
    <div className="realm-chat-overlay">
      {/* Header */}
      <div className="realm-chat-header">
        <div className="realm-chat-tabs">
          <button
            className={`realm-chat-tab ${activeTab === 'zone' ? 'realm-chat-tab--active' : ''}`}
            onClick={() => setActiveTab('zone')}
          >
            Zone
          </button>
          <button
            className={`realm-chat-tab ${activeTab === 'guild' ? 'realm-chat-tab--active' : ''}`}
            onClick={() => setActiveTab('guild')}
          >
            Guild
            {userGuilds.length > 0 && (
              <span className="realm-chat-tab-badge">{userGuilds.length}</span>
            )}
          </button>
          <button
            className={`realm-chat-tab ${activeTab === 'global' ? 'realm-chat-tab--active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            Global
            {zonePlayerCount > 0 && (
              <span className="realm-chat-tab-badge">{zonePlayerCount}</span>
            )}
          </button>
        </div>
        <button className="realm-chat-close" onClick={onClose}>&times;</button>
      </div>

      {/* Guild selector dropdown */}
      {activeTab === 'guild' && userGuilds.length > 1 && (
        <div className="realm-chat-guild-selector">
          <button
            className="realm-chat-guild-btn"
            onClick={() => setShowGuildDropdown(!showGuildDropdown)}
          >
            {userGuilds.find(g => g.id === activeGuildId)?.icon ?? '⚔️'}{' '}
            {userGuilds.find(g => g.id === activeGuildId)?.name ?? 'Select Guild'} ▾
          </button>
          {showGuildDropdown && (
            <div className="realm-chat-guild-dropdown">
              {userGuilds.map(guild => (
                <button
                  key={guild.id}
                  className={`realm-chat-guild-option ${guild.id === activeGuildId ? 'realm-chat-guild-option--active' : ''}`}
                  onClick={() => {
                    onGuildSelect?.(guild.id);
                    setShowGuildDropdown(false);
                  }}
                >
                  {guild.icon} {guild.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global tab: zone player list */}
      {activeTab === 'global' && zonePlayers.length > 0 && (
        <div className="realm-chat-player-list">
          <div className="realm-chat-player-list-header">
            In this zone ({zonePlayerCount})
          </div>
          <div className="realm-chat-player-list-items">
            {zonePlayers.slice(0, 10).map(p => (
              <span key={p.name} className="realm-chat-player-tag">
                {p.classIcon} {p.name} Lv.{p.level}
              </span>
            ))}
            {zonePlayers.length > 10 && (
              <span className="realm-chat-player-more">
                +{zonePlayers.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="realm-chat-messages">
        {activeTab === 'guild' && userGuilds.length === 0 && (
          <div className="realm-chat-empty">
            You're not in any guilds yet. Join or create one from the Guild Hall!
          </div>
        )}
        {activeMessages.length === 0 && !(activeTab === 'guild' && userGuilds.length === 0) && (
          <div className="realm-chat-empty">
            {activeTab === 'guild' ? 'No guild messages yet. Say hello to your team!' :
             activeTab === 'global' ? 'No zone chat. Be the first to speak!' :
             'No messages yet. Say hello!'}
          </div>
        )}
        {activeMessages.slice(-50).map((msg) => (
          <div
            key={msg.id}
            className={`realm-chat-msg ${msg.isEmote ? 'realm-chat-msg--emote' : ''}`}
          >
            <span className="realm-chat-msg-name">{msg.senderName}</span>
            <span className="realm-chat-msg-text">
              {msg.isEmote ? msg.content : `: ${msg.content}`}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Emote shortcuts */}
      <div className="realm-chat-emotes">
        {EMOTES.map(({ cmd, label }) => (
          <button
            key={cmd}
            className="realm-chat-emote-btn"
            onClick={() => handleEmote(cmd)}
            title={cmd}
          >
            {label}
          </button>
        ))}
        {activeTab === 'global' && EXTRA_SLASH_COMMANDS.map(sc => (
          <button
            key={sc.command}
            className="realm-chat-emote-btn"
            onClick={() => onSend(sc.command)}
            title={sc.description}
          >
            {sc.icon}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="realm-chat-input">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          onKeyDown={handleKeyDown}
          placeholder={
            rateLimited ? 'Slow down!' :
            activeTab === 'guild' ? 'Message your guild...' :
            activeTab === 'global' ? 'Zone chat (/roll, /tip)...' :
            'Type a message...'
          }
          className={rateLimited ? 'realm-chat-input--limited' : ''}
          maxLength={200}
        />
        <button className="realm-chat-send" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}