import { type RefObject } from 'react';
import { Send, Square, Mic, Lock } from 'lucide-react';
import { getSuggestions } from './helpers';
import type { SuggestionChip } from './helpers';

// ─── Suggestion Chips ────────────────────────────────────────────
interface SuggestionChipsProps {
  show: boolean;
  messagesEmpty: boolean;
  loading: boolean;
  pathname?: string;
  onChipClick: (suggestion: SuggestionChip) => void;
}

export function SuggestionChips({ show, messagesEmpty, loading, pathname, onChipClick }: SuggestionChipsProps) {
  if (!show || !messagesEmpty || loading) return null;

  const suggestions = getSuggestions(pathname || '/');

  return (
    <div className="ai-chat-suggestions">
      {suggestions.map((suggestion, i) => {
        const Icon = suggestion.icon;
        return (
          <button
            key={i}
            className="ai-chat-suggestion-chip"
            onClick={() => onChipClick(suggestion)}
            style={{ borderColor: suggestion.color }}
          >
            <Icon size={14} style={{ color: suggestion.color }} />
            <span>{suggestion.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Chat Input Area ─────────────────────────────────────────────
interface ChatInputAreaProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onCancel: () => void;
  onToggleMic: () => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  loading: boolean;
  contextLoading: boolean;
  isGenerating: boolean;
  isMicListening: boolean;
  micSupported: boolean;
  rateLimitExhausted?: boolean;
  rateLimitResetTime?: string;
  remainingMessages?: number;
  maxMessages?: number;
}

export function ChatInputArea({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onCancel,
  onToggleMic,
  inputRef,
  loading,
  contextLoading,
  isGenerating,
  isMicListening,
  micSupported,
  rateLimitExhausted,
  rateLimitResetTime,
  remainingMessages,
  maxMessages,
}: ChatInputAreaProps) {
  const isDisabled = loading || contextLoading;

  return (
    <div className={`ai-chat-input-area ${rateLimitExhausted ? 'ai-chat-input-area--locked' : ''}`}>
      {rateLimitExhausted && (
        <div className="ai-chat-lockout-banner">
          <Lock size={14} />
          <span>Daily limit reached{rateLimitResetTime ? ` \u00b7 Resets at ${rateLimitResetTime}` : ''}</span>
        </div>
      )}
      <textarea
        ref={inputRef}
        className="ai-chat-input"
        placeholder={
          isMicListening
            ? 'Listening\u2026'
            : rateLimitExhausted
              ? 'Daily limit reached \u2014 send to retry'
              : 'Add bananas and milk to my grocery list...'
        }
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={isDisabled}
      />
      {micSupported && (
        <button
          className={`ai-chat-mic ${isMicListening ? 'ai-chat-mic--active' : ''}`}
          onClick={onToggleMic}
          title={isMicListening ? 'Stop listening' : 'Voice input'}
          type="button"
        >
          <Mic size={16} />
        </button>
      )}
      {isGenerating ? (
        <button
          className="ai-chat-cancel"
          onClick={onCancel}
          title="Stop generating"
        >
          <Square size={14} />
        </button>
      ) : (
        <button
          className="ai-chat-send"
          onClick={onSend}
          disabled={!input.trim() || isDisabled}
        >
          <Send size={16} />
        </button>
      )}
      {/* Rate limit remaining indicator */}
      {!rateLimitExhausted && remainingMessages !== undefined && maxMessages !== undefined && (
        <div className="ai-chat-rate-hint" title={`${remainingMessages} of ${maxMessages} messages remaining today`}>
          {remainingMessages}/{maxMessages}
        </div>
      )}
    </div>
  );
}
