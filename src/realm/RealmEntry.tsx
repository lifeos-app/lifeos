/**
 * Realm Entry — The Realm
 *
 * Main React component that bootstraps the game engine,
 * manages UI overlays, and handles lifecycle.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { RealmEngine, type RealmState, type RealmCharacterData } from './RealmEngine';
import { RealmHUD } from './ui/RealmHUD';
import { DialogueBox } from './ui/DialogueBox';
import { ZoneTransition } from './ui/ZoneTransition';
import { RealmTransition } from './ui/RealmTransition';
import { PlantInfoPanel } from './ui/PlantInfoPanel';
import { QuestBoard } from './ui/QuestBoard';
import { Minimap } from './ui/Minimap';
import { WorldMap } from './ui/WorldMap';
import { ChatOverlay } from './ui/ChatOverlay';
import { EmoteRadial } from './ui/EmoteRadial';
import { BiomePicker } from './ui/BiomePicker';
import { PlayerProfileCard } from './ui/PlayerProfileCard';
import type { ChatMessage, RemotePlayer, EmoteType } from './multiplayer/types';
import { BIOMES, type BiomeId } from './data/biomes';
import { loadCharacter } from '../rpg/engine/CharacterManager';
import { useUserStore } from '../stores/useUserStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import type { GardenPlant, DynamicEntity } from './bridge/DataBridge';
import type { CharacterClass } from '../rpg/engine/types';
import type { PortalPlacement } from './data/zones';
import { LIFE_TOWN } from './data/zones';
import { RealmSessionGuard } from './bridge/RealmSessionGuard';
import { useCharacterAppearanceStore } from '../stores/useCharacterAppearanceStore';
import { SKIN_TONES, HAIR_COLORS } from '../rpg/data/sprites';
import { getClassInfo } from '../rpg/data/classes';
import { OnboardingQuest } from './onboarding/OnboardingQuest';
import { NPCDialoguePanel } from './ui/NPCDialoguePanel';
import { FeatureErrorBoundary } from '../components/FeatureErrorBoundary';
import { CompanionProgress } from './ui/CompanionProgress';
import { logger } from '../utils/logger';
import { prefetchFlora } from './hooks/useFlora';
import { prefetchFauna, fetchCompanion, getCompanionCache, nameCompanion } from './hooks/useFauna';
import { CompanionPanel } from './ui/CompanionPanel';
import { getTodayEvent } from './data/celestial';
import { SlideTutorial } from '../components/SlideTutorial';
import { SLIDE_TUTORIALS } from '../components/tutorials';
import { getFaunaSpecies, FALLBACK_FAUNA, assignCompanion, getDominantPattern, checkCompanionEligibility } from './data/companions';
import { getFaunaCache, createCompanion } from './hooks/useFauna';
import './onboarding/onboarding.css';
import './realm.css';

const INTERACTIVE_NPCS = new Set(['blacksmith_npc', 'healer_npc', 'librarian_npc']);

interface RealmEntryProps {
  /** Called when user wants to go back to Character Hub */
  onExit?: () => void;
  /** Enable fullscreen immersive mode (takes over entire viewport) */
  fullscreen?: boolean;
}

