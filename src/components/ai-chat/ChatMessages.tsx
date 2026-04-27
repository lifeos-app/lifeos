import { useState, lazy, Suspense, type RefObject } from 'react';
import remarkGfm from 'remark-gfm';
import {
  Sparkles, Loader2, ChevronDown, ChevronRight, Wrench, Crown,
} from 'lucide-react';
import type { RateLimitInfo } from '../../lib/intent-engine';
import { ChatActionCards } from './ChatActions';
import { OrchestratorCard } from './OrchestratorCards';
import { NLQueryResult } from '../NLQueryResult';
import type { ChatMessage } from './helpers';
import { formatTimestamp } from './helpers';
import { TTSButton } from '../TTSButton';

// Lazy load markdown renderer (47 KB savings from initial bundle)
const ReactMarkdown = lazy(() => import('react-markdown'));

// ─── Rate Limit Pill ─────────────────────────────────────────────
export function RateLimitPill({ rateLimit }: { rateLimit: RateLimitInfo }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = rateLimit.remaining / rateLimit.limit;
  const color = pct > 0.5 ? '#4ECB71' : pct > 0.16 ? '#FFD93D' : '#EF4444';

  // Calculate reset time as clock time
  const resetDate = new Date(rateLimit.resetAt * 1000);
  const resetTimeStr = resetDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  const resetMin = Math.max(1, Math.ceil(rateLimit.resetIn / 60));

  // SVG ring parameters
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div
      className="ai-rate-pill"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      <svg width={size} height={size} className="ai-rate-ring">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <span className="ai-rate-count" style={{ color }}>{rateLimit.remaining}</span>
      {showTooltip && (
        <div className="ai-rate-tooltip">
          <span>{rateLimit.remaining} of {rateLimit.limit} messages left</span>
          <span className="ai-rate-reset">Resets {resetMin <= 1 ? 'soon' : `in ${resetMin}min`} ({resetTimeStr})</span>
        </div>
      )}
    </div>
  );
}

// ─── Agent Thinking Block ────────────────────────────────────────
/** Collapsible thinking block for agent deep think responses */
export function AgentThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="ai-thinking-block">
      <button
        className="ai-thinking-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>💭 Thinking process</span>
      </button>
      {expanded && (
        <div className="ai-thinking-content">
          <Suspense fallback={<div style={{ padding: '8px', color: '#8BA4BE', fontSize: 13 }}>Loading...</div>}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thinking}
            </ReactMarkdown>
          </Suspense>
        </div>
      )}
    </div>
  );
}

// ─── Message List ────────────────────────────────────────────────
interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  contextLoading: boolean;
  messagesContainerRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  onConfirmActions: (msgId: string) => void;
  onDismissActions: (msgId: string) => void;
}

export function ChatMessageList({
  messages,
  loading,
  contextLoading,
  messagesContainerRef,
  messagesEndRef,
  onScroll,
  onConfirmActions,
  onDismissActions,
}: ChatMessageListProps) {
  return (
    <div className="ai-chat-messages" ref={messagesContainerRef} onScroll={onScroll}>
      {messages.length === 0 && !contextLoading && (
        <div className="ai-chat-empty">
          <Sparkles size={32} className="ai-chat-empty-icon" />
          <p className="ai-chat-empty-title">Just tell me what you need</p>
          <div className="ai-chat-examples">
            <span className="ai-chat-example">"Good morning! What's my day looking like?"</span>
            <span className="ai-chat-example">"Add bananas to my grocery list"</span>
            <span className="ai-chat-example">"Spent $45 on fuel"</span>
            <span className="ai-chat-example">"Slept 7 hours, feeling good"</span>
          </div>
          {/* Early adopter — all users get Pro */}
          <div className="ai-chat-tier-hint" style={{ marginTop: 16, padding: '8px 14px', background: 'rgba(0,212,255,0.08)', borderRadius: 8, fontSize: 12, color: '#00D4FF', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Crown size={12} /> Early Adopter · 15 AI messages/day
          </div>
        </div>
      )}

      {contextLoading && (
        <div className="ai-chat-loading-ctx">
          <Loader2 size={16} className="spin" />
          Loading your data...
        </div>
      )}

      {messages.map(msg => (
        <div key={msg.id} className={`ai-chat-msg ${msg.role} ai-msg-enter`}>
          {msg.role === 'assistant' && (
            <div className="ai-chat-avatar">
              <Sparkles size={12} />
            </div>
          )}
          <div className="ai-chat-bubble">
            {/* Agent tool badges */}
            {msg.agentToolsUsed && msg.agentToolsUsed.length > 0 && (
              <div className="ai-agent-tools">
                {msg.agentToolsUsed.map((tool, i) => (
                  <span key={i} className="ai-agent-tool-badge">
                    <Wrench size={9} />
                    {tool}
                  </span>
                ))}
              </div>
            )}

            {/* Agent loading indicator */}
            {msg.agentLoading && (
              <div className="ai-agent-loading">
                <Loader2 size={14} className="spin" />
                <span>Analyzing...</span>
              </div>
            )}

            {msg.role === 'assistant' ? (
              <div className="ai-chat-text ai-chat-markdown">
                <Suspense fallback={<div style={{ color: '#8BA4BE', fontSize: 14 }}>{msg.content}</div>}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </Suspense>
                {(msg.isStreaming || msg.agentLoading) && (
                  <span className="ai-stream-cursor" />
                )}
              </div>
            ) : (
              <p className="ai-chat-text">{msg.content}</p>
            )}

            {/* Agent thinking (expand/collapse) */}
            {msg.agentThinking && !msg.isStreaming && (
              <AgentThinkingBlock thinking={msg.agentThinking} />
            )}

            {/* Timestamp (hide during streaming) */}
            {!msg.isStreaming && !msg.agentLoading && (
              <div className="ai-chat-tts-row">
                <div className="ai-chat-timestamp">
                  {formatTimestamp(msg.timestamp)}
                </div>
                {msg.role === 'assistant' && (
                  <TTSButton text={msg.content} size={12} />
                )}
              </div>
            )}

            {/* Action cards (show after streaming completes, exclude orchestrator tools) */}
            <ChatActionCards
              msg={msg}
              onConfirm={onConfirmActions}
              onDismiss={onDismissActions}
            />

            {/* Orchestrator tool loading */}
            {msg.orchestratorLoading && (
              <div className="ai-orch-loading">
                <Loader2 size={16} className="spin" />
                <span>Running AI analysis...</span>
              </div>
            )}

            {/* Orchestrator rich card (structured data from AI tools) */}
            {!msg.isStreaming && msg.orchestratorData && (
              <div className="ai-orch-result ai-actions-enter">
                <OrchestratorCard result={msg.orchestratorData} />
              </div>
            )}

            {/* NL Query result (local data query, no LLM needed) */}
            {!msg.isStreaming && msg.nlQueryResult && (
              <NLQueryResult result={msg.nlQueryResult} />
            )}

            {/* Follow-up question (show after streaming completes) */}
            {!msg.isStreaming && msg.follow_up && !msg.executed && (
              <p className="ai-chat-followup">{msg.follow_up}</p>
            )}
          </div>
        </div>
      ))}

      {/* Typing indicator (waiting for API response) */}
      {loading && (
        <div className="ai-chat-msg assistant ai-msg-enter">
          <div className="ai-chat-avatar">
            <Sparkles size={12} />
          </div>
          <div className="ai-chat-bubble">
            <div className="ai-chat-thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
