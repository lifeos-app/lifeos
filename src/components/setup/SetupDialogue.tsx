/**
 * SetupDialogue — Full-page immersive NPC dialogue for Life Setup phases.
 *
 * Inspired by the Realm onboarding SageDialogue, but integrated with
 * the PhaseConfig data model for Health, Finance, and Life Foundation.
 *
 * Features:
 * - Typewriter effect for NPC messages
 * - NPC portrait with themed border
 * - Dark atmospheric canvas background
 * - LLM-powered conversation with data extraction
 * - Coverage tracking with progress dots
 * - Cross-phase context injection
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { type PhaseConfig, type PhaseId, calculatePhaseCoverage } from '../../lib/onboarding-phases';
import { callLLMProxy } from '../../lib/llm-proxy';
import { assetPath } from '../../utils/assets';
import { genId } from '../../utils/date';
import { logger } from '../../utils/logger';
import { StageCanvas, type ParticleThemeConfig } from '../stage/StageCanvas';
import { NPC_APPEARANCES } from '../stage/npc-appearances';
import type { StageCharacter } from '../stage/types';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import '../../styles/setup-dialogue.css';

// ── Types ────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'npc' | 'user';
  text: string;
}

type SetupPhaseTheme = 'sage' | 'warrior' | 'merchant';

interface NPCConfig {
  name: string;
  portrait: string;
  theme: SetupPhaseTheme;
  accentColor: string;
  thinkingLabel: string;
  greeting: string;
  background: string;
}

// Particle theme configs for each NPC
const THEME_PARTICLE_CONFIGS: Record<SetupPhaseTheme, ParticleThemeConfig> = {
  sage: {
    colors: ['#00D4FF', '#0088CC', '#66E0FF', '#004466'],
    speed: 0.25,
    life: 200,
    size: 2,
    type: 'glow',
    gravity: -0.003,
    rate: 0.15,
  },
  warrior: {
    colors: ['#39FF14', '#2ECC71', '#27AE60', '#1ABC9C'],
    speed: 0.4,
    life: 150,
    size: 2,
    type: 'dot',
    gravity: -0.008,
    rate: 0.2,
  },
  merchant: {
    colors: ['#FFD93D', '#F0C040', '#DAA520', '#FFB700'],
    speed: 0.3,
    life: 180,
    size: 2,
    type: 'glow',
    gravity: 0,
    rate: 0.18,
  },
};

// ── NPC configurations ───────────────────────────

const NPC_CONFIGS: Record<PhaseId, NPCConfig> = {
  life: {
    name: 'The Sage',
    portrait: '/images/npcs/sage.png',
    theme: 'sage',
    accentColor: '#00D4FF',
    thinkingLabel: 'The Sage ponders',
    greeting: 'Ah, a seeker of truth arrives. I am the Sage, keeper of wisdom in this realm. Let us explore the foundations of your life — your values, your purpose, the dreams that drive you forward. Tell me... what is your name, traveller?',
    background: 'radial-gradient(ellipse at center, #0A1628 0%, #050E1A 50%, #000 100%)',
  },
  health: {
    name: 'The Warrior',
    portrait: '/images/npcs/warrior.png',
    theme: 'warrior',
    accentColor: '#39FF14',
    thinkingLabel: 'The Warrior considers',
    greeting: 'Hail, adventurer. I am the Warrior — forged in discipline, tempered by endurance. The body is the vessel that carries your spirit through every battle. Let us assess your strength, your habits, and your readiness. How would you describe your current fitness level?',
    background: 'radial-gradient(ellipse at center, #0A1A0D 0%, #050E1A 50%, #000 100%)',
  },
  finance: {
    name: 'The Merchant',
    portrait: '/images/npcs/merchant.png',
    theme: 'merchant',
    accentColor: '#FFD93D',
    thinkingLabel: 'The Merchant calculates',
    greeting: 'Welcome to the counting house. I am the Merchant — master of ledgers, reader of markets, keeper of coin. Gold flows like water, and I shall teach you to channel it wisely. Tell me, what do you do for work?',
    background: 'radial-gradient(ellipse at center, #1A1500 0%, #050E1A 50%, #000 100%)',
  },
};

// ── Props ────────────────────────────────────────

interface SetupDialogueProps {
  phase: PhaseConfig;
  onComplete: (data: Record<string, any>) => void;
  initialData?: Record<string, any>;
}

// ── Component ────────────────────────────────────

export function SetupDialogue({ phase, onComplete, initialData }: SetupDialogueProps) {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const npc = NPC_CONFIGS[phase.id];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [data, setData] = useState<Record<string, any>>(() => {
    const empty = phase.emptyData();
    if (initialData) return phase.mergeData(empty, initialData);
    return empty;
  });
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [coverageMap, setCoverageMap] = useState<Record<string, boolean>>({});
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildPhase, setBuildPhase] = useState('');
  const [llmHistory, setLlmHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const productInsightsRef = useRef<string[]>([]);

  // Typewriter state
  const [typewriterText, setTypewriterText] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const typewriterIdxRef = useRef(-1);

  // Stage character state: NPC + player speech bubbles
  const [npcBubbleText, setNpcBubbleText] = useState('');
  const [playerBubbleText, setPlayerBubbleText] = useState('');
  const playerBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  // ── Initialize with greeting ──

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([{ id: 'greeting', role: 'npc', text: npc.greeting }]);

    // Load cross-phase context
    if (user?.id) loadCrossPhaseContext();
  }, []);

  // ── Cross-phase context ──

  const loadCrossPhaseContext = async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('preferences,display_name').eq('user_id', user.id).single();
      const prefs = (profile?.preferences || {}) as Record<string, any>;

      if (phase.id === 'health' || phase.id === 'finance') {
        const lifeData = prefs.ai_chat_data || {};
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

  // ── Coverage calculation ──

  useEffect(() => {
    const { coverage, percent } = calculatePhaseCoverage(phase.id, data);
    setCoverageMap(coverage);
    setCoveragePercent(percent);
    if (percent >= 75) setReadyToFinalize(true);
  }, [data, phase.id]);

  // ── Stage characters for StageCanvas ──

  const charAppearance = useCharacterAppearanceStore();

  const stageCharacters = useMemo((): StageCharacter[] => {
    const npcAppearance = NPC_APPEARANCES[npc.theme] || NPC_APPEARANCES.sage;
    const chars: StageCharacter[] = [
      {
        id: npc.theme, // 'sage' | 'warrior' | 'merchant'
        cx: 0.33,
        cy: 0.65,
        appearance: npcAppearance,
        direction: 'right',
        isMoving: false,
        walkFrame: 0,
        mood: 4,
        visible: true,
        alpha: 1,
        bubble: npcBubbleText ? {
          text: npcBubbleText,
          startTime: 0,
          duration: Infinity,
        } : undefined,
      },
    ];

    // Add player character if appearance store is loaded
    if (charAppearance.loaded) {
      chars.push({
        id: 'player',
        cx: 0.67,
        cy: 0.65,
        appearance: {
          skinTone: charAppearance.skinTone,
          hairColor: charAppearance.hairColor,
          bodyColor: charAppearance.bodyColor,
          classIcon: charAppearance.classIcon,
          name: charAppearance.name,
          level: charAppearance.level,
        },
        direction: 'left',
        isMoving: false,
        walkFrame: 0,
        mood: 4,
        visible: true,
        alpha: 1,
        bubble: playerBubbleText ? {
          text: playerBubbleText,
          startTime: 0,
          duration: Infinity,
        } : undefined,
      });
    }

    return chars;
  }, [npc.theme, charAppearance, npcBubbleText, playerBubbleText]);

  const particleTheme = useMemo(() => THEME_PARTICLE_CONFIGS[npc.theme], [npc.theme]);

  // ── Typewriter effect ──

  const lastNpcIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'npc') return i;
    }
    return -1;
  }, [messages]);

  useEffect(() => {
    if (lastNpcIdx < 0) return;
    if (typewriterIdxRef.current === lastNpcIdx) return;
    typewriterIdxRef.current = lastNpcIdx;

    const fullText = messages[lastNpcIdx].text;
    let charIdx = 0;
    setTypewriterText('');
    setTypewriterDone(false);

    const timer = setInterval(() => {
      charIdx++;
      if (charIdx >= fullText.length) {
        setTypewriterText(fullText);
        setTypewriterDone(true);
        clearInterval(timer);
        // Update NPC bubble with finished text
        setNpcBubbleText(fullText.slice(0, 140));
        // Focus input after typing completes
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setTypewriterText(fullText.slice(0, charIdx));
      }
    }, 25);

    return () => clearInterval(timer);
  }, [lastNpcIdx, messages]);

  // ── Auto-scroll ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typewriterText, isThinking]);

  // ── Save progress ──

  const saveProgress = useCallback(async (latestData: Record<string, any>, latestPercent: number) => {
    if (!user?.id) return;
    try {
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const currentPrefs = (currentProfile?.preferences || {}) as Record<string, any>;

      const cleanData = { ...latestData };
      delete cleanData._lifeFoundation;
      delete cleanData._healthProfile;
      delete cleanData._existingMetrics;
      delete cleanData._existingWorkouts;
      delete cleanData._existingTransactions;
      delete cleanData._existingBills;

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        preferences: {
          ...currentPrefs,
          [phase.prefsKey]: cleanData,
          [phase.percentKey]: latestPercent,
        },
      }, { onConflict: 'user_id' });
    } catch (err) {
      logger.error('Save progress error:', err);
    }
  }, [user?.id, phase.prefsKey, phase.percentKey]);

  // ── Send message ──

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || inputValue).trim();
    if (!msg || isThinking) return;
    setInputValue('');

    // Show player bubble on stage (3s)
    setPlayerBubbleText(msg.slice(0, 140));
    if (playerBubbleTimerRef.current) clearTimeout(playerBubbleTimerRef.current);
    playerBubbleTimerRef.current = setTimeout(() => setPlayerBubbleText(''), 3000);

    const userMsg: ChatMessage = { id: genId(), role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setNpcBubbleText('...'); // NPC thinking bubble

    const newHistory = [...llmHistory, { role: 'user' as const, content: msg }];

    try {
      const { coverage } = calculatePhaseCoverage(phase.id, data);
      const systemPrompt = phase.buildSystemPrompt(data, coverage);

      // Wrap system prompt with NPC personality
      const npcSystemPrompt = `${systemPrompt}\n\n## PERSONALITY\nYou are ${npc.name}, speaking in the voice of a wise ${phase.id === 'life' ? 'sage and philosopher' : phase.id === 'health' ? 'warrior and combat trainer' : 'merchant and financial strategist'} in an RPG realm. Keep the fantasy flavor but stay substantive and practical. Address the user directly. Be warm but not sycophantic.`;

      const proxyMessages = [
        { role: 'system', content: npcSystemPrompt },
        ...newHistory.map(h => ({
          role: h.role === 'model' ? 'assistant' : h.role,
          content: h.content,
        })),
      ];

      const llmResponse = await callLLMProxy(proxyMessages, {
        timeoutMs: 30000,
        format: 'json',
        provider: 'openrouter',
        model: 'google/gemini-2.0-flash-001',
      });

      let parsed: any;
      try {
        let jsonStr = llmResponse.content.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('Failed to parse LLM response');
      }

      const extracted = parsed.extracted || {};
      const merged = phase.mergeData(data, extracted);
      setData(merged);

      if (parsed.productInsights?.length) {
        productInsightsRef.current = [...new Set([...productInsightsRef.current, ...parsed.productInsights])];
      }

      const { percent } = calculatePhaseCoverage(phase.id, merged);

      setNpcBubbleText(''); // Clear thinking bubble; typewriter will set final text
      const npcMsg: ChatMessage = {
        id: genId(),
        role: 'npc',
        text: parsed.reply || 'Tell me more, adventurer...',
      };
      setMessages(prev => [...prev, npcMsg]);

      const updatedHistory = [...newHistory, { role: 'model' as const, content: parsed.reply || '' }];
      setLlmHistory(updatedHistory);

      saveProgress(merged, percent);
    } catch (err) {
      logger.error('Setup dialogue error:', err);
      const errMsg: ChatMessage = {
        id: genId(),
        role: 'npc',
        text: 'The arcane channels flicker... Could you say that once more, adventurer?',
      };
      setMessages(prev => [...prev, errMsg]);
    }

    setIsThinking(false);
  }, [inputValue, isThinking, llmHistory, data, phase, npc, saveProgress]);

  // ── Key handler ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Finalize ──

  const handleFinalize = useCallback(async () => {
    setIsBuilding(true);
    setBuildPhase(`${npc.name} forges your destiny...`);

    try {
      await new Promise(r => setTimeout(r, 1500));
      setBuildPhase('The Realm takes shape...');
      await new Promise(r => setTimeout(r, 1000));

      const cleanData = { ...data };
      delete cleanData._lifeFoundation;
      delete cleanData._healthProfile;
      delete cleanData._existingMetrics;
      delete cleanData._existingWorkouts;
      delete cleanData._existingTransactions;
      delete cleanData._existingBills;

      await saveProgress(cleanData, 100);
      onComplete(cleanData);
    } catch (err) {
      logger.error('Finalize error:', err);
      setIsBuilding(false);
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'npc',
        text: 'Something went wrong. Fear not — try again when you are ready.',
      }]);
    }
  }, [data, npc.name, saveProgress, onComplete]);

  // ── Skip / Exit ──

  const handleExit = useCallback(() => {
    navigate('/setup');
  }, [navigate]);

  // ── Building screen ──

  if (isBuilding) {
    return (
      <div className="setup-dialogue-container" style={{ background: npc.background }}>
        <div className="setup-dialogue-scene">
          <StageCanvas theme={particleTheme} characters={stageCharacters} intensity={2} className="setup-dialogue-canvas" />
        </div>
        <div className="setup-dialogue-building">
          <img
            src={assetPath(npc.portrait)}
            alt={npc.name}
            className="setup-dialogue-building-portrait"
            style={{ borderColor: `${npc.accentColor}40` }}
          />
          <h2 className="setup-dialogue-building-title">
            {npc.name} forges your path
          </h2>
          <p className="setup-dialogue-building-subtitle">{buildPhase}</p>
          <div className="setup-dialogue-building-bar">
            <div
              className="setup-dialogue-building-bar-fill"
              style={{ background: `linear-gradient(90deg, ${npc.accentColor}, #00D4FF)` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main dialogue ──

  const coverageFields = phase.coverageFields;

  return (
    <div className="setup-dialogue-container" style={{ background: npc.background }}>
      {/* Top bar: back + progress */}
      <div className="setup-dialogue-topbar">
        <button onClick={handleExit} className="setup-dialogue-exit-btn">
          Complete Later
        </button>
        <div className="setup-dialogue-progress-dots">
          {coverageFields.map(f => (
            <div
              key={f.key}
              className={`setup-dialogue-dot ${coverageMap[f.key] ? 'setup-dialogue-dot--done' : ''}`}
              style={{
                borderColor: coverageMap[f.key] ? npc.accentColor : `${npc.accentColor}40`,
                background: coverageMap[f.key] ? npc.accentColor : 'transparent',
              }}
              title={f.label}
            />
          ))}
        </div>
        <span className="setup-dialogue-percent" style={{ color: npc.accentColor }}>
          {coveragePercent}%
        </span>
      </div>

      {/* Scene area with canvas + NPC portrait */}
      <div className="setup-dialogue-scene">
        <StageCanvas theme={particleTheme} characters={stageCharacters} className="setup-dialogue-canvas" />
        <img
          src={assetPath(npc.portrait)}
          alt={npc.name}
          className="setup-dialogue-npc-portrait"
          style={{ borderColor: `${npc.accentColor}30` }}
        />
        <div className="setup-dialogue-npc-name" style={{ color: npc.accentColor }}>
          {npc.name}
        </div>
      </div>

      {/* Dialogue area */}
      <div className="setup-dialogue-area">
        <div className="setup-dialogue-messages">
          {messages.map((msg, i) => {
            const isNpc = msg.role === 'npc';
            const isLatestNpc = i === lastNpcIdx;
            const displayText = isLatestNpc && !typewriterDone ? typewriterText : msg.text;

            return (
              <div
                key={msg.id}
                className={`setup-dialogue-message setup-dialogue-message--${isNpc ? 'npc' : 'user'}`}
              >
                {isNpc && (
                  <img
                    src={assetPath(npc.portrait)}
                    alt={npc.name}
                    className="setup-dialogue-msg-portrait"
                    style={{ borderColor: `${npc.accentColor}30` }}
                  />
                )}
                <div className="setup-dialogue-msg-text">
                  {displayText}
                  {isLatestNpc && !typewriterDone && (
                    <span className="setup-dialogue-cursor">▊</span>
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="setup-dialogue-thinking">
              {npc.thinkingLabel}
              <span className="setup-dialogue-thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          )}

          {/* Finalize prompt */}
          {readyToFinalize && !isThinking && typewriterDone && (
            <div className="setup-dialogue-finalize" style={{ borderColor: `${npc.accentColor}20` }}>
              <p className="setup-dialogue-finalize-text" style={{ color: npc.accentColor }}>
                {npc.name} nods approvingly. "I have all I need to forge your path. Shall we begin?"
              </p>
              <div className="setup-dialogue-finalize-buttons">
                <button
                  onClick={handleFinalize}
                  className="setup-dialogue-finalize-btn"
                  style={{ background: `linear-gradient(135deg, ${npc.accentColor}, ${npc.accentColor}88)` }}
                >
                  Forge my path
                </button>
                <button
                  onClick={() => {
                    setReadyToFinalize(false);
                    setMessages(prev => [...prev, {
                      id: genId(),
                      role: 'npc',
                      text: 'Very well — there is always more to discuss. What else would you share with me?',
                    }]);
                  }}
                  className="setup-dialogue-keep-btn"
                >
                  Keep talking
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="setup-dialogue-input-area">
          <div className="setup-dialogue-input-row">
            <input
              ref={inputRef}
              className="setup-dialogue-input"
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Speak to ${npc.name}...`}
              disabled={isThinking}
              style={{ borderColor: `${npc.accentColor}40` }}
            />
            <button
              className="setup-dialogue-send-btn"
              onClick={() => handleSend()}
              disabled={isThinking || !inputValue.trim()}
              style={{ background: inputValue.trim() ? npc.accentColor : undefined }}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
