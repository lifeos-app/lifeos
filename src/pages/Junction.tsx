// ═══════════════════════════════════════════════════════════
// Junction System — Equip a Wisdom Tradition
// FF8 Guardian Force-inspired spiritual equip screen
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, ArrowLeft, Wand2, X, HelpCircle, ChevronDown, ChevronUp, Store } from 'lucide-react';
import { useJunction } from '../hooks/useJunction';
import { SpotlightTour, isTourComplete, markTourComplete } from '../components/SpotlightTour';
import { SlideTutorial } from '../components/SlideTutorial';
import { SLIDE_TUTORIALS } from '../components/tutorials';
import { JunctionAI } from '../components/ai/JunctionAI';
import { PageHeader } from '../components/ui/PageHeader';
import { JunctionSkeleton } from '../components/skeletons';
import JunctionTutorial from './JunctionTutorial';
import { TraditionSelector, JunctionDashboard, FaithPathsNetwork, AlphaIntro } from '../components/junction';
import { JunctionMarketplace } from '../components/junction/JunctionMarketplace';
import { getJunctionRecommendations, type Recommendation, type UserProfileInput, type HabitInput } from '../lib/junction-recommender';
import { useUserStore } from '../stores/useUserStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import './Junction.css';

// ── Hermes Recommends Panel ──────────────────────────────────────

const HERMES_DISMISSED_KEY = 'lifeos_hermes_recs_dismissed';

function HermesRecommendsPanel({
  recommendations,
  onAccept,
  onDismiss,
}: {
  recommendations: Recommendation[];
  onAccept: (traditionId: string, pathId: string | null, slug: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [expandedTooltip, setExpandedTooltip] = useState<string | null>(null);

  if (recommendations.length === 0) return null;

  return (
    <div style={{
      background: '#0F2D4A',
      border: '1px solid #1A3A5C',
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle accent glow */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #00D4FF22, #00D4FF08)',
            border: '1px solid #00D4FF44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Wand2 size={16} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 13,
              fontWeight: 700,
              color: '#00D4FF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>Hermes Recommends</div>
            <div style={{ fontSize: 12, color: '#5A7A9A', fontStyle: 'italic' }}>
              Paths aligned with your journey
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss recommendations"
          style={{
            background: 'none',
            border: 'none',
            color: '#5A7A9A',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#8BA4BE')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5A7A9A')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Recommendation cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recommendations.map((rec) => (
          <div
            key={rec.tradition.slug}
            style={{
              background: 'rgba(5, 14, 26, 0.6)',
              border: '1px solid rgba(26, 58, 92, 0.6)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'border-color 0.2s, background 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#1A3A5C';
              e.currentTarget.style.background = 'rgba(15, 45, 74, 0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(26, 58, 92, 0.6)';
              e.currentTarget.style.background = 'rgba(5, 14, 26, 0.6)';
            }}
          >
            {/* Tradition icon / emoji */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${rec.tradition.color}22, ${rec.tradition.color}08)`,
              border: `1px solid ${rec.tradition.color}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              {rec.tradition.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#ffffff',
                }}>
                  {rec.tradition.name}
                </span>
                {/* Score badge */}
                <span style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 10,
                  color: '#00D4FF',
                  background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  letterSpacing: '0.04em',
                }}>
                  {rec.score}% match
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#8BA4BE', marginBottom: 4 }}>
                {rec.reason}
              </div>

              {/* Why this? tooltip toggle */}
              <button
                onClick={() => setExpandedTooltip(expandedTooltip === rec.tradition.slug ? null : rec.tradition.slug)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#5A7A9A',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 0',
                  fontFamily: "'Poppins', sans-serif",
                  fontStyle: 'italic',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00D4FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5A7A9A')}
              >
                <HelpCircle size={11} />
                Why this?
                {expandedTooltip === rec.tradition.slug ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {/* Tooltip detail */}
              {expandedTooltip === rec.tradition.slug && (
                <div style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  background: 'rgba(0, 212, 255, 0.06)',
                  border: '1px solid rgba(0, 212, 255, 0.15)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#8BA4BE',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  {rec.detail}
                </div>
              )}
            </div>

            {/* Accept button */}
            <button
              onClick={() => onAccept(rec.tradition.id, rec.tradition.paths?.[0]?.id ?? null, rec.tradition.slug)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 8,
                color: '#00D4FF',
                fontFamily: "'Poppins', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.22)';
                e.currentTarget.style.borderColor = '#00D4FF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
              }}
            >
              Accept
            </button>
          </div>
        ))}
      </div>

      {/* Hermetic quote */}
      <div style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid rgba(26, 58, 92, 0.5)',
        textAlign: 'center',
        fontSize: 11,
        fontStyle: 'italic',
        color: '#5A7A9A',
        fontFamily: "'Poppins', sans-serif",
        letterSpacing: '0.02em',
      }}>
        "As above, so below — the path chooses the traveler as much as the traveler chooses the path."
      </div>
    </div>
  );
}

// ── Main Junction page ──────────────────────────────────────────

