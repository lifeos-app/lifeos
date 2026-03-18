/**
 * OnboardingQuest — The Awakening
 *
 * State machine orchestrator for the LLM-powered onboarding quest.
 * Guides new users through 6 scenes to create their character,
 * first habit, first goal, and first journal entry.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SageDialogue } from './SageDialogue';
import { StageCanvas, type ParticleThemeConfig } from '../../components/stage/StageCanvas';
import { CharacterCreationPanel } from '../../components/stage/CharacterCreationPanel';
import { NPC_APPEARANCES } from '../../components/stage/npc-appearances';
import type { StageCharacter } from '../../components/stage/types';
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
  MOTIVATION_OPTIONS,
  ESBI_CARD_DATA,
} from './templateFallback';
import { createCharacter } from '../../rpg/engine/CharacterManager';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { awardXP } from '../../lib/gamification';
import { getClassInfo } from '../../rpg/data/classes';
import { SKIN_TONES, HAIR_COLORS } from '../../rpg/data/sprites';
import { INDUSTRIES, industryToClass } from '../../rpg/data/industries';
import { genId, localDateStr } from '../../utils/date';
import { assetPath } from '../../utils/assets';
import type { CharacterClass } from '../../rpg/engine/types';
import type { RealmCharacterData } from '../RealmEngine';
import { logger } from '../../utils/logger';

// ── Constants ────────────────────────────────────

const SCENES: OnboardingScene[] = ['awakening', 'path_selection', 'identity', 'first_seed', 'the_dream', 'first_words', 'reveal'];
const STORAGE_KEY = 'lifeos_onboarding_progress';

// Class-based identity colors
const CLASS_PARTICLE_COLORS: Record<string, string[]> = {
  warrior: ['#e74c3c', '#ff6b6b', '#ff9999'],
  mage: ['#3498db', '#74b9ff', '#a29bfe'],
  ranger: ['#2ecc71', '#55efc4', '#00b894'],
  healer: ['#f1c40f', '#ffeaa7', '#fdcb6e'],
  engineer: ['#e67e22', '#fab1a0', '#ff7675'],
};

// Scene particle configurations for StageCanvas
const SCENE_PARTICLE_THEMES: Record<string, ParticleThemeConfig> = {
  awakening: { colors: ['#444', '#666', '#888'], speed: 0.3, life: 180, size: 2, type: 'dot', gravity: -0.005, rate: 0.2 },
  path_selection: { colors: ['#FFD700', '#fff', '#FFC107'], speed: 0.3, life: 150, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  identity: { colors: ['#FFD700', '#FFC107', '#FFB300'], speed: 0.3, life: 200, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  first_seed: { colors: ['#27ae60', '#2ecc71', '#82e0aa'], speed: 0.6, life: 100, size: 2, type: 'dot', gravity: -0.015, rate: 0.4, emitFromBottom: true },
  the_dream: { colors: ['#e74c3c', '#f39c12', '#FFD700'], speed: 1.5, life: 50, size: 2, type: 'glow', gravity: -0.04, rate: 0.5 },
  first_words: { colors: ['#6c5ce7', '#a29bfe', '#4B0082'], speed: 0.3, life: 180, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  reveal: { colors: ['#FFD700', '#FFC107', '#fff'], speed: 2, life: 80, size: 3, type: 'glow', gravity: -0.01, rate: 2 },
};

interface SavedProgress {
  scene: OnboardingScene;
  extractedData: Partial<ExtractedOnboardingData>;
}

// ── Starter task generator ───────────────────────

interface StarterTask {
  title: string;
  priority: string;
}

function generateStarterTasks(goalTitle: string, motivation: string): StarterTask[] {
  // Generate contextual starter tasks based on the user's goal
  const goalLower = goalTitle.toLowerCase();

  // Try to match specific goal patterns first
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

  // Generic starter tasks based on motivation category
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

// ── Props ────────────────────────────────────────

interface OnboardingQuestProps {
  userId: string;
  onComplete: (charData: RealmCharacterData) => void;
  /** Called when user chooses "Later" — skip onboarding without creating character */
  onSkipLater?: () => void;
}

