// ═══════════════════════════════════════════════════════════
// Junction System — Equip a Wisdom Tradition
// FF8 Guardian Force-inspired spiritual equip screen
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, ArrowLeft, Store } from 'lucide-react';
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
import './Junction.css';

export function Junction() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    userJunction, tradition, traditions, figures,
    xpProgress, loading, equipJunction, unjunction, isEquipped, refresh, switchJunction,
  } = useJunction();

  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showAlphaIntro, setShowAlphaIntro] = useState(false);
  const [alphaSlug, setAlphaSlug] = useState<string | null>(null);

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
