/**
 * TutorChat — AI tutor chat interface using local Ollama.
 * Inspired by open-webui's chat UI but simplified for LifeOS.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, BookOpen, HelpCircle, Lightbulb, MessageSquare, GraduationCap, Bot, User, Wifi, WifiOff } from 'lucide-react';
import { generateTutorResponse, isTutorAvailable, type TutorMode, type TutorResponse } from '../../lib/tutor-engine';

const PRINCIPLE_COLORS = ['#A855F7','#06B6D4','#F97316','#EC4899','#39FF14','#FACC15','#D4AF37'];
const PRINCIPLE_NAMES = ['Mentalism','Correspondence','Vibration','Polarity','Rhythm','Cause & Effect','Gender'];

const MODE_CONFIG: Record<TutorMode, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  explain:   { icon: <BookOpen size={14} />, label: 'Explain',   description: 'Deep dive into a concept',       color: '#00D4FF' },
  quiz:      { icon: <HelpCircle size={14} />, label: 'Quiz',      description: 'Test your knowledge',           color: '#39FF14' },
  hint:      { icon: <Lightbulb size={14} />, label: 'Hint',      description: 'Guided discovery',               color: '#FACC15' },
  review:    { icon: <MessageSquare size={14} />, label: 'Review', description: 'Get feedback on your answer',    color: '#F97316' },
  connect:   { icon: <Sparkles size={14} />, label: 'Connect',   description: 'Link to Hermetic principles',     color: '#A855F7' },
  socratic:  { icon: <GraduationCap size={14} />, label: 'Socratic', description: 'Learn through questions',       color: '#EC4899' },
  practice:  { icon: <ZapIcon />, label: 'Practice', description: 'Hands-on exercises',                  color: '#D4AF37' },
};

function ZapIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
}

interface TutorChatProps {
  initialMode?: TutorMode;
  initialTopic?: string;
  hermeticPrinciple?: number;
}

interface Message {
  role: 'user' | 'tutor';
  content: string;
  timestamp: string;
  hermeticConnection?: { principle: number; principleName: string; insight: string };
  followUpQuestions?: string[];
}

export function TutorChat({ initialMode = 'explain', initialTopic = '', hermeticPrinciple }: TutorChatProps) {
  const [mode, setMode] = useState<TutorMode>(initialMode);
  const [topic, setTopic] = useState(initialTopic);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isTutorAvailable().then(setIsAvailable);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() && !topic) return;
    const userMessage = input.trim() || topic;
    setInput('');
    
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await generateTutorResponse({
        topic: userMessage,
        mode,
        hermeticPrinciple,
        difficulty: 'intermediate',
      });

      const tutorMsg: Message = {
        role: 'tutor',
        content: response.content,
        timestamp: new Date().toISOString(),
        hermeticConnection: response.hermeticConnection,
        followUpQuestions: response.followUpQuestions,
      };
      setMessages(prev => [...prev, tutorMsg]);
    } catch (err) {
      const fallbackMsg: Message = {
        role: 'tutor',
        content: isAvailable
          ? 'I encountered an issue connecting to the tutor. Please try again.'
          : 'The AI tutor requires Ollama to be running locally. Start Ollama and try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, topic, mode, hermeticPrinciple, isAvailable]);

  const handleFollowUp = useCallback((question: string) => {
    setInput(question);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const principleColor = hermeticPrinciple != null ? PRINCIPLE_COLORS[hermeticPrinciple] : '#00D4FF';
  const currentModeConfig = MODE_CONFIG[mode];

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Mode Selector + Connection Status */}
      <div className="px-3 py-2 border-b border-[#1A3A5C] flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {showModePicker ? (
            Object.entries(MODE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setMode(key as TutorMode); setShowModePicker(false); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  mode === key ? 'bg-white/10 text-white' : 'text-[#5A7A9A] hover:text-[#8BA4BE]'
                }`}
                style={mode === key ? { borderBottom: `2px solid ${cfg.color}` } : {}}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))
          ) : (
            <button
              onClick={() => setShowModePicker(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
              style={{ backgroundColor: `${currentModeConfig.color}20`, border: `1px solid ${currentModeConfig.color}40`, color: currentModeConfig.color }}
            >
              {currentModeConfig.icon} {currentModeConfig.label}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          {isAvailable ? (
            <Wifi size={12} className="text-[#39FF14]" />
          ) : (
            <WifiOff size={12} className="text-[#F43F5E]" />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot size={40} className="text-[#5A7A9A] mb-3" />
            <h3 className="text-white font-semibold mb-1">LifeOS Academy Sage</h3>
            <p className="text-[#8BA4BE] text-sm mb-4">{currentModeConfig.description}</p>
            {hermeticPrinciple != null && (
              <span className="px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{ backgroundColor: `${principleColor}15`, color: principleColor, border: `1px solid ${principleColor}30` }}>
                {PRINCIPLE_NAMES[hermeticPrinciple]}
              </span>
            )}
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'tutor' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
                <Bot size={14} className="text-[#00D4FF]" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-lg p-3 ${
              msg.role === 'user'
                ? 'bg-[#00D4FF]/15 text-white'
                : 'bg-[#0F2D4A] text-[#8BA4BE]'
            }`}>
              <div className="text-sm whitespace-pre-line">{msg.content}</div>
              {msg.hermeticConnection && (
                <div className="mt-2 p-2 rounded bg-[#A855F7]/10 border border-[#A855F7]/20">
                  <div className="text-xs font-medium" style={{ color: PRINCIPLE_COLORS[msg.hermeticConnection.principle] }}>
                    {msg.hermeticConnection.principleName}
                  </div>
                  <div className="text-xs text-[#8BA4BE]">{msg.hermeticConnection.insight}</div>
                </div>
              )}
              {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.followUpQuestions.map((q, qi) => (
                    <button
                      key={qi}
                      onClick={() => handleFollowUp(q)}
                      className="block w-full text-left text-xs px-2 py-1.5 rounded bg-[#1A3A5C] text-[#8BA4BE] hover:text-white transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                <User size={14} className="text-[#39FF14]" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
              <Bot size={14} className="text-[#00D4FF]" />
            </div>
            <div className="bg-[#0F2D4A] rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-[#5A7A9A]">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A7A9A] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A7A9A] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5A7A9A] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-[#1A3A5C]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={topic ? `Ask about ${topic}...` : 'What would you like to learn?'}
            className="flex-1 px-3 py-2 rounded-lg bg-[#0F2D4A] border border-[#1A3A5C] text-white placeholder:text-[#5A7A9A] text-sm focus:border-[#00D4FF]/50 focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && messages.length > 0)}
            className="p-2 rounded-lg bg-[#00D4FF] text-[#050E1A] hover:bg-[#00D4FF]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TutorChat;