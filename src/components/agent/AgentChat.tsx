import { useState, useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import { useAgentStore } from '../../stores/useAgentStore';
import { useUserStore } from '../../stores/useUserStore';
import type { AgentAction } from '../../lib/zeroclaw-client';
import './AgentChat.css';

interface AgentChatProps {
  onClose?: () => void;
}

type ChatTab = 'chat' | 'coaching';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#F43F5E',
  high: '#F97316',
  medium: '#00D4FF',
  low: '#39FF14',
};

export function AgentChat({ onClose }: AgentChatProps) {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useUserStore();
  const { messages, nudges, isTyping, isOnline, sendMessageStream, executeAction, dismissNudge, checkHealth } = useAgentStore();

  const activeNudges = nudges.filter(n => !n.dismissed);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !user) return;

    const context = {
      currentPage: window.location.pathname,
    };

    sendMessageStream(user.id, input.trim(), context);
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!user) return;
    setActiveTab('chat');
    sendMessageStream(user.id, prompt, { currentPage: window.location.pathname });
  };

  const handleActionClick = async (action: AgentAction) => {
    if (!user) return;

    if (action.requiresConfirm && !confirm(`${action.label}?`)) return;

    const success = await executeAction(user.id, action);
    if (!success) {
      alert('Action failed. Please try again.');
    }
  };

  const quickPrompts = [
    "Plan my week",
    "Goal check-in",
    "What should I focus on?"
  ];

  const coachingQuickActions = [
    { label: "Plan my week", prompt: "Help me plan my week based on my current goals and schedule" },
    { label: "Review goals", prompt: "Give me a progress check on all my active goals" },
    { label: "Reschedule overdue", prompt: "Help me reschedule my overdue tasks into realistic slots this week" },
  ];

  return (
    <div className="agent-chat">
      <div className="agent-chat-header">
        <div className="agent-chat-title">
          <span className="agent-icon"><Brain size={18} /></span>
          <span>LifeOS Agent</span>
          <span className={`agent-status ${isOnline ? 'online' : 'offline'}`} />
        </div>
        {onClose && (
          <button className="agent-chat-close" onClick={onClose}>×</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="agent-tab-bar">
        <button
          className={`agent-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`agent-tab ${activeTab === 'coaching' ? 'active' : ''}`}
          onClick={() => setActiveTab('coaching')}
        >
          Coaching
          {activeNudges.length > 0 && (
            <span className="agent-tab-badge">{activeNudges.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'chat' ? (
        /* Chat tab */
        <div className="agent-chat-messages">
          {messages.length === 0 ? (
            <div className="agent-chat-empty">
              <div className="agent-empty-icon"><Brain size={32} /></div>
              <p>Ask me anything about your goals, habits, or schedule</p>
              <div className="agent-quick-prompts">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    className="agent-quick-prompt"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`agent-message ${msg.role}`}>
                <div className="agent-message-content">
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="agent-tools">
                      {msg.toolsUsed.map((tool, i) => (
                        <span key={i} className="agent-tool">
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="agent-message-text">{msg.content}</div>
                  {msg.thinking && (
                    <details className="agent-thinking">
                      <summary>Thinking process</summary>
                      <p>{msg.thinking}</p>
                    </details>
                  )}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="agent-actions">
                      {msg.actions.map((action, i) => (
                        <button
                          key={i}
                          className="agent-action-btn"
                          onClick={() => handleActionClick(action)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="agent-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="agent-message assistant">
              <div className="agent-message-content">
                <div className="agent-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* Coaching tab */
        <div className="agent-coaching-panel">
          {/* Active Insights */}
          <div className="agent-coaching-section">
            <h3 className="agent-coaching-heading">Active Insights</h3>
            {activeNudges.length === 0 ? (
              <p className="agent-coaching-empty">No active insights right now. Check back later!</p>
            ) : (
              <div className="agent-coaching-insights">
                {activeNudges.map(nudge => (
                  <div key={nudge.id} className="agent-insight-card" style={{ borderLeftColor: PRIORITY_COLORS[nudge.priority] || '#00D4FF' }}>
                    <div className="agent-insight-header">
                      <span className="agent-insight-title">{nudge.title}</span>
                      <span className="agent-insight-priority" style={{ color: PRIORITY_COLORS[nudge.priority] || '#00D4FF' }}>
                        {nudge.priority}
                      </span>
                    </div>
                    <p className="agent-insight-summary">{nudge.summary}</p>
                    <div className="agent-insight-actions">
                      {nudge.actions?.map((action, i) => (
                        <button key={i} className="agent-insight-action-btn" onClick={() => handleActionClick(action)}>
                          {action.label}
                        </button>
                      ))}
                      <button className="agent-insight-dismiss" onClick={() => dismissNudge(nudge.id)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="agent-coaching-section">
            <h3 className="agent-coaching-heading">Quick Actions</h3>
            <div className="agent-coaching-actions">
              {coachingQuickActions.map((action, i) => (
                <button
                  key={i}
                  className="agent-coaching-action-btn"
                  onClick={() => handleQuickPrompt(action.prompt)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="agent-chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask your agent..."
          disabled={isTyping || !isOnline}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping || !isOnline}
          className="agent-send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
