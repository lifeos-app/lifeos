import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BookOpen, FileText, BarChart3, Inbox, BookMarked,
} from 'lucide-react';
import { OverviewTab } from './reflect-tabs';
import type { ReflectTab } from './reflect-tabs';
import { FullscreenPage } from '../components/FullscreenPage';
import { JournalSkeleton, InboxSkeleton, StorySkeleton, PageSkeleton } from '../components/skeletons';
import './ReflectHub.css';

const Journal = lazy(() => import('./Journal').then(m => ({ default: m.Journal })));
const Review = lazy(() => import('./Review').then(m => ({ default: m.Review })));
const InboxPage = lazy(() => import('./InboxPage').then(m => ({ default: m.InboxPage })));
const Story = lazy(() => import('./Story').then(m => ({ default: m.Story })));

const REFLECT_TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen, color: '#EC4899' },
  { id: 'journal', label: 'Journal', icon: FileText, color: '#00D4FF' },
  { id: 'review', label: 'Review', icon: BarChart3, color: '#39FF14' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, color: '#A855F7' },
  { id: 'story', label: 'Story', icon: BookMarked, color: '#EAB308' },
];

const VALID_TABS: ReflectTab[] = REFLECT_TABS.map(t => t.id) as ReflectTab[];

export function ReflectHub() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabFromUrl = searchParams.get('tab') as ReflectTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTab] = useState<ReflectTab>(initialTab);
  const prevTabIndex = useRef(VALID_TABS.indexOf(initialTab));
  const [slideDir, setSlideDir] = useState<'left' | 'right' | 'none'>('none');

  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabId as ReflectTab;
    const newIndex = VALID_TABS.indexOf(tab);
    const oldIndex = prevTabIndex.current;
    setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
    prevTabIndex.current = newIndex;
    setActiveTab(tab);
    navigate(tab === 'overview' ? '/reflect' : `/reflect?tab=${tab}`, { replace: true });
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

  const activeColor = REFLECT_TABS.find(t => t.id === activeTab)?.color || '#EC4899';

  return (
    <FullscreenPage
      title="Reflect"
      titleIcon={<BookOpen size={16} />}
      tabs={REFLECT_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      slideDir={slideDir}
      activeColor={activeColor}
    >
      {activeTab === 'overview' && <OverviewTab onTabChange={(t: ReflectTab) => handleTabChange(t)} />}
      {activeTab === 'journal' && (
        <Suspense fallback={<JournalSkeleton />}>
          <div className="tab-embedded"><Journal /></div>
        </Suspense>
      )}
      {activeTab === 'review' && (
        <Suspense fallback={<PageSkeleton />}>
          <div className="tab-embedded"><Review /></div>
        </Suspense>
      )}
      {activeTab === 'inbox' && (
        <Suspense fallback={<InboxSkeleton />}>
          <div className="tab-embedded"><InboxPage /></div>
        </Suspense>
      )}
      {activeTab === 'story' && (
        <Suspense fallback={<StorySkeleton />}>
          <div className="tab-embedded"><Story /></div>
        </Suspense>
      )}
    </FullscreenPage>
  );
}
