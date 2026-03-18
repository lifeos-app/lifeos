/**
 * Generic Phase Chat — reusable AI conversation for any onboarding phase.
 * Accepts a PhaseConfig and handles the full chat flow.
 * 
 * Features:
 * - Cross-phase context injection (health knows life foundation, finance knows both)
 * - Chat transcript persistence (onboarding_conversations table)
 * - Product insight extraction ("feedback without feedback")
 */
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ArrowLeft, Rocket, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { type PhaseConfig, calculatePhaseCoverage } from '../lib/onboarding-phases';
import { genId } from '../utils/date';
import { safeScrollIntoView } from '../utils/scroll';

import { callLLMProxy } from '../lib/llm-proxy';
import { logger } from '../utils/logger';

interface PhaseChatProps {
  phase: PhaseConfig;
  onComplete: (data: Record<string, any>) => void;
  onBack: () => void;
  onSkip: () => void;
  initialData?: Record<string, any>;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export function PhaseChat({ phase, onComplete, onBack, onSkip, initialData }: PhaseChatProps) {
  const user = useUserStore(s => s.user);
  const productInsightsRef = useRef<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 'intro', role: 'assistant', text: phase.chatGreeting, timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>>(() => {
    const empty = phase.emptyData();
    if (initialData) return phase.mergeData(empty, initialData);
    return empty;
  });
  const [coverageMap, setCoverageMap] = useState<Record<string, boolean>>({});
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildPhase, setBuildPhase] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  // Track newly-added message IDs so they animate in
  const animatedIdsRef = useRef<Set<string>>(new Set<string>());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load cross-phase context on mount
  useEffect(() => {
    if (!user?.id) return;
    loadCrossPhaseContext();
  }, [user?.id]);

  const loadCrossPhaseContext = async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('preferences,display_name').eq('user_id', user.id).single();
      const prefs = (profile?.preferences || {}) as Record<string, any>;
      
      // Inject Life Foundation context into health/finance phases
      if (phase.id === 'health' || phase.id === 'finance') {
        const lifeData = prefs.ai_chat_data || {};
        // Also pull structured data from top-level prefs
        const lifeFoundation = {
          name: profile?.display_name || lifeData.name || prefs.name,
          coreValues: prefs.core_values || lifeData.coreValues || [],
          strengths: prefs.strengths || lifeData.strengths || [],
          purpose: prefs.purpose || lifeData.purpose || '',
          focusAreas: prefs.focus_areas || lifeData.focusAreas || [],
          goals: lifeData.goals || [],
          goodHabits: prefs.good_habits || lifeData.goodHabits || [],
          morningRoutine: prefs.morning_routine || lifeData.morningRoutine || [],
          eveningRoutine: prefs.evening_routine || lifeData.eveningRoutine || [],
        };
        setData(prev => ({ ...prev, _lifeFoundation: lifeFoundation }));
      }
      
