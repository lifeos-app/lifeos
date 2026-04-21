import { useState, useRef, useEffect } from 'react';
import {
  X, Sparkles, RotateCcw, Settings as SettingsIcon, ChevronDown, Plus, Trash2,
} from 'lucide-react';
import { PAGE_MODES } from './helpers';
import type { RateLimitInfo } from '../../lib/intent-engine';
import type { AIConversationMeta } from '../../lib/ai-memory';
import { RateLimitPill } from './ChatMessages';

interface ChatHeaderProps {
  pathname: string;
  rateLimit: RateLimitInfo | null;
  currentConversationId: string | null;
  currentTitle: string | null;
  conversations: AIConversationMeta[];
  onClearChat: () => void;
  onNavigateSettings: () => void;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatHeader({
  pathname,
  rateLimit,
  currentConversationId,
  currentTitle,
  conversations,
  onClearChat,
  onNavigateSettings,
  onClose,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ChatHeaderProps) {
  const mode = PAGE_MODES[pathname];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const hasConversations = conversations.length > 0;

  return (
    <div className="ai-chat-header">
      <div className="ai-chat-header-left">
        <Sparkles size={18} className="ai-chat-header-icon" />
        {/* Conversation title + dropdown toggle */}
        <div className="ai-chat-conversation-selector" ref={dropdownRef}>
          <button
            className="ai-chat-title-btn"
            onClick={() => hasConversations && setDropdownOpen(d => !d)}
            title={currentTitle || 'LifeOS AI'}
          >
            <span className="ai-chat-title">{currentTitle || 'LifeOS AI'}</span>
            {hasConversations && (
              <ChevronDown size={12} className={`ai-chat-dropdown-chevron${dropdownOpen ? ' open' : ''}`} />
            )}
          </button>
          {dropdownOpen && hasConversations && (
            <div className="ai-chat-dropdown">
              <button
                className="ai-chat-dropdown-item ai-chat-dropdown-item--new"
                onClick={() => { onNewConversation(); setDropdownOpen(false); }}
              >
                <Plus size={12} /> New Conversation
              </button>
              <div className="ai-chat-dropdown-divider" />
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`ai-chat-dropdown-item${conv.id === currentConversationId ? ' active' : ''}`}
                  onClick={() => { onSelectConversation(conv.id); setDropdownOpen(false); }}
                >
                  <span className="ai-chat-dropdown-item-title">{conv.title}</span>
                  <button
                    className="ai-chat-dropdown-item-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                    title="Delete conversation"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {mode && (
          <span className="ai-chat-mode" style={{ color: mode.color }}>
            {mode.emoji} {mode.label}
          </span>
        )}
        {rateLimit && rateLimit.limit < 9999 && (
          <RateLimitPill rateLimit={rateLimit} />
        )}
      </div>
      <div className="ai-chat-header-actions">
        <button className="ai-chat-btn" onClick={onClearChat} title="Clear chat" aria-label="Clear chat">
          <RotateCcw size={14} />
        </button>
        <button className="ai-chat-btn" onClick={onNavigateSettings} title="AI Settings" aria-label="AI Settings">
          <SettingsIcon size={14} />
        </button>
        <button className="ai-chat-btn" onClick={onClose} title="Close (Esc)" aria-label="Close chat">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}