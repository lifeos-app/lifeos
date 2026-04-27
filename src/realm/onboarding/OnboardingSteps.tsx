/**
 * OnboardingSteps — Individual step rendering components
 *
 * Contains the interactive step UI elements used during onboarding:
 * - ESBI path selection cards
 * - Industry/class selection cards
 * - Motivation pill buttons
 * - Reveal scene display (messages + forging animation + error)
 */

import { MOTIVATION_OPTIONS, ESBI_CARD_DATA } from './templateFallback';
import type { ConversationMessage } from './OnboardingLLM';
import type { UseOnboardingQuestReturn } from './useOnboardingQuest';
import { assetPath } from '../../utils/assets';
import { INDUSTRIES } from '../../rpg/data/industries';

// ── ESBI Path Cards (path_selection scene) ──

interface EsbiCardsProps {
  onPick: (id: string) => void;
  disabled: boolean;
}

export function EsbiCards({ onPick, disabled }: EsbiCardsProps) {
  return (
    <div className="realm-onboarding-esbi-cards">
      {ESBI_CARD_DATA.map(card => (
        <button
          key={card.id}
          className="realm-onboarding-esbi-card"
          onClick={() => onPick(card.id)}
          disabled={disabled}
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

// ── Industry Cards (identity scene) ──

interface IndustryCardsProps {
  onPick: (id: string) => void;
  disabled: boolean;
}

export function IndustryCards({ onPick, disabled }: IndustryCardsProps) {
  return (
    <div className="realm-onboarding-class-cards">
      {INDUSTRIES.map(ind => (
        <button
          key={ind.id}
          className="realm-onboarding-class-card"
          onClick={() => onPick(ind.id)}
          disabled={disabled}
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

// ── Motivation Pills (awakening scene fallback) ──

interface MotivationPillsProps {
  onPick: (value: string) => void;
  disabled: boolean;
}

export function MotivationPills({ onPick, disabled }: MotivationPillsProps) {
  return (
    <div className="realm-onboarding-pills">
      {MOTIVATION_OPTIONS.map(opt => (
        <button
          key={opt}
          className="realm-onboarding-pill"
          onClick={() => onPick(opt)}
          disabled={disabled}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Reveal Scene ──

interface RevealSceneProps {
  messages: ConversationMessage[];
  isCreatingData: boolean;
  createError: boolean;
  onRetry: () => void;
}

export function RevealScene({ messages, isCreatingData, createError, onRetry }: RevealSceneProps) {
  return (
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
          <p>Something went wrong. <button onClick={onRetry} style={{ color: '#D4AF37', background: 'none', border: '1px solid #D4AF37', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button></p>
        </div>
      )}
    </div>
  );
}

// ── Fallback UI resolver ──
// Determines which step component to render based on scene and data

interface FallbackUIResolverProps {
  state: UseOnboardingQuestReturn;
}

export function FallbackUI({ state }: FallbackUIResolverProps) {
  const { scene, isThinking, handleSend, extractedData, useFallback } = state;

  // path_selection is always card-based
  if (scene === 'path_selection') {
    return <EsbiCards onPick={handleSend} disabled={isThinking} />;
  }

  // identity: show industry cards before class is set
  if (scene === 'identity' && !extractedData.characterClass) {
    return <IndustryCards onPick={handleSend} disabled={isThinking} />;
  }

  if (!useFallback) return undefined;

  // awakening: show pills only before motivation is set
  if (scene === 'awakening' && !extractedData.motivation) {
    return <MotivationPills onPick={handleSend} disabled={isThinking} />;
  }

  return undefined;
}