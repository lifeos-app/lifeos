import { useState, useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import { AgentChat } from './AgentChat';
import { useAgentStore } from '../../stores/useAgentStore';
import './AgentChatFAB.css';

export function AgentChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { checkHealth, isOnline, nudges } = useAgentStore();
  const prevCountRef = useRef(0);
  const [pulseClass, setPulseClass] = useState('');

  const activeNudges = nudges.filter(n => !n.dismissed);
  const nudgeCount = activeNudges.length;

  // Determine highest priority for pulse color
  useEffect(() => {
    if (nudgeCount > prevCountRef.current && nudgeCount > 0) {
      const priorities = activeNudges.map(n => n.priority);
      if (priorities.includes('urgent')) setPulseClass('pulse-urgent');
      else if (priorities.includes('high')) setPulseClass('pulse-high');
      else setPulseClass('pulse-medium');

      const timer = setTimeout(() => setPulseClass(''), 4000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = nudgeCount;
  }, [nudgeCount, activeNudges]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <>
      <button
        className={`agent-chat-fab ${isOnline ? 'online' : 'offline'} ${pulseClass}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open AI Agent"
        title="AI Agent"
      >
        <span className="agent-fab-icon"><Brain size={20} /></span>
        {isOnline && <span className="agent-fab-pulse" />}
        {nudgeCount > 0 && (
          <span className="agent-fab-badge">{nudgeCount > 9 ? '9+' : nudgeCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="agent-chat-overlay"
            onClick={() => setIsOpen(false)}
          />
          <div className="agent-chat-panel">
            <AgentChat onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
