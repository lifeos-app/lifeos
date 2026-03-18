/**
 * SageDialogue — Enhanced dialogue component with free-text input
 *
 * Displays conversation history with the Sage NPC, typewriter effect
 * for the latest Sage message, and text input for user responses.
 */

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import type { ConversationMessage } from './OnboardingLLM';
import { assetPath } from '../../utils/assets';

interface SageDialogueProps {
  messages: ConversationMessage[];
  onSend: (text: string) => void;
  isThinking: boolean;
  inputMode: 'text' | 'textarea' | 'none';
  placeholder?: string;
  inputLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
  fallbackUI?: React.ReactNode;
  onTypewriterComplete?: () => void;
}

export function SageDialogue({
  messages,
  onSend,
  isThinking,
  inputMode,
  placeholder = 'Speak to the Sage...',
  inputLabel,
  showSkip,
  onSkip,
  fallbackUI,
  onTypewriterComplete,
}: SageDialogueProps) {
  const [inputValue, setInputValue] = useState('');
  const [skipConfirm, setSkipConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Typewriter for latest Sage message ──

  const lastSageIdx = findLastSageIndex(messages);
  const [typewriterText, setTypewriterText] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const typewriterIdxRef = useRef(-1);

  useEffect(() => {
    if (lastSageIdx < 0) return;

    // Only animate the latest sage message
    if (typewriterIdxRef.current === lastSageIdx) return;
    typewriterIdxRef.current = lastSageIdx;

    const fullText = messages[lastSageIdx].text;
    let charIdx = 0;
    setTypewriterText('');
    setTypewriterDone(false);

    const timer = setInterval(() => {
      charIdx++;
      if (charIdx >= fullText.length) {
        setTypewriterText(fullText);
        setTypewriterDone(true);
        clearInterval(timer);
        onTypewriterComplete?.();
      } else {
        setTypewriterText(fullText.slice(0, charIdx));
      }
    }, 30);

    return () => clearInterval(timer);
  }, [lastSageIdx, messages, onTypewriterComplete]);

  // ── Auto-scroll ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typewriterText, isThinking]);

  // ── Submit handler ──

  const handleSubmit = useCallback(() => {
    const value = inputValue.trim();
    if (!value || isThinking) return;
    onSend(value);
    setInputValue('');
  }, [inputValue, isThinking, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="realm-onboarding-dialogue-area">
      {/* Messages */}
      <div className="realm-onboarding-messages">
        {messages.map((msg, i) => {
          const isSage = msg.role === 'sage';
          const isLatestSage = i === lastSageIdx;
          const displayText = isLatestSage && !typewriterDone ? typewriterText : msg.text;

          return (
            <div
              key={i}
              className={`realm-onboarding-message realm-onboarding-message--${isSage ? 'sage' : 'user'}`}
            >
              {isSage && (
                <img
                  src={assetPath('/images/npcs/sage.png')}
                  alt="Sage"
                  className="realm-onboarding-sage-portrait"
                />
              )}
              <div className="realm-onboarding-message-text">
                {displayText}
                {isLatestSage && !typewriterDone && (
                  <span className="realm-onboarding-cursor">▊</span>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="realm-onboarding-thinking">
            Sage is pondering
            <span className="realm-onboarding-thinking-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fallback UI (class cards, motivation pills) */}
      {fallbackUI && (
        <div className="realm-onboarding-fallback-area">
          {fallbackUI}
        </div>
      )}

      {/* Input */}
      {inputMode !== 'none' && (
        <div className="realm-onboarding-input-area">
          {inputLabel && (
            <div className="realm-onboarding-input-label">{inputLabel}</div>
          )}
          <div className="realm-onboarding-input-row">
            {inputMode === 'textarea' ? (
              <textarea
                ref={textareaRef}
                className="realm-onboarding-textarea"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isThinking}
                rows={3}
              />
            ) : (
              <input
                ref={inputRef}
                className="realm-onboarding-input"
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isThinking}
              />
            )}
            <button
              className="realm-onboarding-send-btn"
              onClick={handleSubmit}
              disabled={isThinking || !inputValue.trim()}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Skip */}
      {showSkip && onSkip && (
        skipConfirm ? (
          <div className="realm-onboarding-skip-confirm">
            <span>Skip the tutorial? You can always replay it later.</span>
            <button className="realm-onboarding-skip-btn" onClick={onSkip}>Skip</button>
            <button className="realm-onboarding-skip-btn" onClick={() => setSkipConfirm(false)}>Continue</button>
          </div>
        ) : (
          <button className="realm-onboarding-skip" onClick={(e: MouseEvent) => { e.preventDefault(); setSkipConfirm(true); }}>
            Skip
          </button>
        )
      )}
    </div>
  );
}

function findLastSageIndex(messages: ConversationMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'sage') return i;
  }
  return -1;
}
