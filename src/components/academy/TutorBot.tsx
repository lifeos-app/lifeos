/**
 * TutorBot — AI chat sidebar panel for Academy lessons
 *
 * Renders inside LessonViewer2 as a ~35% width side panel.
 * Uses local LLM streaming (ai-local.ts) for animated text output.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  buildTutorMessages,
  getModeLabel,
  getModeDescription,
  ALL_MODES,
  type TutorMode,
} from '../../lib/llm/academy-tutor';
import { chatCompletionStream } from '../../lib/ai-local';
import { TutorModeButton } from './TutorModeButton';

// ── Local types (inline per spec) ────────────────────────────────────

type TutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: TutorMode;
  timestamp: string;
};

type CurriculumLesson = {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  estimatedMinutes: number;
  phaseIndex: number;
  completedAt: string | null;
  xpReward: number;
};

type LearningGoal = {
  id: string;
  topic: string;
  domain: string;
  currentLevel: string;
  curriculum: {
    phases: { title: string; topics: { lessons: CurriculumLesson[] }[] }[];
  } | null;
  [key: string]: unknown;
};

// ── Props ────────────────────────────────────────────────────────────

interface TutorBotProps {
  goal: LearningGoal;
  lesson: CurriculumLesson;
  activeMode: TutorMode;
  onModeChange: (mode: TutorMode) => void;
}

// ── Empty-state messages per mode ────────────────────────────────────

const EMPTY_STATE: Record<TutorMode, (title: string) => string> = {
  chat: (t) => `Ask me anything about "${t}"`,
  deep_solve: () => 'What problem are you trying to solve?',
  quiz: (t) => `Ready to test your knowledge of "${t}"!`,
  research: (t) => `Let\'s explore "${t}" in depth`,
  visualize: (t) => `I\'ll create a visual map of "${t}"`,
  practice: (t) => `Let\'s practice "${t}" hands-on`,
};

// ── Component ────────────────────────────────────────────────────────

export function TutorBot({ goal, lesson, activeMode, onModeChange }: TutorBotProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevModeRef = useRef<TutorMode>(activeMode);
  const autoTriggeredRef = useRef(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  // Mode change: clear messages and show system message
  useEffect(() => {
    if (prevModeRef.current !== activeMode) {
      setMessages([]);
      setStreamedText('');
      setInput('');
      autoTriggeredRef.current = false;
      prevModeRef.current = activeMode;
    }
  }, [activeMode]);

  // Auto-trigger for quiz and practice modes
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (activeMode === 'quiz') {
      autoTriggeredRef.current = true;
      sendMessage('Generate 3 practice questions for this lesson');
    } else if (activeMode === 'practice') {
      autoTriggeredRef.current = true;
      sendMessage('Give me a practice exercise for this lesson');
    }
  }, [activeMode, lesson.id]);

  const sendMessage = useCallback(async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const userMsg: TutorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      mode: activeMode,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInput('');
    setLoading(true);
    setStreamedText('');

    const historyForLLM = [...messages, userMsg].map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const llmMessages = buildTutorMessages({
      goal: { topic: goal.topic, domain: goal.domain, currentLevel: goal.currentLevel },
      lesson: {
        title: lesson.title,
        content: lesson.content,
        keyPoints: lesson.keyPoints,
      },
      mode: activeMode,
      messageHistory: historyForLLM.slice(0, -1), // exclude last (it gets added by buildTutorMessages)
      userInput: userText,
    });

    let fullText = '';

    try {
      await chatCompletionStream(
        {
          messages: llmMessages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          temperature: 0.7,
          max_tokens: 1024,
        },
        {
          onToken: (token) => {
            fullText += token;
            setStreamedText(fullText);
          },
          onComplete: (text) => {
            fullText = text;
          },
          onError: (err) => {
            fullText = `Sorry, I couldn't connect to the AI tutor. Error: ${err.message}`;
          },
        },
      );
    } catch {
      if (!fullText) {
        fullText = 'Sorry, the AI tutor is not available right now. Make sure the local AI bridge is running.';
      }
    }

    const assistantMsg: TutorMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullText,
      mode: activeMode,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setStreamedText('');
    setLoading(false);
  }, [input, loading, activeMode, messages, goal, lesson]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '0 12px 12px 0',
    }}>
      {/* Mode bar */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
          {ALL_MODES.map((mode) => (
            <TutorModeButton
              key={mode}
              mode={mode}
              active={mode === activeMode}
              onClick={onModeChange}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {messages.length === 0 && !loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}>
            <Bot size={32} color="#00D4FF" style={{ opacity: 0.6 }} />
            <div style={{ fontSize: 14, color: '#8BA4BE', maxWidth: 220 }}>
              {EMPTY_STATE[activeMode](lesson.title)}
            </div>
            <div style={{ fontSize: 11, color: '#5A7A9A' }}>
              {getModeDescription(activeMode)}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming response */}
        {loading && streamedText && (
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'rgba(0,212,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="#00D4FF" />
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '4px 12px 12px 12px',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#D0D0D0',
              maxWidth: '90%',
            }}>
              <MarkdownContent content={streamedText} />
            </div>
          </div>
        )}

        {/* Loading spinner when no streamed text yet */}
        {loading && !streamedText && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '8px 0',
          }}>
            <Loader2 size={16} color="#00D4FF" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#5A7A9A' }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${lesson.title}...`}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#E0E0E0',
              maxHeight: 120,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              background: loading || !input.trim()
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,212,255,0.2)',
              color: loading || !input.trim() ? '#5A7A9A' : '#00D4FF',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Spin keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────

function MessageBubble({ message }: { message: TutorMessage }) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: isUser ? 'rgba(212,175,55,0.1)' : 'rgba(0,212,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={14} color="#D4AF37" />
          : <Bot size={14} color="#00D4FF" />
        }
      </div>
      <div style={{
        background: isUser
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(255,255,255,0.04)',
        borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#D0D0D0',
        maxWidth: '90%',
      }}>
        {isUser
          ? message.content
          : <MarkdownContent content={message.content} />
        }
      </div>
    </div>
  );
}

// ── Markdown renderer ────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '12px 0 6px' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, color: '#E0E0E0', margin: '10px 0 5px' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, color: '#C0C0C0', margin: '8px 0 4px' }}>{children}</h3>,
        p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" style={{ color: '#00D4FF', textDecoration: 'none' }}>{children}</a>,
        ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '4px 0 8px' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '4px 0 8px' }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 2, fontSize: 13 }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: '2px solid #00D4FF', paddingLeft: 10, margin: '8px 0',
            color: '#8BA4BE', fontStyle: 'italic', fontSize: 12,
          }}>
            {children}
          </blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code style={{
                background: 'rgba(0,212,255,0.1)', color: '#00D4FF',
                padding: '1px 4px', borderRadius: 3, fontSize: '0.85em',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}>
                {children}
              </code>
            );
          }
          return (
            <code className={className} style={{
              display: 'block', background: '#0A1628', padding: '10px 12px',
              borderRadius: 6, overflowX: 'auto', fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.06)',
              color: '#E0E0E0', margin: '4px 0',
            }} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre style={{ margin: '6px 0', background: 'transparent' }}>{children}</pre>,
        strong: ({ children }) => <strong style={{ color: '#fff', fontWeight: 600 }}>{children}</strong>,
        em: ({ children }) => <em style={{ color: '#8BA4BE' }}>{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