export function Junction() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    userJunction, tradition, traditions, figures,
    xpProgress, loading, equipJunction, unjunction, isEquipped, refresh, switchJunction,
  } = useJunction();

  // Hermes Recommends state
  const [dismissedRecs, setDismissedRecs] = useState(() => {
    try { return sessionStorage.getItem(HERMES_DISMISSED_KEY) === 'true'; } catch { return false; }
  });

  const profile = useUserStore(s => s.profile);
  const { habits } = useHabitsStore();

  // Compute recommendations based on user profile + habits
  const recommendations: Recommendation[] = useMemo(() => {
    const profileInput: UserProfileInput = {
      primary_focus: profile?.primary_focus ?? null,
      occupation: profile?.occupation ?? null,
      preferences: (profile?.preferences ?? null) as Record<string, unknown> | null,
    };
    const habitInputs: HabitInput[] = habits.map(h => ({
      title: h.title || '',
      icon: h.icon ?? undefined,
      frequency: h.frequency ?? undefined,
    }));
    return getJunctionRecommendations(profileInput, habitInputs, traditions.length > 0 ? traditions : undefined);
  }, [profile?.primary_focus, profile?.occupation, profile?.preferences, habits, traditions]);

  // Show panel when: not equipped AND not dismissed
  const showHermesPanel = !isEquipped && !dismissedRecs;

  const handleDismissHermes = useCallback(() => {
    setDismissedRecs(true);
    try { sessionStorage.setItem(HERMES_DISMISSED_KEY, 'true'); } catch { /* Safari private */ }
  }, []);

  const handleAcceptRecommendation = useCallback(async (traditionId: string, pathId: string | null, slug: string) => {
    await equipJunction(traditionId, pathId);
    markTourComplete('junction');
    setAlphaSlug(slug);
    setShowAlphaIntro(true);
  }, [equipJunction]);

  const [showAlphaIntro, setShowAlphaIntro] = useState(false);
  const [alphaSlug, setAlphaSlug] = useState<string | null>(null);

  const [showMarketplace, setShowMarketplace] = useState(false);

  const [tutorialDone, setTutorialDone] = useState(() => isTourComplete('junction'));

  const handleTutorialComplete = useCallback(() => {
    markTourComplete('junction');
    setTutorialDone(true);
  }, []);

  const handleTutorialSkip = useCallback(() => {
    markTourComplete('junction');
    setTutorialDone(true);
  }, []);

  const handleEquipWithIntro = useCallback(async (traditionId: string, pathId: string | null, slug: string) => {
    await equipJunction(traditionId, pathId);
    markTourComplete('junction');
    setTutorialDone(true);
    setAlphaSlug(slug);
    setShowAlphaIntro(true);
  }, [equipJunction]);

  const closeAlphaIntro = useCallback(() => {
    setShowAlphaIntro(false);
    setAlphaSlug(null);
    refresh();
  }, [refresh]);

  if (loading) return <JunctionSkeleton />;

  if (!isEquipped && !tutorialDone) {
    return (
      <JunctionTutorial
        traditions={traditions}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
      />
    );
  }

  const showBackButton = location.pathname.startsWith('/character/');

  return (
    <div className="junction-page">
      {showBackButton && (
        <button
          onClick={() => navigate('/character')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 12,
            background: 'rgba(15, 45, 74, 0.4)', border: '1px solid rgba(26, 58, 92, 0.6)',
            borderRadius: 8, color: '#8BA4BE', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} /> Back to Character
        </button>
      )}
      <PageHeader
        title="Junction System"
        icon={<Sparkles size={22} />}
        subtitle="Equip a wisdom tradition to guide your path"
        centered
      />

      <JunctionAI />

      {/* Junction / Marketplace tab toggle */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 4,
        maxWidth: 320,
        margin: '0 auto 20px',
      }}>
        <button
          onClick={() => setShowMarketplace(false)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            background: !showMarketplace ? 'rgba(0,212,255,0.12)' : 'transparent',
            border: !showMarketplace ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
            borderRadius: 8,
            color: !showMarketplace ? '#00D4FF' : 'rgba(255,255,255,0.5)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Sparkles size={14} /> My Junction
        </button>
        <button
          onClick={() => setShowMarketplace(true)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            background: showMarketplace ? 'rgba(0,212,255,0.12)' : 'transparent',
            border: showMarketplace ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
            borderRadius: 8,
            color: showMarketplace ? '#00D4FF' : 'rgba(255,255,255,0.5)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Store size={14} /> Marketplace
        </button>
      </div>

      {showMarketplace ? (
        <JunctionMarketplace />
      ) : !isEquipped ? (
        <>
          {/* Hermes Recommends Panel — shown when no Junction is equipped */}
          {showHermesPanel && (
            <HermesRecommendsPanel
              recommendations={recommendations}
              onAccept={handleAcceptRecommendation}
              onDismiss={handleDismissHermes}
            />
          )}

          <div className="jnc-tut-selector-intro">
            <p>You've taken your first step. Now choose the path you'll walk.</p>
          </div>
          <TraditionSelector traditions={traditions} onEquip={handleEquipWithIntro} />
        </>
      ) : (
        <JunctionDashboard
          userJunction={userJunction!}
          tradition={tradition!}
          figures={figures}
          xpProgress={xpProgress}
          onUnjunction={unjunction}
          onRefresh={refresh}
          onSwitchJunction={switchJunction}
        />
      )}

      <FaithPathsNetwork equippedSlug={tradition?.slug} />

      {showAlphaIntro && alphaSlug && (
        <AlphaIntro slug={alphaSlug} onClose={closeAlphaIntro} />
      )}

      <SpotlightTour tourId="junction" />
      <SlideTutorial
        tutorialKey={SLIDE_TUTORIALS.junction.key}
        slides={SLIDE_TUTORIALS.junction.slides}
      />
    </div>
  );
}

export default Junction;
