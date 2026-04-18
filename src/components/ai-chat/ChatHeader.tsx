import {
  X, Sparkles, RotateCcw, Settings as SettingsIcon,
} from 'lucide-react';
import { PAGE_MODES } from './helpers';
import type { RateLimitInfo } from '../../lib/intent-engine';
import { RateLimitPill } from './ChatMessages';

interface ChatHeaderProps {
  pathname: string;
  rateLimit: RateLimitInfo | null;
  onClearChat: () => void;
  onNavigateSettings: () => void;
  onClose: () => void;
}

export function ChatHeader({
  pathname,
  rateLimit,
  onClearChat,
  onNavigateSettings,
  onClose,
}: ChatHeaderProps) {
  const mode = PAGE_MODES[pathname];

  return (
    <div className="ai-chat-header">
      <div className="ai-chat-header-left">
        <Sparkles size={18} className="ai-chat-header-icon" />
        <span className="ai-chat-title">LifeOS AI</span>
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