export function RealmEntry({ onExit, fullscreen = false }: RealmEntryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RealmEngine | null>(null);
  const navigate = useNavigate();

  const userId = useUserStore(s => s.session?.user?.id);

  const [loading, setLoading] = useState(true);
  const [engineState, setEngineState] = useState<RealmState>('loading');
  const [showTransition, setShowTransition] = useState(true);
  const [showEnterTransition, setShowEnterTransition] = useState(fullscreen);
  const [showExitTransition, setShowExitTransition] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);

  // Dialogue state
  const [dialogue, setDialogue] = useState<{
    npcName: string;
    lines: string[];
  } | null>(null);

  // Interactive NPC panel state
  const [activeNPC, setActiveNPC] = useState<{ id: string; name: string; lines: string[] } | null>(null);

  // Cooldown to prevent dialogue re-open on close tap bleeding through to canvas
  const dialogueClosedAt = useRef(0);

  // Plant info state
  const [selectedPlant, setSelectedPlant] = useState<GardenPlant | null>(null);

  // Quest board state
  const [showQuestBoard, setShowQuestBoard] = useState(false);

  // Minimap state
  const [showMinimap, setShowMinimap] = useState(false);

  // World map state
  const [worldMapOpen, setWorldMapOpen] = useState(false);

  // Audio initialized flag
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Character data
  const [charData, setCharData] = useState<RealmCharacterData | null>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Companion state
  const [selectedCompanion, setSelectedCompanion] = useState(false);

  // Biome state
  const [biomeId, setBiomeId] = useState<BiomeId>(() => {
    return (localStorage.getItem('lifeos-realm-biome') as BiomeId) || 'woodland';
  });
  const [showBiomePicker, setShowBiomePicker] = useState(false);

  // Multiplayer state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedRemotePlayer, setSelectedRemotePlayer] = useState<RemotePlayer | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);

  // ── Load data ──────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    async function loadData() {
      // Prefetch flora (must complete before engine derives world state)
      await prefetchFlora();
      prefetchFauna(); // fauna is fire-and-forget (not used in garden)

      // Hydrate stores
      await Promise.all([
        useHabitsStore.getState().fetchAll({ skipSync: true }),
        useHealthStore.getState().fetchToday({ skipSync: true }),
        useGoalsStore.getState().fetchAll({ skipSync: true }),
        useFinanceStore.getState().fetchAll({ skipSync: true }),
        useJournalStore.getState().fetchRecent(50, { skipSync: true }),
        useScheduleStore.getState().fetchAll?.({ skipSync: true }).catch(e => logger.warn('[realm] schedule fetch failed:', e)),
      ]);

      // Fetch companion data
      await fetchCompanion(userId!);

      // Load RPG character
      const char = await loadCharacter(userId!);

      if (char) {
        setCharData({
          name: char.name,
          class: char.characterClass,
          level: char.level,
          totalXp: char.totalXp,
          appearance: char.appearance,
          position: char.position,
        });

        // Populate character appearance store for MiniCharacter
        const classInfo = getClassInfo(char.characterClass);
        useCharacterAppearanceStore.getState().set({
          skinTone: SKIN_TONES[char.appearance.skinTone ?? 4] || SKIN_TONES[4],
          hairColor: HAIR_COLORS[char.appearance.hairColor ?? 0] || HAIR_COLORS[0],
          bodyColor: classInfo.color,
          classIcon: classInfo.icon,
          name: char.name,
          level: char.level,
          characterClass: char.characterClass,
        });
      }

      if (!char) {
        // No character — show onboarding (also check for resume)
        setShowOnboarding(true);
      }

      // Celestial event toast
      const todayEvent = getTodayEvent(new Date());
      if (todayEvent) {
        const todayKey = new Date().toISOString().split('T')[0];
        const shownKey = `realm_celestial_shown_${userId}_${todayKey}`;
        if (!localStorage.getItem(shownKey)) {
          localStorage.setItem(shownKey, '1');
          const lines = [todayEvent.description];
          if (todayEvent.xpMultiplier && todayEvent.xpMultiplier > 1) {
            lines.push(`XP bonus active: ${Math.round((todayEvent.xpMultiplier - 1) * 100)}% boost today.`);
          }
          // Defer dialogue to after engine init
          setTimeout(() => {
            setDialogue({ npcName: todayEvent.name, lines });
          }, 2000);
        }
      }

      // Companion eligibility check
      if (!getCompanionCache() && userId) {
        // Simple check: do we have habits across 3+ categories logged in last 7 days?
        const habits = useHabitsStore.getState().habits.filter(h => !h.is_deleted);
        const logs = useHabitsStore.getState().logs;
        const last7 = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
          const dayLogs = logs.filter(l => l.date === date);
          const categories = new Set(dayLogs.map(l => {
            const h = habits.find(h2 => h2.id === l.habit_id);
            return h?.category || 'other';
          }));
          last7.push(categories.size);
        }
        if (checkCompanionEligibility(last7)) {
          const actionCounts: Record<string, number> = {};
          for (const h of habits) {
            const cat = h.category || 'other';
            actionCounts[cat] = (actionCounts[cat] || 0) + (h.streak_current || 0);
          }
          const dominant = getDominantPattern(actionCounts);
          const speciesKey = assignCompanion(userId, dominant);
          createCompanion(userId, speciesKey).then(() => {
            // Refresh world state on next tick
            engineRef.current?.refreshWorldState();
          });
        }
      }

      setLoading(false);
    }

    loadData();
  }, [userId]);

  // ── Init engine ────────────────────────────────

  useEffect(() => {
    if (loading || !canvasRef.current) return;

    const engine = new RealmEngine();
    engineRef.current = engine;

    engine.init(canvasRef.current, charData, {
      onRemotePlayerTap: (player) => {
        setSelectedRemotePlayer(player);
      },
      onNPCInteraction: (id, name, lines) => {
        if (Date.now() - dialogueClosedAt.current < 400) return;
        if (INTERACTIVE_NPCS.has(id)) {
          setTimeout(() => setActiveNPC({ id, name, lines }), 0);
        } else {
          setTimeout(() => setDialogue({ npcName: name, lines }), 0);
        }
      },
      onPortalInteraction: (portal: PortalPlacement, locked: boolean) => {
        // Suppress if dialogue just closed (tap bleed-through)
        if (Date.now() - dialogueClosedAt.current < 400) return;
        if (locked) {
          setTimeout(() => setDialogue({
            npcName: '🔒 Locked Path',
            lines: [
              `The path to ${portal.label} is shrouded in fog.`,
              getUnlockHint(portal.unlockCondition),
            ],
          }), 0);
        }
        // TODO: Zone transition for unlocked portals
      },
      onPlantInteraction: (plant) => {
        if (Date.now() - dialogueClosedAt.current < 400) return;
        setTimeout(() => setSelectedPlant(plant), 0);
      },
      onEntityInteraction: (entity) => {
        if (Date.now() - dialogueClosedAt.current < 400) return;
        setTimeout(() => {
          if (entity.type === 'shadow') {
            setDialogue({
              npcName: entity.label,
              lines: getShadowDialogue(entity),
            });
          } else if (entity.type === 'goal_companion') {
            setDialogue({
              npcName: entity.label,
              lines: ['This companion represents one of your active goals.', 'Keep working toward it!'],
            });
          } else if (entity.type === 'journal_echo') {
            setDialogue({
              npcName: 'Journal Echo',
              lines: ['A whisper of past reflections...', 'Your written wisdom takes form here.'],
            });
          }
        }, 0);
      },
      onCompanionInteraction: () => {
        setTimeout(() => setSelectedCompanion(true), 0);
      },
      onBuildingInteraction: (buildingType) => {
        if (buildingType === 'bulletin_board') {
          setTimeout(() => setShowQuestBoard(true), 0);
        }
      },
      onStateChange: (state) => {
        setEngineState(state);
      },
    }, userId);

    // Apply biome
    const savedBiome = (localStorage.getItem('lifeos-realm-biome') as BiomeId) || 'woodland';
    engine.setTileBiome(BIOMES[savedBiome] ?? BIOMES.woodland);

    // Subscribe to chat messages
    const unsubChat = engine.onChatMessage((msg) => {
      setChatMessages(prev => [...prev.slice(-49), msg]);
    });

    // Poll online count
    const onlineInterval = setInterval(() => {
      setOnlineCount(engine.getOnlineCount());
    }, 2000);

    // Handle resize
    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    // Handle visibility (reduce fps when hidden)
    const handleVisibility = () => {
      if (document.hidden) {
        engine.stop();
      } else {
        engine.start();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Subscribe to habit store changes for live garden updates
    const unsubHabits = useHabitsStore.subscribe(
      (state) => state.habits,
      () => { engineRef.current?.refreshWorldState(); },
      { equalityFn: (a, b) => a === b },
    );

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubChat();
      unsubHabits();
      clearInterval(onlineInterval);
      engine.destroy();
      engineRef.current = null;
    };
  }, [loading, charData, userId]);

  // ── Handlers ───────────────────────────────────

  const handleBack = useCallback(() => {
    if (fullscreen) {
      // Show exit animation, then call onExit
      setShowExitTransition(true);
    } else {
      onExit?.();
    }
  }, [onExit, fullscreen]);

  const handleToggleZoom = useCallback(() => {
    // TODO: Implement zoom toggle
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicEnabled(prev => {
      const next = !prev;
      engineRef.current?.setMusicEnabled(next);
      return next;
    });
  }, []);

  const handleCloseDialogue = useCallback(() => {
    dialogueClosedAt.current = Date.now();
    setDialogue(null);
  }, []);

  const handleCloseNPC = useCallback(() => {
    dialogueClosedAt.current = Date.now();
    setActiveNPC(null);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
  }, []);

  const handleEnterTransitionComplete = useCallback(() => {
    setShowEnterTransition(false);
  }, []);

  const handleExitTransitionComplete = useCallback(() => {
    setShowExitTransition(false);
    onExit?.();
  }, [onExit]);

  const handleCanvasInteraction = useCallback(() => {
    if (!audioInitialized && engineRef.current) {
      engineRef.current.initAudio(musicEnabled);
      setAudioInitialized(true);
    }
  }, [audioInitialized, musicEnabled]);

  const handleClosePlant = useCallback(() => {
    setSelectedPlant(null);
  }, []);

  const handleCloseCompanion = useCallback(() => {
    setSelectedCompanion(false);
  }, []);

  const handleNameCompanion = useCallback((name: string) => {
    if (userId) {
      nameCompanion(userId, name).then(() => {
        engineRef.current?.refreshWorldState();
      });
    }
  }, [userId]);

  const handleCloseQuestBoard = useCallback(() => {
    setShowQuestBoard(false);
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap(prev => !prev);
  }, []);

  const handleToggleWorldMap = useCallback(() => {
    setWorldMapOpen(prev => {
      const next = !prev;
      // Pause/resume engine when map is open/closed
      if (next) {
        engineRef.current?.stop();
      } else {
        engineRef.current?.start();
      }
      return next;
    });
  }, []);

  const handleToggleChat = useCallback(() => {
    setShowChat(prev => !prev);
  }, []);

  const handleSendChat = useCallback((content: string) => {
    const sent = engineRef.current?.sendChat(content);
    if (sent) engineRef.current?.setLocalChatBubble(content);
    return sent ?? false;
  }, []);

  const handleCloseProfile = useCallback(() => {
    setSelectedRemotePlayer(null);
  }, []);

  const handleEmote = useCallback((emote: EmoteType) => {
    engineRef.current?.sendEmote(emote);
  }, []);

  const handleToggleBiomePicker = useCallback(() => {
    setShowBiomePicker(prev => !prev);
  }, []);

  const handleSelectBiome = useCallback((id: BiomeId) => {
    setBiomeId(id);
    localStorage.setItem('lifeos-realm-biome', id);
    engineRef.current?.setTileBiome(BIOMES[id]);
  }, []);

  const handleOnboardingComplete = useCallback((charData: RealmCharacterData) => {
    setCharData(charData);
    setShowOnboarding(false);
  }, []);

  const handleSkipLater = useCallback(() => {
    setShowOnboarding(false);
    // Clear invite card dismissal so DashboardRealmInvite re-appears
    try { localStorage.removeItem('lifeos_realm_onboarding_done'); } catch { /* ignore */ }
    navigate('/dashboard');
  }, [navigate]);

  // ── Body class for fullscreen mode (hides app navigation) ──

  useEffect(() => {
    if (fullscreen) {
      document.body.classList.add('realm-fullscreen-active');
      return () => {
        document.body.classList.remove('realm-fullscreen-active');
      };
    }
  }, [fullscreen]);

  // ── Hide AIChat + VoiceFAB when Realm is active ──

  useEffect(() => {
    document.body.classList.add('realm-active');
    return () => document.body.classList.remove('realm-active');
  }, []);

  // ── Resize engine when dialogue toggles (canvas goes 100% ↔ 40%) ──

  useEffect(() => {
    const timer = setTimeout(() => {
      engineRef.current?.resize();
    }, 50);
    return () => clearTimeout(timer);
  }, [dialogue]);

  // ── Portal helper for fullscreen mode ──────────
  // Renders to document.body to escape any CSS stacking context (backdrop-filter etc.)
  const wrap = (children: React.ReactNode) => {
    if (fullscreen) {
      return createPortal(children, document.body);
    }
    return children;
  };

  // ── Render ─────────────────────────────────────

  if (!userId) {
    return wrap(
      <div className={fullscreen ? 'realm-fullscreen-container' : 'realm-container'}>
        <div className="realm-loading">
          <p>Sign in to enter The Realm</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return wrap(
      <div className={fullscreen ? 'realm-fullscreen-container' : 'realm-container'}>
        <div className="realm-loading">
          <div className="realm-loading-spinner" />
          <p>Entering The Realm...</p>
        </div>
      </div>
    );
  }

  if (showOnboarding && userId) {
    return wrap(
      <div className={fullscreen ? 'realm-fullscreen-container' : 'realm-container'}>
        <OnboardingQuest userId={userId} onComplete={handleOnboardingComplete} onSkipLater={handleSkipLater} />
      </div>
    );
  }

  // Container class
  const containerClass = fullscreen ? 'realm-fullscreen-container' : 'realm-container';

  return wrap(
    <div className={`${containerClass}${dialogue ? ' realm-dialogue-active' : ''}`}>
      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        className="realm-canvas"
        onClick={handleCanvasInteraction}
        onTouchStart={handleCanvasInteraction}
      />

      {/* Fullscreen enter transition */}
      {fullscreen && showEnterTransition && (
        <RealmTransition type="enter" onComplete={handleEnterTransitionComplete} />
      )}

      {/* Fullscreen exit transition */}
      {fullscreen && showExitTransition && (
        <RealmTransition type="exit" onComplete={handleExitTransitionComplete} />
      )}

      {/* Portal entry effect (non-fullscreen) */}
      {!fullscreen && showTransition && (
        <>
          <div className="realm-portal-enter" />
          <ZoneTransition
            zoneName="Life Town"
            zoneDescription="The central hub of your journey"
            onComplete={handleTransitionComplete}
          />
        </>
      )}

      {/* Session guard — time tracking + nudges */}
      <RealmSessionGuard
        onNudge={(lines) => {
          if (dialogue) return false; // don't interrupt existing dialogue
          setDialogue({ npcName: 'The Guide', lines });
          return true;
        }}
      />

      {/* HUD overlay */}
      <RealmHUD
        zoneName="Life Town"
        playerLevel={charData?.level || 1}
        playerName={charData?.name || 'Adventurer'}
        questCount={0}
        state={engineState}
        onBack={handleBack}
        onToggleZoom={handleToggleZoom}
        onToggleMusic={handleToggleMusic}
        musicEnabled={musicEnabled}
        onToggleMinimap={handleToggleMinimap}
        minimapVisible={showMinimap}
        onToggleWorldMap={handleToggleWorldMap}
        worldMapOpen={worldMapOpen}
        onToggleChat={handleToggleChat}
        chatVisible={showChat}
        onlineCount={onlineCount}
        onToggleBiomePicker={handleToggleBiomePicker}
        biomePickerOpen={showBiomePicker}
      />

      {/* Minimap */}
      <Minimap
        zone={LIFE_TOWN}
        playerX={engineRef.current?.getPlayerWorldPos?.()?.x ?? 0}
        playerY={engineRef.current?.getPlayerWorldPos?.()?.y ?? 0}
        npcs={LIFE_TOWN.npcs.map(n => ({ tileX: n.tileX, tileY: n.tileY }))}
        portals={LIFE_TOWN.portals.map(p => ({ tileX: p.tileX, tileY: p.tileY, locked: true }))}
        visible={showMinimap}
        onToggle={handleToggleMinimap}
      />

      {/* World Map Overlay */}
      <WorldMap
        visible={worldMapOpen}
        onClose={handleToggleWorldMap}
        currentZone="life_town"
        portals={LIFE_TOWN.portals.map(p => ({ ...p, locked: true }))}
        npcCount={LIFE_TOWN.npcs.length}
      />

      {/* Dialogue */}
      {dialogue && (
        <DialogueBox
          npcName={dialogue.npcName}
          lines={dialogue.lines}
          onClose={handleCloseDialogue}
        />
      )}
      {/* end dialogue */}

      {/* Interactive NPC panel */}
      {activeNPC && createPortal(
        <FeatureErrorBoundary feature="npc-interaction">
          <NPCDialoguePanel
            npcId={activeNPC.id}
            npcName={activeNPC.name}
            greetingLines={activeNPC.lines}
            onClose={handleCloseNPC}
          />
        </FeatureErrorBoundary>,
        document.body
      )}

      {/* Plant info */}
      {selectedPlant && (
        <PlantInfoPanel
          plant={selectedPlant}
          onClose={handleClosePlant}
        />
      )}

      {/* Companion panel */}
      {selectedCompanion && (() => {
        const comp = getCompanionCache();
        if (!comp) return null;
        const species = getFaunaSpecies(comp.species_key, getFaunaCache()) ?? FALLBACK_FAUNA[comp.species_key];
        if (!species) return null;
        return (
          <CompanionPanel
            companion={comp}
            species={species}
            onClose={handleCloseCompanion}
            onName={handleNameCompanion}
          />
        );
      })()}

      {/* Companion progress — show when no companion earned */}
      {!getCompanionCache() && !showOnboarding && (
        <FeatureErrorBoundary feature="Companion Progress" compact>
          <CompanionProgress />
        </FeatureErrorBoundary>
      )}

      {/* Emote radial */}
      <EmoteRadial onEmote={handleEmote} />

      {/* Biome picker */}
      {showBiomePicker && (
        <BiomePicker
          currentBiome={biomeId}
          onSelect={handleSelectBiome}
          onClose={handleToggleBiomePicker}
        />
      )}

      {/* Chat overlay */}
      <ChatOverlay
        visible={showChat}
        onClose={handleToggleChat}
        onSend={handleSendChat}
        messages={chatMessages}
      />

      {/* Remote player profile */}
      {selectedRemotePlayer && (
        <PlayerProfileCard
          player={selectedRemotePlayer}
          onClose={handleCloseProfile}
          onWhisper={() => {
            handleCloseProfile();
            // Whisper is v2 — just close for now
          }}
          onAddFriend={() => {
            handleCloseProfile();
            // Add friend is v2 — just close for now
          }}
        />
      )}

      {/* Feature discovery slides */}
      <SlideTutorial
        tutorialKey={SLIDE_TUTORIALS.realm.key}
        slides={SLIDE_TUTORIALS.realm.slides}
      />

      {/* Quest board */}
      {showQuestBoard && (
        <QuestBoard
          goals={useGoalsStore.getState().goals.map(g => ({
            id: g.id,
            title: g.title || 'Goal',
            status: g.status || 'active',
            progress: 0,
            target_date: (g as any).target_date,
            icon: g.icon,
            color: g.color,
          }))}
          onClose={handleCloseQuestBoard}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────

function getShadowDialogue(entity: DynamicEntity): string[] {
  if (entity.id === 'shadow_procrastination') {
    return [
      'The Procrastination Wraith stirs...',
      entity.subLabel || 'Tasks remain undone.',
      'Complete your overdue tasks to dispel this shadow.',
    ];
  }
  if (entity.id === 'shadow_broken_streak') {
    return [
      'A ghostly presence lingers near the garden...',
      entity.subLabel || 'Some habits have lost their streak.',
      'Log your habits today to weaken this spirit.',
    ];
  }
  return ['A dark presence...', 'Something remains unfinished.'];
}

function getUnlockHint(condition?: string): string {
  switch (condition) {
    case 'journal_entry':
      return 'Write your first journal entry to clear the path.';
    case 'first_goal':
      return 'Create your first goal to forge ahead.';
    case 'health_log':
      return 'Log your health metrics to find this sanctuary.';
    case 'financial_entry':
      return 'Track an expense or income to enter the market.';
    case 'guild_join':
      return 'Join or create a guild to unlock the square.';
    case 'multiplayer_enabled':
      return 'Coming soon — the multiplayer realm where all Life Towns converge.';
    default:
      return 'Continue your journey to discover the way.';
  }
}