// ── Component ────────────────────────────────────

export function OnboardingQuest({ userId, onComplete, onSkipLater }: OnboardingQuestProps) {
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

  // ── Character creation panel state ──
  const [showCharacterCreation, setShowCharacterCreation] = useState(false);
  const [creationAppearance, setCreationAppearance] = useState({
    skinTone: SKIN_TONES[2],
    hairColor: HAIR_COLORS[0],
    bodyColor: '#e74c3c',
  });
  const [playerAlpha, setPlayerAlpha] = useState(0);

  const initRef = useRef(false);
  const creatingRef = useRef(false);

  // ── Dialogue racing fix: gate scene advance on typewriter completion ──
  const typewriterDoneRef = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const sendingRef = useRef(false); // double-send guard

  // ── Character appearance (set by user via CharacterCreationPanel) ──
  // Indices stored for createAllData, colors stored for live preview
  const appearanceRef = useRef({
    skinTone: 2,
    hairStyle: 0,
    hairColor: 0,
    outfit: 0,
    accessory: 0,
  });

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

    // Try localStorage first (instant)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        restoreProgress(JSON.parse(saved));
        return;
      }
    } catch { /* ignore */ }

    // Fallback: check Supabase preferences (covers cache-cleared / new device)
    if (userId) {
      supabase.from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle()
        .then(({ data: profile }) => {
          const prefs = (profile?.preferences || {}) as Record<string, any>;
          const serverProgress = prefs.realm_onboarding_progress as SavedProgress | undefined;
          if (serverProgress?.scene) {
            restoreProgress(serverProgress);
            // Also cache locally for next time
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

    // Also persist to Supabase preferences (fire-and-forget)
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

  // ── Character preview (uses creation panel appearance or extracted data) ──

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

  // Show character on stage when creation panel is up, or during reveal
  const showCharacter = showCharacterCreation || (scene === 'identity' && !!extractedData.characterName) || scene === 'reveal';

  // ── Stage characters for StageCanvas ──

  const showSage = scene !== 'reveal' && scene !== 'path_selection';
  // awakening scene also shows Sage on stage (spec: from awakening onward)
  // path_selection: card-based, no characters needed on stage

  const stageCharacters = useMemo((): StageCharacter[] => {
    const chars: StageCharacter[] = [];

    if (showSage) {
      chars.push({
        id: 'sage',
        cx: showCharacter ? 0.33 : 0.5,
        cy: 0.65,
        appearance: NPC_APPEARANCES.sage,
        direction: showCharacter ? 'right' : 'down',
        isMoving: false,
        walkFrame: 0,
        mood: 4,
        visible: true,
        alpha: 1,
        bubble: sageBubbleText ? {
          text: sageBubbleText,
          startTime: 0,
          duration: Infinity,
        } : undefined,
      });
    }

    if (showCharacter) {
      chars.push({
        id: 'player',
        cx: 0.67,
        cy: 0.65,
        appearance: characterPreview,
        direction: 'left',
        isMoving: false,
        walkFrame: 0,
        mood: 4,
        visible: true,
        alpha: playerAlpha,
        bubble: playerBubbleText ? {
          text: playerBubbleText,
          startTime: 0,
          duration: Infinity,
        } : undefined,
      });
    }

    return chars;
  }, [showSage, showCharacter, characterPreview, sageBubbleText, playerBubbleText, playerAlpha]);

  // ── Particle theme for current scene ──

  const particleTheme = useMemo((): ParticleThemeConfig => {
    const base = SCENE_PARTICLE_THEMES[scene] || SCENE_PARTICLE_THEMES.awakening;
    // identity: use class-specific colors
    if (scene === 'identity' && extractedData.characterClass && CLASS_PARTICLE_COLORS[extractedData.characterClass]) {
      return { ...base, colors: CLASS_PARTICLE_COLORS[extractedData.characterClass] };
    }
    return base;
  }, [scene, extractedData.characterClass]);

  // Reveal burst
  const revealBurst = useMemo(() => {
    if (scene !== 'reveal') return null;
    return {
      x: 0.5,
      y: 0.5,
      count: 50,
      config: { colors: ['#FFD700', '#FFC107', '#fff', '#D4AF37'], speed: 4, life: 100, size: 3, type: 'glow' as const, gravity: 0.02 },
    };
  }, [scene]);

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

  // ── Typewriter completion callback (gates scene advance + updates bubble) ──

  const handleTypewriterComplete = useCallback(() => {
    typewriterDoneRef.current = true;

    // Update Sage's bubble text with the latest completed message
    if (messages.length > 0) {
      const lastSage = [...messages].reverse().find(m => m.role === 'sage');
      if (lastSage) {
        setSageBubbleText(lastSage.text.slice(0, 140));
      }
    }

    if (pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      // Wait minimum 2s read time after typewriter completes
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
    // Set full alpha for reveal scene player
    if (scene === 'reveal') setPlayerAlpha(1);
  }, [scene]);

  // ── Create all data (reveal scene) ──

  const createAllData = useCallback(async () => {
    if (creatingRef.current) return; // Prevent double-submit
    creatingRef.current = true;
    setIsCreatingData(true);
    setCreateError(false);

    const data = { ...getDefaultExtractionData(), ...extractedData };
    const appearance = appearanceRef.current;

    const doCreate = async () => {
      // STEP 1: Mark onboarding complete FIRST — this is the gate.
      // Everything else is bonus. If anything below fails, the user is still in the app.
      // Also mark realm_tutorial_complete so the realm tab is unlocked.
      const { data: curProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', userId).maybeSingle();
      const curPrefs = (curProfile?.preferences || {}) as Record<string, any>;

      // Only set display_name if the user doesn't already have one
      // (character name goes in the characters table, not here)
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

      // Clean up local storage immediately
      localStorage.removeItem(STORAGE_KEY);

      // STEP 2: Character creation (best-effort)
      let char: Awaited<ReturnType<typeof createCharacter>> = null;
      try {
        char = await createCharacter(userId, data.characterName, data.characterClass, appearance);
      } catch (e) { logger.warn('[Onboarding] Character creation failed:', e); }

      // Populate appearance store with user-chosen colors
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

      // STEP 3: Write preferences (best-effort)
      // IMPORTANT: Merge with existing prefs — never overwrite the whole object.
      // STEP 1 already wrote realm_tutorial_complete: true; overwriting would wipe it
      // and cause an infinite onboarding loop.
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

      // STEP 4: Seed initial data — build a meaningful starting structure (all best-effort)

      // 4a: Create objective → goal → starter tasks hierarchy
      const goalsStore = useGoalsStore.getState();
      const scheduleStore = useScheduleStore.getState();

      // Derive an objective title from motivation
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
        // Create the objective (top-level)
        const objectiveId = await goalsStore.createGoal({
          title: objectiveTitle,
          description: `My guiding objective, born from the onboarding quest in the Realm.`,
          category: 'objective',
          status: 'active',
          source: 'onboarding_ai',
        });

        if (objectiveId) {
          // Create an Epic under the Objective
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

          // Create the user's specific goal nested under the epic (or objective as fallback)
          const goalId = await goalsStore.createGoal({
            title: data.goalTitle,
            description: data.goalDescription,
            category: 'goal',
            status: 'active',
            parent_goal_id: parentForGoal,
            source: 'onboarding_ai',
            ...(data.goalTimeframe ? { target_date: data.goalTimeframe } : {}),
          });

          // Create 2-3 starter tasks under the goal WITH progressive due dates
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
        // Fallback: create flat goal if hierarchy fails
        goalsStore.createGoal({
          title: data.goalTitle,
          description: data.goalDescription,
          category: 'goal',
          status: 'active',
          source: 'onboarding_ai',
          ...(data.goalTimeframe ? { target_date: data.goalTimeframe } : {}),
        }).catch(e => logger.warn('[onboarding] goal create failed:', e));
      }

      // 4b: Create the procrastinated task (standalone, not under a goal)
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

      // 4d: Create journal entry
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

      // Delay for the "forging" animation, then complete
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
      creatingRef.current = false; // Allow retry on error
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

  // ── Gated advance: waits for typewriter completion + read time ──

  const gatedAdvance = useCallback(() => {
    if (typewriterDoneRef.current) {
      // Typewriter already done, advance after 2s read time
      setTimeout(advanceScene, 2000);
    } else {
      // Typewriter still running — mark advance pending
      pendingAdvanceRef.current = true;
    }
  }, [advanceScene]);

  // ── Character creation panel callbacks ──

  const handleCreationUpdate = useCallback((update: { skinTone?: string; hairColor?: string; bodyColor?: string }) => {
    setCreationAppearance(prev => ({ ...prev, ...update }));
  }, []);

  const handleCreationConfirm = useCallback((result: { skinTone: string; hairColor: string; bodyColor: string; name: string }) => {
    // Store the chosen appearance indices for createAllData
    const skinIdx = SKIN_TONES.indexOf(result.skinTone);
    const hairIdx = HAIR_COLORS.indexOf(result.hairColor);
    appearanceRef.current = {
      skinTone: skinIdx >= 0 ? skinIdx : 2,
      hairStyle: 0,
      hairColor: hairIdx >= 0 ? hairIdx : 0,
      outfit: 0,
      accessory: 0,
    };

    // Update creation appearance for the live preview
    setCreationAppearance({
      skinTone: result.skinTone,
      hairColor: result.hairColor,
      bodyColor: result.bodyColor,
    });

    // Store the name and close the panel
    setExtractedData(prev => ({ ...prev, characterName: result.name }));
    setShowCharacterCreation(false);

    // Show "I am [Name]!" bubble on the player character
    setPlayerBubbleText(`I am ${result.name}!`);
    if (playerBubbleTimerRef.current) clearTimeout(playerBubbleTimerRef.current);

    // After a moment, Sage responds warmly and advances scene
    setTimeout(() => {
      const sageWelcome = `${result.name}... yes, I can feel it resonate through the Realm. A name carries power, and yours shall echo through these halls. Welcome, ${result.name}. Let us continue your journey.`;
      setMessages(prev => [...prev, { role: 'sage', text: sageWelcome }]);
      setSageBubbleText(sageWelcome.slice(0, 140));

      // Clear player bubble after Sage speaks
      playerBubbleTimerRef.current = setTimeout(() => setPlayerBubbleText(''), 2000);

      // Advance to next scene after read time
      typewriterDoneRef.current = false;
      pendingAdvanceRef.current = true;
    }, 1500);
  }, []);

  // ── Handle user message ──

  const handleSend = useCallback(async (text: string) => {
    // Double-send guard: prevent sending while previous response is streaming/typing
    if (sendingRef.current) return;
    sendingRef.current = true;

    // Reset typewriter state for the upcoming sage reply
    typewriterDoneRef.current = false;

    // Show player bubble on stage (3s)
    setPlayerBubbleText(text.slice(0, 140));
    if (playerBubbleTimerRef.current) clearTimeout(playerBubbleTimerRef.current);
    playerBubbleTimerRef.current = setTimeout(() => setPlayerBubbleText(''), 3000);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text }]);

    // path_selection is always card-based (no LLM)
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

    // identity scene: industry card pick triggers character creation panel
    if (scene === 'identity' && !extractedData.characterClass) {
      // Check if the text is an industry id
      const industry = INDUSTRIES.find(i => i.id === text);
      if (industry) {
        const mappedClass = industry.mappedClass as CharacterClass;
        setExtractedData(prev => ({ ...prev, characterClass: mappedClass }));

        const ackReply = `${industry.label} — an excellent path! ${industry.description}. The Realm shapes itself around those who walk this road with purpose. Now, let us forge your true form...`;
        setMessages(prev => [...prev, { role: 'sage', text: ackReply }]);
        setSageBubbleText(ackReply.slice(0, 140));

        // After Sage acknowledges, show character creation panel with fade-in
        setTimeout(() => {
          setShowCharacterCreation(true);
          // Animate player alpha from 0 → 1 over 800ms
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
      // If not an industry id, fall through to template/LLM handling
    }

    // identity scene: if character creation is showing, don't process text sends
    if (scene === 'identity' && showCharacterCreation) {
      sendingRef.current = false;
      return;
    }

    if (useFallback) {
      // Template mode
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
      // LLM failed
      const newFailCount = llmFailCount + 1;
      setLlmFailCount(newFailCount);

      if (newFailCount >= 4) {
        setUseFallback(true);
        // Use template for this message
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

    // LLM succeeded — clear thinking bubble (typewriter callback will set final text)
    setSageBubbleText('');
    setMessages(prev => [...prev, { role: 'sage', text: result.sageReply }]);

    if (result.extractedData) {
      setExtractedData(prev => ({ ...prev, ...result.extractedData }));
    }

    // Identity scene: if LLM returned a class but no name, show character creation panel
    if (scene === 'identity' && result.extractedData?.characterClass && !extractedData.characterName && !result.extractedData?.characterName) {
      // Show character creation panel after Sage's reply types out
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

  // ── Complete Later — skip to dashboard, but realm stays locked ──

  const handleCompleteLater = useCallback(async () => {
    if (laterLoading) return;
    setLaterLoading(true);

    try {
      // STEP 1: Write to Supabase FIRST so no background fetch can revert us.
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

      // Save progress to localStorage for instant resume on same device
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProgress)); } catch { /* ignore */ }
    } catch (err) {
      logger.warn('[Onboarding] Complete later DB write failed, proceeding with store update:', err);
    }

    // STEP 2: Update Zustand store (triggers App.tsx re-render).
    // Done AFTER the DB write so no background fetch can race and revert us.
    const currentStoreProfile = useUserStore.getState().profile;
    if (currentStoreProfile) {
      useUserStore.setState({
        profile: { ...currentStoreProfile, onboarding_complete: true },
      });
    }

    // Also update localStorage cache (user-scoped)
    try {
      const cacheKey = `lifeos_profile_cache_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        ...currentStoreProfile,
        onboarding_complete: true,
      }));
    } catch { /* ignore */ }

    // STEP 3: Notify parent
    if (onSkipLater) {
      onSkipLater();
    }

    setLaterLoading(false);
  }, [userId, scene, extractedData, onSkipLater]);

  // ── Determine input mode ──

  const inputMode = useMemo((): 'text' | 'textarea' | 'none' => {
    if (scene === 'reveal') return 'none';
    if (scene === 'path_selection') return 'none'; // Always card-based
    if (scene === 'identity' && !extractedData.characterClass) return 'none'; // Industry cards shown
    if (scene === 'identity' && showCharacterCreation) return 'none'; // Character creation panel handles input
    if (scene === 'identity' && extractedData.characterClass) return 'none'; // Waiting for character creation
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

  // ── Fallback UI elements ──

  const fallbackUI = useMemo(() => {
    // path_selection is always card-based (even in LLM mode)
    if (scene === 'path_selection') {
      return (
        <div className="realm-onboarding-esbi-cards">
          {ESBI_CARD_DATA.map(card => (
            <button
              key={card.id}
              className="realm-onboarding-esbi-card"
              onClick={() => handleSend(card.id)}
              disabled={isThinking}
            >
              {card.image ? (
                <img src={card.image} alt={card.name} className="realm-onboarding-esbi-card-img" />
              ) : (
                <span className="realm-onboarding-esbi-card-icon">{card.icon}</span>
              )}
              <span className="realm-onboarding-esbi-card-name">{card.name}</span>
              <span className="realm-onboarding-esbi-card-desc">{card.description}</span>
            </button>
          ))}
        </div>
      );
    }

    // Identity: show industry cards always (like path_selection), before class is set
    if (scene === 'identity' && !extractedData.characterClass) {
      return (
        <div className="realm-onboarding-class-cards">
          {INDUSTRIES.map(ind => (
            <button
              key={ind.id}
              className="realm-onboarding-class-card"
              onClick={() => handleSend(ind.id)}
              disabled={isThinking}
              style={{ borderColor: `${ind.color}40` }}
            >
              <img src={assetPath(ind.icon)} alt={ind.label} className="realm-onboarding-class-card-icon" />
              <span className="realm-onboarding-class-card-name">{ind.label}</span>
              <span className="realm-onboarding-class-card-desc">{ind.description}</span>
            </button>
          ))}
        </div>
      );
    }

    if (!useFallback) return undefined;

    // Awakening: show pills only before motivation is set
    if (scene === 'awakening' && !extractedData.motivation) {
      return (
        <div className="realm-onboarding-pills">
          {MOTIVATION_OPTIONS.map(opt => (
            <button
              key={opt}
              className="realm-onboarding-pill"
              onClick={() => handleSend(opt)}
              disabled={isThinking}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    return undefined;
  }, [useFallback, scene, isThinking, handleSend, extractedData.motivation, extractedData.characterClass]);

  // ── Progress dots ──

  const sceneIndex = SCENES.indexOf(scene);

  return (
    <div className="realm-onboarding-container">
      {/* Close button — prominent escape hatch */}
      <button
        className="realm-onboarding-close-btn"
        onClick={() => setLaterConfirm(true)}
        aria-label="Close onboarding"
      >
        ✕
      </button>
      {/* Complete Later — two-step confirmation */}
      {laterConfirm ? (
        <div className="realm-onboarding-later-confirm">
          <span>{laterLoading ? 'Skipping...' : 'Skip quest? Default character.'}</span>
          <button className="realm-onboarding-later-btn" onClick={handleCompleteLater} disabled={laterLoading}>
            {laterLoading ? '...' : 'Skip'}
          </button>
          {!laterLoading && (
            <button className="realm-onboarding-later-btn" onClick={() => setLaterConfirm(false)}>Keep Going</button>
          )}
        </div>
      ) : (
        <button
          onClick={() => setLaterConfirm(true)}
          className="realm-onboarding-later-trigger"
        >
          Later
        </button>
      )}
      {/* Progress */}
      <div className="realm-onboarding-progress">
        {SCENES.map((s, i) => (
          <div
            key={s}
            className={`realm-onboarding-dot ${
              i < sceneIndex ? 'realm-onboarding-dot--completed' :
              i === sceneIndex ? 'realm-onboarding-dot--current' :
              'realm-onboarding-dot--future'
            }`}
          />
        ))}
      </div>

      {/* Scene visual */}
      <div className={`realm-onboarding-scene realm-onboarding-scene--${scene}`}>
        <StageCanvas
          theme={particleTheme}
          characters={stageCharacters}
          className="realm-onboarding-canvas"
          burst={revealBurst}
        />
      </div>

      {/* Scene transition overlay */}
      {sceneTransition && <div className="realm-onboarding-scene-transition" />}

      {/* Character Creation Panel (overlays dialogue during identity scene) */}
      {showCharacterCreation && (
        <CharacterCreationPanel
          initialClass={extractedData.characterClass || 'warrior'}
          onConfirm={handleCreationConfirm}
          onUpdate={handleCreationUpdate}
        />
      )}

      {/* Dialogue / Reveal */}
      {scene === 'reveal' ? (
        <div className="realm-onboarding-dialogue-area">
          <div className="realm-onboarding-messages">
            {messages.map((msg, i) => (
              <div key={i} className="realm-onboarding-message realm-onboarding-message--sage">
                {msg.text}
              </div>
            ))}
          </div>
          {isCreatingData && (
            <div className="realm-onboarding-creating">
              Forging your destiny
              <span className="realm-onboarding-thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          )}
          {createError && (
            <div className="realm-onboarding-creating">
              <p>Something went wrong. <button onClick={createAllData} style={{ color: '#D4AF37', background: 'none', border: '1px solid #D4AF37', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button></p>
            </div>
          )}
        </div>
      ) : (
        <SageDialogue
          messages={messages}
          onSend={handleSend}
          isThinking={isThinking}
          inputMode={inputMode}
          placeholder={fallbackConfig?.placeholder || 'Speak to the Sage...'}
          inputLabel={fallbackConfig?.label}
          showSkip={false}
          fallbackUI={fallbackUI}
          onTypewriterComplete={handleTypewriterComplete}
        />
      )}
    </div>
  );
}
