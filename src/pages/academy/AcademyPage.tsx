/**
 * Academy Page — Study Dashboard (thin page component)
 *
 * Composes focused sub-modules from ./academy/ directory.
 * Delegates all view logic to extracted components and the useAcademyPageState hook.
 */

import { Target, BookOpen, Music, Grid3X3, BarChart3 } from 'lucide-react';
import { LessonViewer2 } from '../../components/academy/LessonViewer2';
import { LearningGoalsHub } from '../../components/academy/LearningGoalsHub';
import { MusicPlayer } from '../../components/academy/MusicPlayer';
import { PageErrorBoundary } from '../../components/PageErrorBoundary';
import { useAcademyPageState } from './useAcademyPageState';
import { TabButton } from './TabButton';
import { OverallProgress } from './OverallProgress';
import { CurriculumView } from './CurriculumView';
import { LessonViewer } from './LessonViewer';
import { CheatsheetsView } from './CheatsheetsView';
import { ProgressView } from './ProgressView';
import { LessonsView } from './LessonsView';
import { ChevronLeft } from 'lucide-react';

export function Academy() {
  const {
    view, setView, store,
    lesson2Goal, lesson2Lesson, lesson2Phase,
    openLesson, openLesson2, backToCurriculum,
    navigateLesson2, completeLesson2,
  } = useAcademyPageState();

  return (
    <div role="main" aria-label="Study Academy" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view === 'lesson' && (
              <button onClick={backToCurriculum} style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
                padding: '6px 10px', cursor: 'pointer', color: '#8BA4BE',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
              Study Academy
            </h1>
          </div>
          <div role="tablist" aria-label="Academy sections" style={{ display: 'flex', gap: 4 }}>
            <TabButton active={view === 'goals'} onClick={() => setView('goals')} icon={<Target size={14} />} label="Goals" />
            <TabButton active={view === 'curriculum'} onClick={() => setView('curriculum')} icon={<BookOpen size={14} />} label="Curriculum" />
            <TabButton active={view === 'lessons'} onClick={() => setView('lessons')} icon={<Music size={14} />} label="Lessons" />
            <TabButton active={view === 'cheatsheets'} onClick={() => setView('cheatsheets')} icon={<Grid3X3 size={14} />} label="Cheatsheets" />
            <TabButton active={view === 'progress'} onClick={() => setView('progress')} icon={<BarChart3 size={14} />} label="Progress" />
          </div>
        </div>
        {/* Overall progress bar */}
        <OverallProgress completedLessons={store.completedLessons} />
      </div>

      {/* Content */}
      <div role="tabpanel" aria-label={`${view} content`} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0' }}>
        {view === 'goals' && (
          <LearningGoalsHub />
        )}
        {view === 'curriculum' && (
          <CurriculumView
            completedLessons={store.completedLessons}
            onOpenLesson={openLesson}
          />
        )}
        {view === 'lesson' && store.currentLesson && (
          <LessonViewer
            lessonId={store.currentLesson}
            completedLessons={store.completedLessons}
            onComplete={store.markLessonComplete}
            onUncomplete={store.markLessonIncomplete}
            onNavigate={openLesson}
          />
        )}
        {view === 'lessons' && (
          <LessonsView />
        )}
        {view === 'lesson2' && lesson2Goal && lesson2Lesson && lesson2Phase && (
          <LessonViewer2
            goal={lesson2Goal}
            lesson={lesson2Lesson}
            phase={lesson2Phase}
            onComplete={completeLesson2}
            onBack={backToCurriculum}
            onNavigate={navigateLesson2}
          />
        )}
        {view === 'cheatsheets' && (
          <CheatsheetsView
            activeId={store.activeCheatsheet}
            onSelect={store.setActiveCheatsheet}
          />
        )}
        {view === 'progress' && (
          <ProgressView
            completedLessons={store.completedLessons}
            studyStreak={store.studyStreak}
            totalStudyTime={store.totalStudyTime}
          />
        )}
      </div>

      {/* Music Player — wrapped in error boundary for safety */}
      <PageErrorBoundary pageName="MusicPlayer">
        <MusicPlayer />
      </PageErrorBoundary>
    </div>
  );
}

export default Academy;