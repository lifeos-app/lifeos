/**
 * useOnboardingQuest — Custom hook for OnboardingQuest state management
 *
 * Encapsulates all scene progression, dialogue handling, LLM/template fallback,
 * progress persistence, character creation, and data seeding logic.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  askSage,
  type OnboardingScene,
  type ExtractedOnboardingData,
  type ConversationMessage,
} from './OnboardingLLM';
import {
  SAGE_OPENING_LINES,
  getTemplateSageReply,
  getDefaultExtractionData,
  getFallbackInputConfig,
} from './templateFallback';
import { createCharacter } from '../../rpg/engine/CharacterManager';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { awardXP } from '../../lib/gamification';
import { getClassInfo } from '../../rpg/data/classes';
import { SKIN_TONES, HAIR_COLORS } from '../../rpg/data/sprites';
import { INDUSTRIES } from '../../rpg/data/industries';
import { genId, localDateStr } from '../../utils/date';
import type { CharacterClass } from '../../rpg/engine/types';
import type { RealmCharacterData } from '../RealmEngine';
import { logger } from '../../utils/logger';

// ── Constants ────────────────────────────────────

export const SCENES: OnboardingScene[] = ['awakening', 'path_selection', 'identity', 'first_seed', 'the_dream', 'first_words', 'reveal'];
export const STORAGE_KEY = 'lifeos_onboarding_progress';

// Class-based identity colors
export const CLASS_PARTICLE_COLORS: Record<string, string[]> = {
  warrior: ['#e74c3c', '#ff6b6b', '#ff9999'],
  mage: ['#3498db', '#74b9ff', '#a29bfe'],
  ranger: ['#2ecc71', '#55efc4', '#00b894'],
  healer: ['#f1c40f', '#ffeaa7', '#fdcb6e'],
  engineer: ['#e67e22', '#fab1a0', '#ff7675'],
};

export interface SavedProgress {
  scene: OnboardingScene;
  extractedData: Partial<ExtractedOnboardingData>;
}

// ── Starter task generator ───────────────────────

interface StarterTask {
  title: string;
  priority: string;
}

function generateStarterTasks(goalTitle: string, motivation: string): StarterTask[] {
  const goalLower = goalTitle.toLowerCase();

  if (goalLower.match(/\b(run|5k|10k|marathon|jog)\b/)) {
    return [
      { title: 'Research a beginner running plan', priority: 'high' },
      { title: 'Get proper running shoes', priority: 'medium' },
      { title: 'Complete first training run (even 10 minutes counts)', priority: 'high' },
    ];
  }
  if (goalLower.match(/\b(read|book|learn|study|course)\b/)) {
    return [
      { title: 'Choose the first book or course to start with', priority: 'high' },
      { title: 'Set aside a dedicated 30-minute study block', priority: 'medium' },
      { title: 'Take notes on the first chapter or lesson', priority: 'medium' },
    ];
  }
  if (goalLower.match(/\b(weight|lose|diet|eat|nutrition)\b/)) {
    return [
      { title: 'Track what you eat for one full day', priority: 'high' },
      { title: 'Plan healthy meals for the week', priority: 'medium' },
      { title: 'Replace one unhealthy snack with a better option', priority: 'medium' },
    ];
  }
  if (goalLower.match(/\b(save|money|financ|budget|invest)\b/)) {
    return [
      { title: 'Review current income and expenses', priority: 'high' },
      { title: 'Set up a simple budget or savings tracker', priority: 'high' },
      { title: 'Identify one expense to cut or reduce', priority: 'medium' },
    ];
  }
  if (goalLower.match(/\b(build|app|website|project|code|create)\b/)) {
    return [
      { title: 'Write down the vision and core features', priority: 'high' },
      { title: 'Set up the project workspace/repo', priority: 'high' },
      { title: 'Build the smallest possible first version', priority: 'medium' },
    ];
  }
  if (goalLower.match(/\b(meditat|mindful|stress|peace|calm|mental)\b/)) {
    return [
      { title: 'Try a 5-minute guided meditation', priority: 'high' },
      { title: 'Identify your top 3 stress triggers', priority: 'medium' },
      { title: 'Practice one mindfulness exercise today', priority: 'medium' },
    ];
  }

  const motivationTasks: Record<string, StarterTask[]> = {
    fitness: [
      { title: `Research how to begin: "${goalTitle}"`, priority: 'high' },
      { title: 'Schedule the first workout or activity', priority: 'high' },
      { title: 'Set a measurable weekly target', priority: 'medium' },
    ],
    learning: [
      { title: `Find the best resources for: "${goalTitle}"`, priority: 'high' },
      { title: 'Block 30 minutes in your schedule for learning', priority: 'high' },
      { title: 'Write down what success looks like', priority: 'medium' },
    ],
    business: [
      { title: `Research the first step for: "${goalTitle}"`, priority: 'high' },
      { title: 'Identify one person who has achieved something similar', priority: 'medium' },
      { title: 'Create a 30-day action plan', priority: 'high' },
    ],
    wellness: [
      { title: `Start small: take the first step on "${goalTitle}"`, priority: 'high' },
      { title: 'Write down why this matters to you', priority: 'medium' },
      { title: 'Tell someone about your intention for accountability', priority: 'medium' },
    ],
    creative: [
      { title: `Brainstorm ideas for: "${goalTitle}"`, priority: 'high' },
      { title: 'Gather materials or tools you need', priority: 'medium' },
      { title: 'Create a rough first draft or prototype', priority: 'high' },
    ],
    balance: [
      { title: `Break down "${goalTitle}" into 3 smaller milestones`, priority: 'high' },
      { title: 'Schedule the first action step this week', priority: 'high' },
      { title: 'Define how you will measure progress', priority: 'medium' },
    ],
  };

  return motivationTasks[motivation] || motivationTasks.balance;
}

// ── Hook Props ──────────────────────────────────

export interface UseOnboardingQuestProps {
  userId: string;
  onComplete: (charData: RealmCharacterData) => void;
  onSkipLater?: () => void;
}

// ── Hook Return Type ─────────────────────────────

export interface UseOnboardingQuestReturn {
  // Scene state
  scene: OnboardingScene;
  sceneIndex: number;
  sceneTransition: boolean;

  // Dialogue state
  messages: ConversationMessage[];
  isThinking: boolean;

  // Extracted data
  extractedData: Partial<ExtractedOnboardingData>;

  // UI state
  showCharacterCreation: boolean;
  isCreatingData: boolean;
  createError: boolean;
  useFallback: boolean;
  laterConfirm: boolean;
  laterLoading: boolean;
  inputMode: 'text' | 'textarea' | 'none';
  creationAppearance: { skinTone: string; hairColor: string; bodyColor: string };
  characterPreview: { skinTone: string; hairColor: string; bodyColor: string; classIcon: string; name: string; level: number };
  showCharacter: boolean;
  playerAlpha: number;
  sageBubbleText: string;
  playerBubbleText: string;

  // Actions
  setLaterConfirm: (v: boolean) => void;
  handleSend: (text: string) => void;
  handleTypewriterComplete: () => void;
  handleCreationUpdate: (update: { skinTone?: string; hairColor?: string; bodyColor?: string }) => void;
  handleCreationConfirm: (result: { skinTone: string; hairColor: string; bodyColor: string; name: string }) => void;
  handleSkip: () => void;
  handleCompleteLater: () => void;
  createAllData: () => void;

  // Fallback config for SageDialogue placeholder
  fallbackConfig: ReturnType<typeof getFallbackInputConfig> | null;
}

// ── Hook ─────────────────────────────────────────

export function useOnboardingQuest({ userId, onComplete, onSkipLater }: UseOnboardingQuestProps): UseOnboardingQuestReturn {
  const [scene, setScene] = useState<OnboardingScene>('awakening');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [extractedData, setExtractedData] = useState<Partial<ExtractedOnboardingData>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [llmFailCount, setLlmFailCount] = useState(0);
  const [isCreatingData, setIsCreatingData] = useState(false);
  const [sceneTransition, setSceneTransition] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [laterConfirm, setLaterConfirm] = useState(false);
  const [laterLoading, setLaterLoading] = useState(false);
  const [sageBubbleText, setSageBubbleText] = useState('');
  const [playerBubbleText, setPlayerBubbleText] = useState('');

  const playerBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Character creation panel state
  const [showCharacterCreation, setShowCharacterCreation] = useState(false);
  const [creationAppearance, setCreationAppearance] = useState({
    skinTone: SKIN_TONES[2],
    hairColor: HAIR_COLORS[0],
    bodyColor: '#e74c3c',
  });
  const [playerAlpha, setPlayerAlpha] = useState(0);

  const initRef = useRef(false);
  const creatingRef = useRef(false);

  // Dialogue racing fix
  const typewriterDoneRef = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const sendingRef = useRef(false);

  const appearanceRef = useRef({
    skinTone: 2,
    hairStyle: 0,
    hairColor: 0,
    outfit: 0,
    accessory: 0,
  });

  // ── Advance scene ──

  const advanceScene = useCallback(() => {
    const idx = SCENES.indexOf(scene);
    if (idx < 0 || idx >= SCENES.length - 1) return;

    setSceneTransition(true);
    setTimeout(() => {
      setScene(SCENES[idx + 1]);
      setSceneTransition(false);
    }, 600);
  }, [scene]);

  // ── Typewriter completion callback ──

  const handleTypewriterComplete = useCallback(() => {
    typewriterDoneRef.current = true;

    if (messages.length > 0) {
      const lastSage = [...messages].reverse().find(m => m.role === 'sage');
      if (lastSage) {
        setSageBubbleText(lastSage.text.slice(0, 140));
      }
    }

    if (pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      setTimeout(advanceScene, 2000);
    }
  }, [advanceScene, messages]);

  // Reset typewriter/advance refs and bubbles when scene changes
  useEffect(() => {
    typewriterDoneRef.current = false;
    pendingAdvanceRef.current = false;
    sendingRef.current = false;
    setSageBubbleText('');
    setPlayerBubbleText('');
    setShowCharacterCreation(false);
    if (scene === 'reveal') setPlayerAlpha(1);
  }, [scene]);

  // ── Gated advance ──

  const gatedAdvance = useCallback(() => {
    if (typewriterDoneRef.current) {
      setTimeout(advanceScene, 2000);
    } else {
      pendingAdvanceRef.current = true;
    }
  }, [advanceScene]);

  // ── Restore / init ──

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const restoreProgress = (progress: SavedProgress) => {
      if (progress.scene && SCENES.includes(progress.scene)) {
        setScene(progress.scene);
        if (progress.extractedData) setExtractedData(progress.extractedData);
      }
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        restoreProgress(JSON.parse(saved));
        return;
      }
    } catch { /* ignore */ }

    if (userId) {
      supabase.from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle()
        .then(({ data: profile }) => {
          const prefs = (profile?.preferences || {}) as Record<string, any>;
          const serverProgress = prefs.realm_onboarding_progress as SavedProgress | undefined;
          if (serverProgress?.scene) {
            restoreProgress(serverProgress);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serverProgress)); } catch {}
          }
        })
        .catch(e => logger.warn('[onboarding] Supabase progress restore failed:', e));
    }
  }, [userId]);

  // ── Add opening line when scene changes ──

  useEffect(() => {
    if (scene === 'reveal') return;
    const opening = SAGE_OPENING_LINES[scene];
    if (opening) {
      setMessages([{ role: 'sage', text: opening }]);
    }
  }, [scene]);

  // ── Save progress (localStorage + Supabase) ──

  useEffect(() => {
    if (scene === 'reveal') return;
    const progress: SavedProgress = { scene, extractedData };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch { /* ignore */ }

    if (userId) {
      supabase.from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle()
        .then(({ data: profile }) => {
          const prefs = (profile?.preferences || {}) as Record<string, any>;
          supabase.from('user_profiles').update({
            preferences: { ...prefs, realm_onboarding_progress: progress },
          }).eq('user_id', userId).then(() => {});
        })
        .catch(e => logger.warn('[onboarding] Supabase progress save failed:', e));
    }
  }, [scene, extractedData, userId]);

  // ── Character preview ──

  const characterPreview = useMemo(() => {
    const cls = extractedData.characterClass || 'warrior';
    const classInfo = getClassInfo(cls);
    return {
      skinTone: creationAppearance.skinTone,
      hairColor: creationAppearance.hairColor,
      bodyColor: creationAppearance.bodyColor || classInfo.color,
      classIcon: classInfo.icon,
      name: extractedData.characterName || '???',
      level: 1,
    };
  }, [extractedData.characterClass, extractedData.characterName, creationAppearance]);

  const showCharacter = showCharacterCreation || (scene === 'identity' && !!extractedData.characterName) || scene === 'reveal';

  // ── Fallback config for input ──

  const inputMode = useMemo((): 'text' | 'textarea' | 'none' => {
    if (scene === 'reveal') return 'none';
    if (scene === 'path_selection') return 'none';
    if (scene === 'identity' && !extractedData.characterClass) return 'none';
    if (scene === 'identity' && showCharacterCreation) return 'none';
    if (scene === 'identity' && extractedData.characterClass) return 'none';
    if (scene === 'first_words') return 'textarea';
    if (useFallback) {
      const config = getFallbackInputConfig(scene, extractedData);
      if (config.type === 'pills' || config.type === 'cards') return 'none';
      if (config.type === 'textarea') return 'textarea';
      return 'text';
    }
    return 'text';
  }, [scene, useFallback, extractedData, showCharacterCreation]);

  const fallbackConfig = useFallback ? getFallbackInputConfig(scene, extractedData) : null;

  // ── Create all data (reveal scene) ──

  const createAllData = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreatingData(true);
    setCreateError(false);

    const data = { ...getDefaultExtractionData(), ...extractedData };
    const appearance = appearanceRef.current;

    const doCreate = async () => {
      // STEP 1: Mark onboarding complete FIRST
      const { data: curProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle();
      const curPrefs = (curProfile?.preferences || {}) as Record<string, any>;

      const { data: existingProfile } = await supabase
        .from('user_profiles').select('display_name').eq('user_id', userId).maybeSingle();
      const updatePayload: Record<string, unknown> = {
        onboarding_complete: true,
        preferences: { ...curPrefs, realm_tutorial_complete: true, realm_onboarding_progress: null },
      };
      if (!existingProfile?.display_name) {
        updatePayload.display_name = data.characterName || 'Adventurer';
      }
      await supabase.from('user_profiles').update(updatePayload).eq('user_id', userId);

      localStorage.removeItem(STORAGE_KEY);

      // STEP 2: Character creation (best-effort)
      let char: Awaited<ReturnType<typeof createCharacter>> = null;
      try {
        char = await createCharacter(userId, data.characterName, data.characterClass, appearance);
      } catch (e) { logger.warn('[Onboarding] Character creation failed:', e); }

      // Populate appearance store
      if (char) {
        const classInfo = getClassInfo(data.characterClass);
        useCharacterAppearanceStore.getState().set({
          skinTone: SKIN_TONES[appearance.skinTone],
          hairColor: HAIR_COLORS[appearance.hairColor],
          bodyColor: creationAppearance.bodyColor || classInfo.color,
          classIcon: classInfo.icon,
          name: data.characterName,
          level: char.level,
          characterClass: data.characterClass,
        });
      }

      // STEP 3: Write preferences (merge, never overwrite)
      try {
        const { data: freshProfile } = await supabase
          .from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle();
        const existingPrefs = (freshProfile?.preferences || {}) as Record<string, any>;
        await supabase.from('user_profiles').update({
          preferences: {
            ...existingPrefs,
            class: data.esbiClass,
            motivation: data.motivation,
            wakeDescription: data.wakeDescription,
          },
        }).eq('user_id', userId);
      } catch (e) { logger.warn('[Onboarding] Preference write failed:', e); }

      // STEP 4: Seed initial data
      const goalsStore = useGoalsStore.getState();
      const scheduleStore = useScheduleStore.getState();

      const motivationObjectives: Record<string, string> = {
        fitness: 'Build a healthier, stronger body',
        learning: 'Expand my knowledge and skills',
        business: 'Grow my career and income',
        wellness: 'Cultivate inner peace and balance',
        creative: 'Express my creativity and build things',
        balance: 'Create a balanced, intentional life',
      };
      const objectiveTitle = motivationObjectives[data.motivation] || motivationObjectives.balance;

      try {
        const objectiveId = await goalsStore.createGoal({
          title: objectiveTitle,
          description: `My guiding objective, born from the onboarding quest in the Realm.`,
          category: 'objective',
          status: 'active',
          source: 'onboarding_ai',
        });

        if (objectiveId) {
          const epicTitles: Record<string, string> = {
            growth: 'Growth & Learning Initiative',
            balance: 'Life Balance Initiative',
            health: 'Health & Wellness Initiative',
            career: 'Career Advancement Initiative',
            creativity: 'Creative Expression Initiative',
            spirituality: 'Spiritual Growth Initiative',
          };
          const epicTitle = epicTitles[data.motivation] || epicTitles.balance;

          let parentForGoal = objectiveId;
          try {
            const epicId = await goalsStore.createGoal({
              title: epicTitle,
              description: `Strategic initiative supporting "${objectiveTitle}".`,
              category: 'epic',
              status: 'active',
              parent_goal_id: objectiveId,
              source: 'onboarding_ai',
            });
            if (epicId) parentForGoal = epicId;
          } catch (e) {
            logger.warn('[Onboarding] Epic creation failed, nesting goal under objective:', e);
          }

          const goalId = await goalsStore.createGoal({
            title: data.goalTitle,
            description: data.goalDescription,
            category: 'goal',
            status: 'active',
            parent_goal_id: parentForGoal,
            source: 'onboarding_ai',
            ...(data.goalTimeframe ? { target_date: data.goalTimeframe } : {}),
          });

          if (goalId) {
            const starterTasks = generateStarterTasks(data.goalTitle, data.motivation);
            const today = new Date();
            for (let i = 0; i < starterTasks.length; i++) {
              const task = starterTasks[i];
              const dueDate = new Date(today);
              dueDate.setDate(dueDate.getDate() + (i * 2) + 1);
              await scheduleStore.createTask(userId, task.title, task.priority, {
                goal_id: goalId,
                source: 'onboarding_ai',
                due_date: dueDate.toISOString().split('T')[0],
              });
            }
          }
        }
      } catch (e) {
        logger.warn('[Onboarding] Goal hierarchy creation failed, creating flat:', e);
        goalsStore.createGoal({
          title: data.goalTitle,
          description: data.goalDescription,
          category: 'goal',
          status: 'active',
          source: 'onboarding_ai',
          ...(data.goalTimeframe ? { target_date: data.goalTimeframe } : {}),
        }).catch(e => logger.warn('[onboarding] goal create failed:', e));
      }

      // 4b: Procrastinated task
      if (data.procrastinatedTask) {
        scheduleStore.createTask(userId, data.procrastinatedTask, 'high', {
          source: 'onboarding_ai',
        }).catch(e => logger.warn('[onboarding] task create failed:', e));
      }

      // 4c: Create habit
      useHabitsStore.getState().createHabit(userId, {
        title: data.habitName,
        category: data.habitCategory,
        frequency: 'daily',
      }).catch(e => logger.warn('[onboarding] habit create failed:', e));

      // 4d: Journal entry
      supabase.from('journal_entries').insert({
        id: genId(),
        user_id: userId,
        date: localDateStr(),
        title: 'My First Entry',
        content: data.journalContent,
        mood: data.journalMood,
        tags: 'onboarding',
        is_deleted: false,
      }).then(() => {}, () => {});

      awardXP(supabase, userId, 'task_complete', {}).catch(e => logger.warn('[onboarding] XP award failed:', e));

      await new Promise(r => setTimeout(r, 1500));

      onComplete({
        name: char?.name || data.characterName || 'Adventurer',
        class: (char?.characterClass || data.characterClass) as CharacterClass,
        level: char?.level || 1,
        totalXp: char?.totalXp || 0,
        appearance: char?.appearance || appearance,
        position: char?.position || { map: 'life_town', x: 400, y: 400 },
      });
    };

    try {
      await Promise.race([
        doCreate(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('createAllData timed out after 30s')), 30000)
        ),
      ]);
    } catch (err) {
      logger.error('[Onboarding] Critical creation error:', err);
      creatingRef.current = false;
      setIsCreatingData(false);
      setCreateError(true);
    }
  }, [userId, extractedData, onComplete, creationAppearance]);

  // ── Reveal scene auto-sequence ──

  useEffect(() => {
    if (scene !== 'reveal') return;

    setMessages([{ role: 'sage', text: SAGE_OPENING_LINES.reveal }]);

    const timer = setTimeout(() => {
      createAllData();
    }, 2500);

    return () => clearTimeout(timer);
  }, [scene, createAllData]);

  // ── Character creation panel callbacks ──

  const handleCreationUpdate = useCallback((update: { skinTone?: string; hairColor?: string; bodyColor?: string }) => {
    setCreationAppearance(prev => ({ ...prev, ...update }));
  }, []);

  const handleCreationConfirm = useCallback((result: { skinTone: string; hairColor: string; bodyColor: string; name: string }) => {
    const skinIdx = SKIN_TONES.indexOf(result.skinTone);
    const hairIdx = HAIR_COLORS.indexOf(result.hairColor);
    appearanceRef.current = {
      skinTone: skinIdx >= 0 ? skinIdx : 2,
      hairStyle: 0,
      hairColor: hairIdx >= 0 ? hairIdx : 0,
      outfit: 0,
      accessory: 0,
    };

    setCreationAppearance({
      skinTone: result.skinTone,
      hairColor: result.hairColor,
      bodyColor: result.bodyColor,
    });

    setExtractedData(prev => ({ ...prev, characterName: result.name }));
    setShowCharacterCreation(false);

    setPlayerBubbleText(`I am ${result.name}!`);
    if (playerBubbleTimerRef.current) clearTimeout(playerBubbleTimerRef.current);

    setTimeout(() => {
      const sageWelcome = `${result.name}... yes, I can feel it resonate through the Realm. A name carries power, and yours shall echo through these halls. Welcome, ${result.name}. Let us continue your journey.`;
      setMessages(prev => [...prev, { role: 'sage', text: sageWelcome }]);
      setSageBubbleText(sageWelcome.slice(0, 140));

      playerBubbleTimerRef.current = setTimeout(() => setPlayerBubbleText(''), 2000);

      typewriterDoneRef.current = false;
      pendingAdvanceRef.current = true;
    }, 1500);
  }, []);

  // ── Handle user message ──

  const handleSend = useCallback(async (text: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    typewriterDoneRef.current = false;

    setPlayerBubbleText(text.slice(0, 140));
    if (playerBubbleTimerRef.current) clearTimeout(playerBubbleTimerRef.current);
    playerBubbleTimerRef.current = setTimeout(() => setPlayerBubbleText(''), 3000);

    setMessages(prev => [...prev, { role: 'user', text }]);

    // path_selection is always card-based
    if (scene === 'path_selection') {
      const response = getTemplateSageReply('path_selection', text, extractedData);
      setMessages(prev => [...prev, { role: 'sage', text: response.sageReply }]);
      if (response.extractedData) {
        setExtractedData(prev => ({ ...prev, ...response.extractedData }));
      }
      if (response.sceneComplete) {
        gatedAdvance();
      }
      sendingRef.current = false;
      return;
    }

    // identity: industry card pick triggers character creation panel
    if (scene === 'identity' && !extractedData.characterClass) {
      const industry = INDUSTRIES.find(i => i.id === text);
      if (industry) {
        const mappedClass = industry.mappedClass as CharacterClass;
        setExtractedData(prev => ({ ...prev, characterClass: mappedClass }));

        const ackReply = `${industry.label} — an excellent path! ${industry.description}. The Realm shapes itself around those who walk this road with purpose. Now, let us forge your true form...`;
        setMessages(prev => [...prev, { role: 'sage', text: ackReply }]);
        setSageBubbleText(ackReply.slice(0, 140));

        setTimeout(() => {
          setShowCharacterCreation(true);
          setPlayerAlpha(0);
          const fadeStart = performance.now();
          const fadeDuration = 800;
          const fadeIn = () => {
            const elapsed = performance.now() - fadeStart;
            const t = Math.min(1, elapsed / fadeDuration);
            setPlayerAlpha(t);
            if (t < 1) requestAnimationFrame(fadeIn);
          };
          requestAnimationFrame(fadeIn);
        }, 1200);

        sendingRef.current = false;
        return;
      }
    }

    // identity scene: if character creation is showing, don't process text sends
    if (scene === 'identity' && showCharacterCreation) {
      sendingRef.current = false;
      return;
    }

    if (useFallback) {
      logger.info('[Onboarding] Using TEMPLATE fallback (LLM failed previously)');
      const response = getTemplateSageReply(scene, text, extractedData);
      setMessages(prev => [...prev, { role: 'sage', text: response.sageReply }]);

      if (response.extractedData) {
        setExtractedData(prev => ({ ...prev, ...response.extractedData }));
      }
      if (response.sceneComplete) {
        gatedAdvance();
      }
      sendingRef.current = false;
      return;
    }

    // LLM mode
    logger.info('[Onboarding] Using LLM mode for scene:', scene);
    setIsThinking(true);
    setSageBubbleText('...');

    const currentMessages = [...messages, { role: 'user' as const, text }];
    const result = await askSage(scene, text, currentMessages, extractedData);

    if (!result) {
      const newFailCount = llmFailCount + 1;
      setLlmFailCount(newFailCount);

      if (newFailCount >= 4) {
        setUseFallback(true);
        const fallbackResponse = getTemplateSageReply(scene, text, extractedData);
        setMessages(prev => [...prev, { role: 'sage', text: fallbackResponse.sageReply }]);
        if (fallbackResponse.extractedData) {
          setExtractedData(prev => ({ ...prev, ...fallbackResponse.extractedData }));
        }
        if (fallbackResponse.sceneComplete) {
          gatedAdvance();
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'sage',
          text: 'Hmm, the arcane channels flicker... Could you say that once more?',
        }]);
      }

      setIsThinking(false);
      sendingRef.current = false;
      return;
    }

    setSageBubbleText('');
    setMessages(prev => [...prev, { role: 'sage', text: result.sageReply }]);

    if (result.extractedData) {
      setExtractedData(prev => ({ ...prev, ...result.extractedData }));
    }

    // Identity: if LLM returned a class but no name, show character creation panel
    if (scene === 'identity' && result.extractedData?.characterClass && !extractedData.characterName && !result.extractedData?.characterName) {
      setTimeout(() => {
        setShowCharacterCreation(true);
        setPlayerAlpha(0);
        const fadeStart = performance.now();
        const fadeDuration = 800;
        const fadeIn = () => {
          const elapsed = performance.now() - fadeStart;
          const t = Math.min(1, elapsed / fadeDuration);
          setPlayerAlpha(t);
          if (t < 1) requestAnimationFrame(fadeIn);
        };
        requestAnimationFrame(fadeIn);
      }, 1200);
      setIsThinking(false);
      sendingRef.current = false;
      return;
    }

    if (result.sceneComplete) {
      gatedAdvance();
    }

    setIsThinking(false);
    sendingRef.current = false;
  }, [scene, messages, extractedData, useFallback, llmFailCount, gatedAdvance, showCharacterCreation]);

  // ── Skip handler ──

  const handleSkip = useCallback(() => {
    const defaults = getDefaultExtractionData();
    setExtractedData(prev => ({ ...defaults, ...prev }));
    setScene('reveal');
  }, []);

  // ── Complete Later ──

  const handleCompleteLater = useCallback(async () => {
    if (laterLoading) return;
    setLaterLoading(true);

    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle();
      const prefs = (profile?.preferences || {}) as Record<string, any>;

      const currentProgress: SavedProgress = { scene, extractedData };

      await supabase.from('user_profiles').update({
        onboarding_complete: true,
        preferences: {
          ...prefs,
          realm_tutorial_complete: false,
          realm_onboarding_progress: currentProgress,
        },
      }).eq('user_id', userId);

      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProgress)); } catch { /* ignore */ }
    } catch (err) {
      logger.warn('[Onboarding] Complete later DB write failed, proceeding with store update:', err);
    }

    const currentStoreProfile = useUserStore.getState().profile;
    if (currentStoreProfile) {
      useUserStore.setState({
        profile: { ...currentStoreProfile, onboarding_complete: true },
      });
    }

    try {
      const cacheKey = `lifeos_profile_cache_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        ...currentStoreProfile,
        onboarding_complete: true,
      }));
    } catch { /* ignore */ }

    if (onSkipLater) {
      onSkipLater();
    }

    setLaterLoading(false);
  }, [userId, scene, extractedData, onSkipLater, laterLoading]);

  const sceneIndex = SCENES.indexOf(scene);

  return {
    scene,
    sceneIndex,
    sceneTransition,
    messages,
    isThinking,
    extractedData,
    showCharacterCreation,
    isCreatingData,
    createError,
    useFallback,
    laterConfirm,
    laterLoading,
    inputMode,
    creationAppearance,
    characterPreview,
    showCharacter,
    playerAlpha,
    sageBubbleText,
    playerBubbleText,
    setLaterConfirm,
    handleSend,
    handleTypewriterComplete,
    handleCreationUpdate,
    handleCreationConfirm,
    handleSkip,
    handleCompleteLater,
    createAllData,
    fallbackConfig,
  };
}