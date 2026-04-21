import {
  Check, X, Loader2, Info,
} from 'lucide-react';
import { ACTION_ICONS, ACTION_COLORS } from './helpers';
import type { ChatMessage } from './helpers';

interface ChatActionCardsProps {
  msg: ChatMessage;
  onConfirm: (msgId: string) => void;
  onDismiss: (msgId: string) => void;
}

export function ChatActionCards({ msg, onConfirm, onDismiss }: ChatActionCardsProps) {
  if (msg.isStreaming) return null;

  const filteredActions = msg.actions?.filter(a => a.type !== 'orchestrator_tool') ?? [];
  if (filteredActions.length === 0) return null;

  return (
    <div className="ai-chat-actions ai-actions-enter">
      {filteredActions.map((action, i) => {
        const Icon = ACTION_ICONS[action.type] || Info;
        const color = ACTION_COLORS[action.type] || '#6B7280';
        return (
          <div key={i} className="ai-chat-action-card" style={{ borderLeftColor: color }}>
            <div className="ai-chat-action-header">
              <Icon size={14} style={{ color }} />
              <span className="ai-chat-action-type" style={{ color }}>
                {action.type}
              </span>
              <span className="ai-chat-action-conf">
                {Math.round(action.confidence * 100)}%
              </span>
            </div>
            <p className="ai-chat-action-summary">{action.summary}</p>
          </div>
        );
      })}

      {/* Confirmation buttons */}
      {msg.needs_confirmation && !msg.executed && !msg.executing && (
        <div className="ai-chat-confirm-row">
          <button
            className="ai-chat-confirm-btn yes"
            onClick={() => onConfirm(msg.id)}
          >
            <Check size={14} /> Yes, do it
          </button>
          <button
            className="ai-chat-confirm-btn no"
            onClick={() => onDismiss(msg.id)}
          >
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {/* Executing spinner */}
      {msg.executing && (
        <div className="ai-chat-executing">
          <Loader2 size={14} className="spin" /> Creating...
        </div>
      )}

      {/* Execution results */}
      {msg.executed && msg.executionResults && (
        <div className="ai-chat-results">
          {msg.executionResults.success && msg.executionResults.successes.length > 0 && (
            <div className="ai-chat-result-banner ok">
              {msg.executionResults.successes.map((s, i) => (
                <div key={i} className="ai-chat-result ok">{s}</div>
              ))}
            </div>
          )}
          {msg.executionResults.failures.map((f, i) => (
            <div key={i} className="ai-chat-result err">{f}</div>
          ))}
        </div>
      )}
    </div>
  );
}