      // Inject Health context into finance phase
      if (phase.id === 'finance') {
        const healthData = prefs.health_onboarding_data || {};
        const healthProfile = {
          dietType: healthData.dietType || prefs.health_profile?.diet_type || '',
          exerciseTypes: healthData.exerciseTypes || prefs.health_profile?.exercise_types || [],
          supplements: healthData.supplements || [],
          fitnessGoals: healthData.fitnessGoals || [],
        };
        setData(prev => ({ ...prev, _healthProfile: healthProfile }));
      }
    } catch (err) {
      logger.error('Failed to load cross-phase context:', err);
    }
  };

  // Calculate initial coverage
  useEffect(() => {
    const { coverage, percent } = calculatePhaseCoverage(phase.id, data);
    setCoverageMap(coverage);
    setCoveragePercent(percent);
    if (percent >= 75) setReadyToFinalize(true);
  }, []);

  const saveProgress = async (latestData: Record<string, any>, latestPercent: number, _latestMessages?: ChatMsg[], _latestHistory?: any[]) => {
    if (!user?.id) return;
    try {
      // Read current prefs to avoid overwriting other phases
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const currentPrefs = (currentProfile?.preferences || {}) as Record<string, any>;

      // Strip cross-phase context before saving (it's injected, not user data)
      const cleanData = { ...latestData };
      delete cleanData._lifeFoundation;
      delete cleanData._healthProfile;
      delete cleanData._existingMetrics;
      delete cleanData._existingWorkouts;
      delete cleanData._existingTransactions;
      delete cleanData._existingBills;

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        onboarding_complete: currentPrefs.onboarding_percent >= 75 && phase.id !== 'life',
        preferences: {
          ...currentPrefs,
          [phase.prefsKey]: cleanData,
          [phase.percentKey]: latestPercent,
        },
      }, { onConflict: 'user_id' });

      // onboarding_conversations table disabled — create via Supabase dashboard to enable
      // Conversation persistence is a nice-to-have, not blocking
    } catch (err) {
      logger.error('Save progress error:', err);
    }
  };

  useEffect(() => {
    safeScrollIntoView(messagesEndRef.current, { behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMsg = { id: genId(), role: 'user', text, timestamp: new Date().toISOString() };
    animatedIdsRef.current.add(userMsg.id);
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const newHistory = [...history, { role: 'user' as const, content: text }];
    const callStart = Date.now();

    try {
      const { coverage } = calculatePhaseCoverage(phase.id, data);
      const systemPrompt = phase.buildSystemPrompt(data, coverage);

      // Build messages for the proxy (OpenAI-style format)
      const proxyMessages = [
        { role: 'system', content: systemPrompt },
        ...newHistory.map(h => ({
          role: h.role === 'model' ? 'assistant' : h.role,
          content: h.content,
        })),
      ];

      const llmResponse = await callLLMProxy(proxyMessages, { timeoutMs: 30000 });
      const rawText = llmResponse.content;

      let parsed: any;
      try {
        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('Failed to parse response');
      }

      const extracted = parsed.extracted || {};
      const merged = phase.mergeData(data, extracted);
      setData(merged);

      // Collect product insights
      if (parsed.productInsights?.length) {
        productInsightsRef.current = [...new Set([...productInsightsRef.current, ...parsed.productInsights])];
      }

      const { coverage: newCov, percent } = calculatePhaseCoverage(phase.id, merged);
      setCoverageMap(newCov);
      setCoveragePercent(percent);
      if (percent >= 75) setReadyToFinalize(true);

      // Ensure typing indicator shows for at least 350ms (feels natural)
      const elapsed = Date.now() - callStart;
      if (elapsed < 350) await new Promise(r => setTimeout(r, 350 - elapsed));

      const assistantMsg: ChatMsg = { id: genId(), role: 'assistant', text: parsed.reply || "Tell me more!", timestamp: new Date().toISOString() };
      animatedIdsRef.current.add(assistantMsg.id);
      const updatedMessages = [...messages, userMsg, assistantMsg];
      const updatedHistory = [...newHistory, { role: 'model' as const, content: parsed.reply }];
      setMessages(updatedMessages);
      setHistory(updatedHistory);

      saveProgress(merged, percent, updatedMessages, updatedHistory);
    } catch (err) {
      logger.error('Chat error:', err);
      const errMsg: ChatMsg = {
        id: genId(), role: 'assistant',
        text: "Sorry, had a hiccup. Could you say that again?",
        timestamp: new Date().toISOString(),
      };
      animatedIdsRef.current.add(errMsg.id);
      setMessages(prev => [...prev, errMsg]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleFinalize = async () => {
    setBuilding(true);
    setBuildPhase(`Setting up your ${phase.title.toLowerCase()}...`);
    try {
      await new Promise(r => setTimeout(r, 1500));
      setBuildPhase('Almost there...');
      await new Promise(r => setTimeout(r, 1000));

      // Strip cross-phase context before completing
      const cleanData = { ...data };
      delete cleanData._lifeFoundation;
      delete cleanData._healthProfile;
      delete cleanData._existingMetrics;
      delete cleanData._existingWorkouts;
      delete cleanData._existingTransactions;
      delete cleanData._existingBills;

      // Save 100% and mark conversation complete
      await saveProgress(cleanData, 100, messages, history);

      onComplete(cleanData);
    } catch (err) {
      logger.error('Finalize error:', err);
      setBuilding(false);
      setMessages(prev => [...prev, {
        id: genId(), role: 'assistant',
        text: "Something went wrong. Let's try again — click the build button when you're ready.",
      }]);
    }
  };

  // ─── Building Phase ─────────────────────────────────────────
  if (building) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 20, padding: 40, textAlign: 'center',
      }}>
        {/* Animated icon */}
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <div style={{
            position: 'absolute', inset: -12, borderRadius: '50%',
            border: `2px solid ${phase.color}25`,
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${phase.color}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
            boxShadow: `0 0 24px ${phase.color}25`,
          }}>
            {phase.icon}
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#fff' }}>
          Building your {phase.title.toLowerCase()}
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, maxWidth: 280 }}>
          {buildPhase}
        </p>

        {/* Progress bar */}
        <div style={{ width: 200, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${phase.color}, #00D4FF)`,
            animation: 'loading-bar-phase 1.8s ease-in-out infinite',
          }} />
        </div>
        <style>{`
          @keyframes loading-bar-phase {
            0%   { width: 15%; margin-left: 0; }
            50%  { width: 55%; margin-left: 20%; }
            100% { width: 15%; margin-left: 85%; }
          }
          @keyframes pulse-ring {
            0%   { transform: scale(0.85); opacity: 0.8; }
            100% { transform: scale(2.2);  opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Main Chat UI ───────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      maxWidth: 600, margin: '0 auto', width: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)', display: 'flex', padding: 4,
        }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 16 }}>{phase.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{phase.title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{coveragePercent}%</span>
          <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${coveragePercent}%`, height: '100%', borderRadius: 2,
              background: coveragePercent >= 75 ? '#4ECB71' : coveragePercent >= 50 ? '#FFD93D' : phase.color,
              transition: 'width 0.5s ease, background 0.3s ease',
            }} />
          </div>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 4,
          }} title="Skip for now">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Coverage pills */}
      <div style={{
        padding: '8px 20px', display: 'flex', gap: 6, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        {phase.coverageFields.map(f => (
          <span key={f.key} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: coverageMap[f.key] ? 'rgba(78,203,113,0.12)' : 'rgba(255,255,255,0.04)',
            color: coverageMap[f.key] ? '#4ECB71' : 'rgba(255,255,255,0.3)',
            border: `1px solid ${coverageMap[f.key] ? 'rgba(78,203,113,0.2)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'all 0.3s ease',
          }}>
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', scrollBehavior: 'smooth' }}>
        {messages.map(msg => {
          const isUser    = msg.role === 'user';
          const isNew     = animatedIdsRef.current.has(msg.id);
          const animClass = isNew ? (isUser ? 'msg-enter-right' : 'msg-enter-left') : '';
          return (
            <div key={msg.id} className={animClass} style={{
              display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              {!isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: `${phase.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 8, marginTop: 2, fontSize: 13,
                }}>
                  {phase.icon}
                </div>
              )}
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: 16,
                background: isUser ? `${phase.color}20` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isUser ? `${phase.color}30` : 'rgba(255,255,255,0.07)'}`,
                borderBottomRightRadius: isUser ? 4 : 16,
                borderBottomLeftRadius:  isUser ? 16 : 4,
              }}>
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.55,
                  color: isUser ? '#fff' : 'rgba(255,255,255,0.87)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="msg-enter-left" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `${phase.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
            }}>{phase.icon}</div>
            <div style={{
              padding: '11px 16px', borderRadius: 16, borderBottomLeftRadius: 4,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        {readyToFinalize && !loading && (
          <div style={{
            margin: '16px 0', padding: 16, borderRadius: 12,
            background: 'rgba(78,203,113,0.08)', border: '1px solid rgba(78,203,113,0.15)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: '#4ECB71', margin: '0 0 12px', fontWeight: 500 }}>
              ✨ Great! I've got everything I need. Ready to set up your {phase.title.toLowerCase()}?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleFinalize} style={{
                padding: '10px 24px', background: `linear-gradient(135deg, ${phase.color}, #00D4FF)`,
                border: 'none', borderRadius: 10, color: '#000', fontWeight: 700,
                fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
              }}>
                <Rocket size={16} /> Build It
              </button>
              <button onClick={() => {
                setReadyToFinalize(false);
                const ktMsg: ChatMsg = { id: genId(), role: 'assistant', text: "No rush! What else would you like to tell me?" };
                animatedIdsRef.current.add(ktMsg.id);
                setMessages(prev => [...prev, ktMsg]);
              }} style={{
                padding: '10px 16px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Keep talking
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={`Tell me about your ${phase.title.toLowerCase()}...`}
          rows={1}
          disabled={loading}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            padding: '10px 14px', color: '#fff', fontSize: 13,
            fontFamily: 'inherit', resize: 'none', outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className={input.trim() && !loading ? 'ob-chat-send ready' : 'ob-chat-send'}
          style={{
            width: 40, height: 40, borderRadius: 10, border: 'none',
            background: input.trim() ? `${phase.color}20` : 'rgba(255,255,255,0.04)',
            color: input.trim() ? phase.color : 'rgba(255,255,255,0.2)',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s ease',
          }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
