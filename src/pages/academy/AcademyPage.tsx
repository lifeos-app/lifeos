/**
 * Academy Page — Expanded Study Academy with integrated education system.
 *
 * Tabs: Paths | Cards | Challenges | Tutor | Lessons | Cheatsheets | Progress
 * Composes the new education components (FlashCardReview, LearningPathView,
 * ChallengePlayer, TutorChat) alongside existing music player and curriculum.
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { 
  Map, BookOpen, Zap, GraduationCap, Music, Grid3X3, BarChart3, 
  Target, ChevronLeft, Bot, Sparkles 
} from 'lucide-react';
import { useAcademyStore } from '../../stores/useAcademyStore';
import { useKnowledgeStore, STUDY_DECKS } from '../../stores/useKnowledgeStore';
import { LEARNING_PATHS, getPathBySlug } from '../../data/learning-paths';
import { educationManifest } from '../../lib/education-manifest';
import { getDailyPrinciple } from '../../lib/hermetic-integration';
import { PageErrorBoundary } from '../../components/PageErrorBoundary';
import { TabButton } from './TabButton';
import { OverallProgress } from './OverallProgress';
import { CurriculumView } from './CurriculumView';
import { LessonViewer } from './LessonViewer';
import { CheatsheetsView } from './CheatsheetsView';
import { ProgressView } from './ProgressView';
import { LessonsView } from './LessonsView';
import { MusicPlayer } from '../../components/academy/MusicPlayer';
import { LearningGoalsHub } from '../../components/academy/LearningGoalsHub';
import { LessonViewer2 } from '../../components/academy/LessonViewer2';
import { useAcademyPageState } from './useAcademyPageState';

// Lazy-load heavy education components
const FlashCardReview = lazy(() => import('../../components/education/FlashCardReview').then(m => ({ default: m.FlashCardReview })));
const LearningPathView = lazy(() => import('../../components/education/LearningPathView').then(m => ({ default: m.LearningPathView })));
const ChallengePlayer = lazy(() => import('../../components/education/ChallengePlayer').then(m => ({ default: m.ChallengePlayer })));
const TutorChat = lazy(() => import('../../components/education/TutorChat').then(m => ({ default: m.TutorChat })));

const PRINCIPLE_COLORS = ['#A855F7','#06B6D4','#F97316','#EC4899','#39FF14','#FACC15','#D4AF37'];
const PRINCIPLE_NAMES = ['Mentalism','Correspondence','Vibration','Polarity','Rhythm','Cause & Effect','Gender'];

type AcademyView = 'paths' | 'cards' | 'challenges' | 'tutor' | 'goals' | 'curriculum' | 'lesson' | 'lesson2' | 'lessons' | 'cheatsheets' | 'progress';

export function Academy() {
  const {
    view: oldView, setView: oldSetView, store,
    lesson2Goal, lesson2Lesson, lesson2Phase,
    openLesson, openLesson2, backToCurriculum,
    navigateLesson2, completeLesson2,
  } = useAcademyPageState();

  // Map old state to new view system, default to 'paths'
  const [view, setView] = useState<AcademyView>('paths');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activePathSlug, setActivePathSlug] = useState<string | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);
  const [completedNodes, setCompletedNodes] = useState<string[]>([]);

  const { cards, fetchAll, getDueCount, getCardsByDeck } = useKnowledgeStore();
  const principle = getDailyPrinciple();

  // Load cards on mount
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Education stats
  const totalCards = cards.length;
  const dueCards = getDueCount();
  const stats = educationManifest.getStats();

  // ── Sub-views ──

  // Flashcard review for a specific deck
  if (activeDeckId && view === 'cards') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#5A7A9A]">Loading...</div>}>
          <FlashCardReview
            deckId={activeDeckId}
            onClose={() => setActiveDeckId(null)}
            onComplete={(s) => console.log('[academy] Card review complete:', s)}
          />
        </Suspense>
      </div>
    );
  }

  // Challenge player
  if (activeChallenges.length > 0 && view === 'challenges') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#5A7A9A]">Loading...</div>}>
          <ChallengePlayer
            challenges={activeChallenges}
            onComplete={(results) => {
              console.log('[academy] Challenges complete:', results);
              setActiveChallenges([]);
            }}
            onBack={() => setActiveChallenges([])}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div role="main" aria-label="Study Academy" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
              Academy
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${PRINCIPLE_COLORS[principle?.index ?? 4]}15`, 
                       color: PRINCIPLE_COLORS[principle?.index ?? 4],
                       border: `1px solid ${PRINCIPLE_COLORS[principle?.index ?? 4]}30` }}>
              {PRINCIPLE_NAMES[principle?.index ?? 4]}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: '#0F2D4A', border: '1px solid #1A3A5C' }}>
            <div className="text-xs text-[#5A7A9A]">Cards</div>
            <div className="text-sm font-bold text-white">{totalCards}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: dueCards > 0 ? '#F97316/10' : '#0F2D4A', border: `1px solid ${dueCards > 0 ? '#F97316/30' : '#1A3A5C'}` }}>
            <div className="text-xs text-[#5A7A9A]">Due</div>
            <div className="text-sm font-bold" style={{ color: dueCards > 10 ? '#F43F5E' : dueCards > 0 ? '#F97316' : '#39FF14' }}>{dueCards}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: '#0F2D4A', border: '1px solid #1A3A5C' }}>
            <div className="text-xs text-[#5A7A9A]">Paths</div>
            <div className="text-sm font-bold text-white">{stats.totalPaths}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: '#0F2D4A', border: '1px solid #1A3A5C' }}>
            <div className="text-xs text-[#5A7A9A]">Challenges</div>
            <div className="text-sm font-bold text-white">{stats.totalChallenges}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Academy sections" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 8, marginTop: 4 }}>
          <TabButton active={view === 'paths'} onClick={() => setView('paths')} icon={<Map size={14} />} label="Paths" />
          <TabButton active={view === 'cards'} onClick={() => setView('cards')} icon={<BookOpen size={14} />} label="Cards" />
          <TabButton active={view === 'challenges'} onClick={() => setView('challenges')} icon={<Zap size={14} />} label="Challenges" />
          <TabButton active={view === 'tutor'} onClick={() => setView('tutor')} icon={<Bot size={14} />} label="Tutor" />
          <TabButton active={view === 'goals'} onClick={() => setView('goals')} icon={<Target size={14} />} label="Goals" />
          <TabButton active={view === 'curriculum'} onClick={() => setView('curriculum')} icon={<Sparkles size={14} />} label="Curriculum" />
          <TabButton active={view === 'lessons'} onClick={() => setView('lessons')} icon={<Music size={14} />} label="Music" />
          <TabButton active={view === 'cheatsheets'} onClick={() => setView('cheatsheets')} icon={<Grid3X3 size={14} />} label="Sheets" />
          <TabButton active={view === 'progress'} onClick={() => setView('progress')} icon={<BarChart3 size={14} />} label="Progress" />
        </div>
      </div>

      {/* Content */}
      <div role="tabpanel" aria-label={`${view} content`} style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 0' }}>
        
        {/* ── Learning Paths ── */}
        {view === 'paths' && !activePathSlug && (
          <div className="space-y-3">
            {LEARNING_PATHS.map((path) => {
              const principleColor = path.hermeticPrinciple != null ? PRINCIPLE_COLORS[path.hermeticPrinciple] : '#00D4FF';
              const principleName = path.hermeticPrinciple != null ? PRINCIPLE_NAMES[path.hermeticPrinciple] : null;
              const nodeCount = Object.keys(path.nodes).length;
              
              return (
                <button
                  key={path.id}
                  onClick={() => setActivePathSlug(path.slug)}
                  className="w-full text-left p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: `linear-gradient(135deg, ${principleColor}08, #0F2D4A)`, border: `1px solid ${principleColor}25` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0 mt-1">{path.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white">{path.title}</h3>
                        {principleName && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{ backgroundColor: `${principleColor}20`, color: principleColor }}>
                            {principleName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8BA4BE] line-clamp-2 mt-1">{path.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#5A7A9A]">
                        <span>{nodeCount} nodes</span>
                        <span>{path.totalEstimatedHours}h est.</span>
                        <span>{path.totalChallenges} challenges</span>
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-[#5A7A9A] rotate-180 mt-2" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {view === 'paths' && activePathSlug && (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#5A7A9A]">Loading path...</div>}>
            <LearningPathView
              path={getPathBySlug(activePathSlug)!}
              completedNodes={completedNodes}
              onNodeSelect={(nodeId) => {
                // Could open challenges or card review for this node
                const path = getPathBySlug(activePathSlug)!;
                const node = path.nodes[nodeId];
                if (node?.challengeIds && node.challengeIds.length > 0) {
                  const challenges = educationManifest.getAllChallenges().filter(c => node.challengeIds!.includes(c.id));
                  if (challenges.length > 0) {
                    setActiveChallenges(challenges);
                    setView('challenges');
                  }
                }
              }}
              onBack={() => setActivePathSlug(null)}
            />
          </Suspense>
        )}

        {/* ── Card Decks ── */}
        {view === 'cards' && !activeDeckId && (
          <div className="space-y-3">
            {STUDY_DECKS.map((deck) => {
              const deckCards = getCardsByDeck(deck.id);
              const dueInDeck = deckCards.filter(c => c.state === 'new' || (c.due && c.due <= Date.now())).length;
              const newInDeck = deckCards.filter(c => c.state === 'new').length;
              
              return (
                <button
                  key={deck.id}
                  onClick={() => setActiveDeckId(deck.id)}
                  className="w-full text-left p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: '#0F2D4A', border: `1px solid ${deck.color}30` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${deck.color}15`, border: `1px solid ${deck.color}30` }}>
                      {/* Icon placeholder */}
                      {deck.icon === 'Sparkles' && '✨'}
                      {deck.icon === 'Server' && '🖥️'}
                      {deck.icon === 'Code' && '💻'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{deck.name}</h3>
                      <p className="text-xs text-[#8BA4BE] mt-0.5">{deck.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                        <span className="text-[#5A7A9A]">{deckCards.length} cards</span>
                        {newInDeck > 0 && <span style={{ color: '#00D4FF' }}>{newInDeck} new</span>}
                        {dueInDeck > 0 && <span style={{ color: '#F97316' }}>{dueInDeck} due</span>}
                      </div>
                    </div>
                    {dueInDeck > 0 && (
                      <div className="px-2 py-1 rounded-lg text-xs font-bold" 
                        style={{ backgroundColor: dueInDeck > 10 ? '#F43F5E20' : '#F97316015', color: dueInDeck > 10 ? '#F43F5E' : '#F97316' }}>
                        {dueInDeck}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            
            {/* Quick Study All Due */}
            {dueCards > 0 && (
              <button
                onClick={() => setActiveDeckId('all')}
                className="w-full p-3 rounded-xl text-center transition-all hover:scale-[1.01]"
                style={{ backgroundColor: '#00D4FF15', border: '1px solid #00D4FF40', color: '#00D4FF' }}
              >
                <div className="font-semibold">Study All Due Cards</div>
                <div className="text-xs opacity-70">{dueCards} cards ready for review</div>
              </button>
            )}
          </div>
        )}

        {/* ── Challenges ── */}
        {view === 'challenges' && activeChallenges.length === 0 && (
          <div className="space-y-3">
            {LEARNING_PATHS.map(path => {
              const challenges = educationManifest.getChallengesByHermeticPrinciple(path.hermeticPrinciple ?? 0);
              if (challenges.length === 0) return null;
              const principleColor = path.hermeticPrinciple != null ? PRINCIPLE_COLORS[path.hermeticPrinciple] : '#00D4FF';
              
              return (
                <div key={path.id} className="rounded-xl p-4" style={{ backgroundColor: '#0F2D4A', border: `1px solid ${principleColor}25` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{path.icon}</span>
                      <h3 className="text-sm font-semibold text-white">{path.title}</h3>
                    </div>
                    <span className="text-xs text-[#5A7A9A]">{challenges.length} challenges</span>
                  </div>
                  <div className="space-y-1.5">
                    {challenges.slice(0, 3).map(ch => (
                      <div key={ch.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#050E1A]/50">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: principleColor }} />
                        <span className="text-xs text-[#8BA4BE]">{ch.title}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" 
                          style={{ backgroundColor: `${ch.difficulty === 'beginner' ? '#39FF14' : ch.difficulty === 'intermediate' ? '#F97316' : '#F43F5E'}15`,
                                   color: ch.difficulty === 'beginner' ? '#39FF14' : ch.difficulty === 'intermediate' ? '#F97316' : '#F43F5E' }}>
                          {ch.difficulty}
                        </span>
                      </div>
                    ))}
                    {challenges.length > 3 && (
                      <div className="text-xs text-[#5A7A9A] text-center">+ {challenges.length - 3} more</div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveChallenges(challenges)}
                    className="w-full mt-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: `${principleColor}15`, border: `1px solid ${principleColor}30`, color: principleColor }}>
                    Start Challenges
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── AI Tutor ── */}
        {view === 'tutor' && (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#5A7A9A]">Loading tutor...</div>}>
            <TutorChat hermeticPrinciple={principle?.index} />
          </Suspense>
        )}

        {/* ── Existing tabs ── */}
        {view === 'goals' && <LearningGoalsHub />}
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
        {view === 'lessons' && <LessonsView />}
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

      {/* Music Player */}
      <PageErrorBoundary pageName="MusicPlayer">
        <MusicPlayer />
      </PageErrorBoundary>
    </div>
  );
}

export { Academy as default };