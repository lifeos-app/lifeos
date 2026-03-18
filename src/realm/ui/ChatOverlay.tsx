/**
 * ChatOverlay — Zone chat panel
 *
 * Slide-up panel with message list, input, and emote shortcuts.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { EMOTE_COMMANDS, type ChatMessage } from '../multiplayer/types';

interface ChatOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSend: (content: string) => boolean;
  messages: ChatMessage[];
}

const EMOTE_LABELS: Record<string, string> = {
  '/wave': 'Wave',
  '/cheer': 'Cheer',
  '/gg': 'GG',
  '/brb': 'BRB',
  '/focus': 'Focus',
};

const EMOTES = Object.keys(EMOTE_COMMANDS).map(cmd => ({
  cmd,
  label: EMOTE_LABELS[cmd] || cmd,
}));

export function ChatOverlay({ visible, onClose, onSend, messages }: ChatOverlayProps) {
  const [input, setInput] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [activeTab, setActiveTab] = useState<'zone' | 'guild' | 'global'>('zone');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus input when overlay opens
  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const sent = onSend(text);
    if (sent) {
      setInput('');
    } else {
      setRateLimited(true);
      setTimeout(() => setRateLimited(false), 1000);
    }
  }, [input, onSend]);

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
            className="realm-chat-tab realm-chat-tab--disabled"
            title="Coming soon"
          >
            Guild
          </button>
          <button
            className="realm-chat-tab realm-chat-tab--disabled"
            title="Coming soon"
          >
            Global
          </button>
        </div>
        <button className="realm-chat-close" onClick={onClose}>&times;</button>
      </div>

      {/* Messages */}
      <div className="realm-chat-messages">
        {messages.length === 0 && (
          <div className="realm-chat-empty">No messages yet. Say hello!</div>
        )}
        {messages.slice(-50).map((msg) => (
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
      </div>

      {/* Input */}
      <div className="realm-chat-input">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          onKeyDown={handleKeyDown}
          placeholder={rateLimited ? 'Slow down!' : 'Type a message...'}
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
