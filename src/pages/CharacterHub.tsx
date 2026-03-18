import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Swords, Scroll, BarChart3, Shield, Sparkles, Castle,
} from 'lucide-react';
import { OverviewTab, QuestsTab, StatsTab } from './character-tabs';
import type { CharacterTab } from './character-tabs';
import { FullscreenPage } from '../components/FullscreenPage';
import { SpotlightTour } from '../components/SpotlightTour';
import { useUserStore } from '../stores/useUserStore';
import './CharacterHub.css';

const Junction = lazy(() => import('./Junction').then(m => ({ default: m.Junction })));
const EquipmentTab = lazy(() => import('./health-tabs/EquipmentTab').then(m => ({ default: m.EquipmentTab })));
const RealmEntry = lazy(() => import('../realm/RealmEntry').then(m => ({ default: m.RealmEntry })));
const OnboardingQuest = lazy(() => import('../realm/onboarding/OnboardingQuest').then(m => ({ default: m.OnboardingQuest })));

const CHARACTER_TABS = [
  { id: 'overview', label: 'Overview', icon: Swords, color: '#F97316' },
  { id: 'quests', label: 'Quests', icon: Scroll, color: '#EAB308' },
  { id: 'stats', label: 'Stats', icon: BarChart3, color: '#39FF14' },
  { id: 'equipment', label: 'Equipment', icon: Shield, color: '#A855F7' },
  { id: 'junction', label: 'Junction', icon: Sparkles, color: '#F43F5E' },
  { id: 'realm', label: 'Realm', icon: Castle, color: '#FFD700' },
];

const VALID_TABS: CharacterTab[] = CHARACTER_TABS.map(t => t.id) as CharacterTab[];

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 48, gap: 12,
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.1)',
        borderTopColor: 'var(--accent-cyan)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13 }}>Loading...</span>
    </div>
  );
}

export function CharacterHub() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabFromUrl = searchParams.get('tab') as CharacterTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTab] = useState<CharacterTab>(initialTab);
  const prevTabIndex = useRef(VALID_TABS.indexOf(initialTab));
  const [slideDir, setSlideDir] = useState<'left' | 'right' | 'none'>('none');

  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabId as CharacterTab;
    const newIndex = VALID_TABS.indexOf(tab);
    const oldIndex = prevTabIndex.current;
    setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
    prevTabIndex.current = newIndex;
    setActiveTab(tab);
    // Use navigate instead of setSearchParams — navigate has stable identity
    // while setSearchParams changes on every URL change in React Router v7
    navigate(tab === 'overview' ? '/character' : `/character?tab=${tab}`, { replace: true });
  }, [navigate]);

  const handleRealmExit = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Sync tab from URL when navigating externally
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      const newIndex = VALID_TABS.indexOf(tabFromUrl);
      const oldIndex = prevTabIndex.current;
      setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
      prevTabIndex.current = newIndex;
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  const isRealm = activeTab === 'realm';
  const activeColor = CHARACTER_TABS.find(t => t.id === activeTab)?.color || '#F97316';

  // Realm is gated behind completing the realm tutorial (onboarding quest)
  const profile = useUserStore(s => s.profile);
  const user = useUserStore(s => s.user);
  const refreshProfile = useUserStore(s => s.fetchProfile);
  const prefs = (profile?.preferences || {}) as Record<string, any>;
  // If realm_tutorial_complete is explicitly true, OR if the user has saved
  // onboarding progress (meaning they clicked "Later" mid-quest), let RealmEntry
  // handle it — RealmEntry checks for an existing rpg_characters row and only
  // shows onboarding if the character doesn't exist yet.
  const realmTutorialComplete = prefs.realm_tutorial_complete === true;

  return (
    <FullscreenPage
      title="Character"
      titleIcon={<Swords size={16} />}
      tabs={CHARACTER_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      slideDir={slideDir}
      activeColor={activeColor}
      chromeHidden={isRealm}
    >
      {/* Tab content */}
      {!isRealm && (
        <>
          {activeTab === 'overview' && <OverviewTab onTabChange={handleTabChange} />}
          {activeTab === 'quests' && <QuestsTab />}
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'equipment' && (
            <Suspense fallback={<LoadingFallback />}>
              <div className="tab-embedded"><EquipmentTab /></div>
            </Suspense>
          )}
          {activeTab === 'junction' && (
            <Suspense fallback={<LoadingFallback />}>
              <div className="tab-embedded"><Junction /></div>
            </Suspense>
          )}
        </>
      )}

      {/* Realm — gated behind tutorial completion */}
      {isRealm && realmTutorialComplete && (
        <Suspense fallback={<LoadingFallback />}>
          <RealmEntry fullscreen onExit={handleRealmExit} />
        </Suspense>
      )}

      {/* Realm tutorial — shown if user hasn't completed the onboarding quest */}
      {isRealm && !realmTutorialComplete && user && (
        <Suspense fallback={<LoadingFallback />}>
          <OnboardingQuest
            userId={user.id}
            onComplete={async () => {
              refreshProfile();
            }}
            onSkipLater={() => {
              // Go back to overview — realm stays locked until quest is completed
              handleTabChange('overview');
            }}
          />
        </Suspense>
      )}

      <SpotlightTour tourId="gamification" />
    </FullscreenPage>
  );
}
