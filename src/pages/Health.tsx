import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Heart, Dumbbell, Brain, Moon, Apple, Scale, Activity,
} from 'lucide-react';
import {
  useHealthMetrics, useWorkoutTemplates, useExerciseLogs,
  useBodyMarkers, useMeditation, useGratitude, useGroceryLists, useMeals,
} from '../hooks/useHealth';
import { SparkLine } from '../components/charts';
import { OverviewTab, BodyTab, ExerciseTab, DietTab, MindTab, SleepTab } from './health-tabs';
import type { HealthTab } from './health-tabs';
import '../components/WorkoutGenerator.css';
import { SpotlightTour } from '../components/SpotlightTour';
import { HealthAI } from '../components/ai/HealthAI';
import '../components/nutrition/nutrition.css';
import { useGamificationContext } from '../lib/gamification/context';
import { useScheduleStore } from '../stores/useScheduleStore';
import { FullscreenPage } from '../components/FullscreenPage';
import './Health.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity, color: '#F97316' },
  { id: 'body', label: 'Body', icon: Scale, color: '#00D4FF' },
  { id: 'exercise', label: 'Exercise', icon: Dumbbell, color: '#39FF14' },
  { id: 'diet', label: 'Nutrition', icon: Apple, color: '#FACC15' },
  { id: 'mind', label: 'Mind', icon: Brain, color: '#A855F7' },
  { id: 'sleep', label: 'Sleep', icon: Moon, color: '#818CF8' },
];

const VALID_TABS: HealthTab[] = ['overview', 'body', 'exercise', 'diet', 'mind', 'sleep'];

export function Health() {
  const { awardXP } = useGamificationContext();
  const healthXPRef = useRef(false);
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as HealthTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTab] = useState<HealthTab>(initialTab);
  const prevTabIndex = useRef(VALID_TABS.indexOf(initialTab));
  const [slideDir, setSlideDir] = useState<'left' | 'right' | 'none'>('none');

  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabId as HealthTab;
    const newIndex = VALID_TABS.indexOf(tab);
    const oldIndex = prevTabIndex.current;
    setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
    prevTabIndex.current = newIndex;
    setActiveTab(tab);
  }, []);

  // Sync tab from URL
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      handleTabChange(tabFromUrl);
    }
  }, [tabFromUrl, handleTabChange, activeTab]);

  const { data: metrics, upsertToday: rawUpsertToday } = useHealthMetrics();
  const upsertToday = useCallback(async (...args: Parameters<typeof rawUpsertToday>) => {
    const result = await rawUpsertToday(...args);
    if (!healthXPRef.current) {
      awardXP('health_log', { description: 'Health metrics updated' });
      healthXPRef.current = true;
    }
    return result;
  }, [rawUpsertToday, awardXP]);
  const { templates, saveTemplate, deleteTemplate, syncToSchedule, removeScheduleEvents } = useWorkoutTemplates();
  const { logs: exerciseLogs, logWorkout, updateLog, deleteLog, skipWorkout } = useExerciseLogs();
  const { markers, addMarker, resolveMarker, updateMarker, deleteMarker } = useBodyMarkers();
  const { logs: meditationLogs, logMeditation } = useMeditation();
  const { entries: gratitudeEntries, addGratitude } = useGratitude();
  const { lists: groceryLists } = useGroceryLists();
  const { meals } = useMeals();
  void groceryLists;

  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = metrics.find(m => m.date === today);

  const activeColor = TABS.find(t => t.id === activeTab)?.color || '#F97316';

  return (
    <FullscreenPage
      title="Health"
      titleIcon={<Heart size={16} />}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      slideDir={slideDir}
      activeColor={activeColor}
      contentExtra={
        <HealthAI onTabChange={(tab) => handleTabChange(tab)} />
      }
    >
      {activeTab === 'overview' && (
        <OverviewTab metrics={todayMetrics} exerciseLogs={exerciseLogs}
          meditationLogs={meditationLogs} gratitudeEntries={gratitudeEntries}
          templates={templates} markers={markers} allMetrics={metrics}
          onUpdateMetrics={upsertToday} meals={meals} onTabChange={handleTabChange}
          onSyncToSchedule={syncToSchedule} scheduleEvents={useScheduleStore(s => s.events)} />
      )}
      {activeTab === 'body' && (
        <BodyTab metrics={todayMetrics} allMetrics={metrics} markers={markers}
          onUpdateMetrics={upsertToday} onAddMarker={addMarker} onResolveMarker={resolveMarker}
          onUpdateMarker={updateMarker} onDeleteMarker={deleteMarker} />
      )}
      {activeTab === 'exercise' && (
        <ExerciseTab templates={templates} logs={exerciseLogs}
          onSaveTemplate={saveTemplate} onDeleteTemplate={deleteTemplate}
          onSyncToSchedule={syncToSchedule}
          onLogWorkout={logWorkout} onUpdateLog={updateLog} onDeleteLog={deleteLog}
          onSkipWorkout={skipWorkout} markers={markers} />
      )}
      {activeTab === 'diet' && <DietTab meals={meals} allMetrics={metrics} />}
      {activeTab === 'mind' && (
        <MindTab meditationLogs={meditationLogs} gratitudeEntries={gratitudeEntries}
          onLogMeditation={logMeditation} onAddGratitude={addGratitude}
          todayMetrics={todayMetrics} onUpdateMetrics={upsertToday} allMetrics={metrics} />
      )}
      {activeTab === 'sleep' && (
        <SleepTab metrics={todayMetrics} allMetrics={metrics} onUpdateMetrics={upsertToday} />
      )}

      <SpotlightTour tourId="health" />
    </FullscreenPage>
  );
}
