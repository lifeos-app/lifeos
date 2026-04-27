/**
 * OnboardingUI — Main UI shell for OnboardingQuest
 *
 * Renders the structural layout:
 * - Close / Later button with two-step confirmation
 * - Progress dots
 * - Scene canvas with particles and characters
 * - Scene transition overlay
 * - Character creation panel overlay
 * - Dialogue area (delegated to SageDialogue or RevealScene)
 */

import { SageDialogue } from './SageDialogue';
import { StageCanvas, type ParticleThemeConfig } from '../../components/stage/StageCanvas';
import { CharacterCreationPanel } from '../../components/stage/CharacterCreationPanel';
import { NPC_APPEARANCES } from '../../components/stage/npc-appearances';
import type { StageCharacter } from '../../components/stage/types';
import { RevealScene, FallbackUI } from './OnboardingSteps';
import type { UseOnboardingQuestReturn } from './useOnboardingQuest';
import { SCENES, CLASS_PARTICLE_COLORS } from './useOnboardingQuest';
import { useMemo } from 'react';

// ── Scene particle configurations for StageCanvas ──

const SCENE_PARTICLE_THEMES: Record<string, ParticleThemeConfig> = {
  awakening: { colors: ['#444', '#666', '#888'], speed: 0.3, life: 180, size: 2, type: 'dot', gravity: -0.005, rate: 0.2 },
  path_selection: { colors: ['#FFD700', '#fff', '#FFC107'], speed: 0.3, life: 150, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  identity: { colors: ['#FFD700', '#FFC107', '#FFB300'], speed: 0.3, life: 200, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  first_seed: { colors: ['#27ae60', '#2ecc71', '#82e0aa'], speed: 0.6, life: 100, size: 2, type: 'dot', gravity: -0.015, rate: 0.4, emitFromBottom: true },
  the_dream: { colors: ['#e74c3c', '#f39c12', '#FFD700'], speed: 1.5, life: 50, size: 2, type: 'glow', gravity: -0.04, rate: 0.5 },
  first_words: { colors: ['#6c5ce7', '#a29bfe', '#4B0082'], speed: 0.3, life: 180, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  reveal: { colors: ['#FFD700', '#FFC107', '#fff'], speed: 2, life: 80, size: 3, type: 'glow', gravity: -0.01, rate: 2 },
};

// ── Props ──

export interface OnboardingUIProps {
  state: UseOnboardingQuestReturn;
}

// ── Component ──

export function OnboardingUI({ state }: OnboardingUIProps) {
  const {
    scene,
    sceneIndex,
    sceneTransition,
    messages,
    isThinking,
    extractedData,
    showCharacterCreation,
    isCreatingData,
    createError,
    laterConfirm,
    laterLoading,
    inputMode,
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
    createAllData,
    fallbackConfig,
  } = state;

  // Whether to show Sage on stage
  const showSage = scene !== 'reveal' && scene !== 'path_selection';

  // ── Stage characters for StageCanvas ──

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
    if (scene === 'identity' && extractedData.characterClass && CLASS_PARTICLE_COLORS[extractedData.characterClass]) {
      return { ...base, colors: CLASS_PARTICLE_COLORS[extractedData.characterClass] };
    }
    return base;
  }, [scene, extractedData.characterClass]);

  // ── Reveal burst ──

  const revealBurst = useMemo(() => {
    if (scene !== 'reveal') return null;
    return {
      x: 0.5,
      y: 0.5,
      count: 50,
      config: { colors: ['#FFD700', '#FFC107', '#fff', '#D4AF37'], speed: 4, life: 100, size: 3, type: 'glow' as const, gravity: 0.02 },
    };
  }, [scene]);

  // ── Fallback UI (step components) ──

  const fallbackUI = <FallbackUI state={state} />;

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
          <button className="realm-onboarding-later-btn" onClick={state.handleCompleteLater} disabled={laterLoading}>
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
        <RevealScene
          messages={messages}
          isCreatingData={isCreatingData}
          createError={createError}
          onRetry={createAllData}
        />
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