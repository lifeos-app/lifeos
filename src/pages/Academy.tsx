/**
 * Academy Page — Study Dashboard
 *
 * Full study dashboard with curriculum view, lesson reader,
 * progress tracking, cheatsheets, and integrated music player.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, Check, Clock, BookOpen, Award,
  Flame, ArrowLeft, ArrowRight, CheckCircle2, Grid3X3, BarChart3,
  ChevronLeft, Zap, Trophy,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAcademyStore } from '../stores/useAcademyStore';
import { MusicPlayer } from '../components/academy/MusicPlayer';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { readAcademyFile } from '../lib/academy-data';
import {
  PHASES, CHEATSHEETS, getAllLessons, getTotalLessonCount,
  getTotalEstimatedMinutes, findLesson, getAdjacentLessons,
  type AcademyPhase, type AcademyTopic, type AcademyLesson,
} from '../data/academy-manifest';

type AcademyView = 'curriculum' | 'lesson' | 'cheatsheets' | 'progress';

export function Academy() {
  const [view, setView] = useState<AcademyView>('curriculum');
  const store = useAcademyStore();

  // Hydrate from localStorage on mount
  useEffect(() => {
    store.hydrate();
  }, []);

  // Start study session tracking
  useEffect(() => {
    store.startStudySession(store.currentLesson);
    return () => { store.endStudySession(); };
  }, []);

  const openLesson = (lessonId: string) => {
    store.setCurrentLesson(lessonId);
    setView('lesson');
  };

  const backToCurriculum = () => {
    store.setCurrentLesson(null);
    setView('curriculum');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
          <div style={{ display: 'flex', gap: 4 }}>
            <TabButton active={view === 'curriculum'} onClick={() => setView('curriculum')} icon={<BookOpen size={14} />} label="Curriculum" />
            <TabButton active={view === 'cheatsheets'} onClick={() => setView('cheatsheets')} icon={<Grid3X3 size={14} />} label="Cheatsheets" />
            <TabButton active={view === 'progress'} onClick={() => setView('progress')} icon={<BarChart3 size={14} />} label="Progress" />
          </div>
        </div>
        {/* Overall progress bar */}
        <OverallProgress completedLessons={store.completedLessons} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0' }}>
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

// ── Tab Button ──

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
      borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
      background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
      color: active ? '#00D4FF' : '#8BA4BE',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {icon} {label}
    </button>
  );
}

// ── Overall Progress ──

function OverallProgress({ completedLessons }: { completedLessons: string[] }) {
  const total = getTotalLessonCount();
  const done = completedLessons.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)', marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#8BA4BE' }}>Overall Progress</span>
          <span style={{ fontSize: 12, color: '#00D4FF', fontWeight: 600 }}>
            {done}/{total} lessons · {percent}%
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
          <div style={{
            width: `${percent}%`, height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#5A7A9A', whiteSpace: 'nowrap' }}>
        ~{Math.round(getTotalEstimatedMinutes() / 60)}h total
      </div>
    </div>
  );
}

// ── Curriculum View ──

function CurriculumView({ completedLessons, onOpenLesson }: {
  completedLessons: string[]; onOpenLesson: (id: string) => void;
}) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>('foundations');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
      {PHASES.map(phase => {
        const phaseLessons = phase.topics.flatMap(t => t.lessons);
        const done = phaseLessons.filter(l => completedLessons.includes(l.id)).length;
        const total = phaseLessons.length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        const isExpanded = expandedPhase === phase.id;

        return (
          <div key={phase.id} style={{
            borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {/* Phase Header */}
            <button
              onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 16px', border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${phase.color}08, ${phase.color}04)`,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 24 }}>{phase.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                  {phase.name}
                </div>
                <div style={{ fontSize: 12, color: '#8BA4BE' }}>
                  {phase.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: phase.color }}>
                    {percent}%
                  </div>
                  <div style={{ fontSize: 11, color: '#5A7A9A' }}>
                    {done}/{total}
                  </div>
                </div>
                {/* Mini progress ring */}
                <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={14} cy={14} r={11} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
                  <circle cx={14} cy={14} r={11} fill="none" stroke={phase.color} strokeWidth={3}
                    strokeDasharray={`${percent * 0.69} 69`}
                    strokeLinecap="round"
                  />
                </svg>
                {isExpanded ? <ChevronDown size={16} color="#8BA4BE" /> : <ChevronRight size={16} color="#8BA4BE" />}
              </div>
            </button>

            {/* Topics */}
            {isExpanded && (
              <div style={{ padding: '4px 8px 8px' }}>
                {phase.topics.map(topic => {
                  const topicDone = topic.lessons.filter(l => completedLessons.includes(l.id)).length;
                  const topicTotal = topic.lessons.length;
                  const isTopicExpanded = expandedTopic === topic.id;

                  return (
                    <div key={topic.id} style={{ marginBottom: 2 }}>
                      <button
                        onClick={() => setExpandedTopic(isTopicExpanded ? null : topic.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '10px 12px', border: 'none', borderRadius: 8,
                          background: isTopicExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {isTopicExpanded ? <ChevronDown size={14} color="#8BA4BE" /> : <ChevronRight size={14} color="#8BA4BE" />}
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#E0E0E0', flex: 1 }}>
                          {topic.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#5A7A9A' }}>
                          {topicDone}/{topicTotal}
                        </span>
                        {/* Mini progress bar */}
                        <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{
                            width: `${topicTotal > 0 ? (topicDone / topicTotal) * 100 : 0}%`,
                            height: '100%', background: phase.color, borderRadius: 2,
                          }} />
                        </div>
                      </button>

                      {/* Lessons */}
                      {isTopicExpanded && (
                        <div style={{ paddingLeft: 28, paddingBottom: 4 }}>
                          {topic.lessons.map(lesson => {
                            const isComplete = completedLessons.includes(lesson.id);
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => onOpenLesson(lesson.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                  padding: '8px 10px', border: 'none', borderRadius: 6,
                                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                }}
                              >
                                {isComplete ? (
                                  <CheckCircle2 size={16} color="#39FF14" />
                                ) : (
                                  <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.15)',
                                  }} />
                                )}
                                <span style={{
                                  fontSize: 13, flex: 1,
                                  color: isComplete ? '#5A7A9A' : '#C0C0C0',
                                  textDecoration: isComplete ? 'line-through' : 'none',
                                }}>
                                  {lesson.title}
                                </span>
                                <span style={{ fontSize: 11, color: '#5A7A9A', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={10} /> {lesson.estimatedMinutes}m
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Lesson Viewer ──

function LessonViewer({ lessonId, completedLessons, onComplete, onUncomplete, onNavigate }: {
  lessonId: string;
  completedLessons: string[];
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const found = findLesson(lessonId);
  const { prev, next } = getAdjacentLessons(lessonId);
  const isComplete = completedLessons.includes(lessonId);

  useEffect(() => {
    if (!found) return;
    setLoading(true);
    readAcademyFile(found.lesson.path).then(md => {
      setContent(md);
      setLoading(false);
    });
  }, [lessonId]);

  if (!found) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8BA4BE' }}>Lesson not found.</div>;
  }

  const { phase, topic, lesson } = found;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 24 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#5A7A9A', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: phase.color }}>{phase.icon} {phase.name}</span>
        <ChevronRight size={12} />
        <span>{topic.name}</span>
        <ChevronRight size={12} />
        <span style={{ color: '#C0C0C0' }}>{lesson.title}</span>
      </div>

      {/* Lesson Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            {lesson.title}
          </h2>
          <div style={{ fontSize: 13, color: '#5A7A9A', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> ~{lesson.estimatedMinutes} min read
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} color="#FACC15" /> +10 XP
            </span>
          </div>
        </div>
        <button
          onClick={() => isComplete ? onUncomplete(lessonId) : onComplete(lessonId)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: isComplete ? 'rgba(57,255,20,0.15)' : 'rgba(0,212,255,0.15)',
            color: isComplete ? '#39FF14' : '#00D4FF',
            transition: 'all 0.15s',
          }}
        >
          {isComplete ? <><Check size={16} /> Completed</> : <><CheckCircle2 size={16} /> Mark Complete</>}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#5A7A9A' }}>
          Loading lesson...
        </div>
      ) : (
        <div className="academy-lesson-content" style={{
          background: 'rgba(255,255,255,0.02)', borderRadius: 12,
          padding: '24px 28px', border: '1px solid rgba(255,255,255,0.06)',
          lineHeight: 1.7, fontSize: 15, color: '#D0D0D0',
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 32, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E0E0E0', marginTop: 28, marginBottom: 10 }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: 17, fontWeight: 600, color: '#C0C0C0', marginTop: 24, marginBottom: 8 }}>{children}</h3>,
              p: ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" style={{ color: '#00D4FF', textDecoration: 'none' }}>{children}</a>,
              ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 12 }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 12 }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
              blockquote: ({ children }) => (
                <blockquote style={{
                  borderLeft: '3px solid #00D4FF', paddingLeft: 16, margin: '16px 0',
                  color: '#8BA4BE', fontStyle: 'italic',
                }}>
                  {children}
                </blockquote>
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code style={{
                      background: 'rgba(0,212,255,0.1)', color: '#00D4FF',
                      padding: '2px 6px', borderRadius: 4, fontSize: '0.9em',
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className} style={{
                    display: 'block', background: '#0A1628', padding: '16px 20px',
                    borderRadius: 8, overflowX: 'auto', fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineHeight: 1.6, border: '1px solid rgba(255,255,255,0.06)',
                    color: '#E0E0E0',
                  }} {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <pre style={{ margin: '16px 0', background: 'transparent' }}>{children}</pre>,
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: 13,
                  }}>
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th style={{
                  textAlign: 'left', padding: '8px 12px',
                  borderBottom: '2px solid rgba(255,255,255,0.1)',
                  color: '#00D4FF', fontWeight: 600, fontSize: 12,
                }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td style={{
                  padding: '6px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  {children}
                </td>
              ),
              hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '24px 0' }} />,
              strong: ({ children }) => <strong style={{ color: '#fff', fontWeight: 600 }}>{children}</strong>,
              em: ({ children }) => <em style={{ color: '#8BA4BE' }}>{children}</em>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 20,
        paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {prev ? (
          <button onClick={() => onNavigate(prev.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#8BA4BE', cursor: 'pointer', fontSize: 13,
          }}>
            <ArrowLeft size={14} /> {prev.title}
          </button>
        ) : <div />}
        {next ? (
          <button onClick={() => onNavigate(next.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
            background: 'rgba(0,212,255,0.08)', color: '#00D4FF', cursor: 'pointer', fontSize: 13,
          }}>
            {next.title} <ArrowRight size={14} />
          </button>
        ) : <div />}
      </div>
    </div>
  );
}

// ── Cheatsheets View ──

function CheatsheetsView({ activeId, onSelect }: {
  activeId: string | null; onSelect: (id: string | null) => void;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    const cs = CHEATSHEETS.find(c => c.id === activeId);
    if (!cs) return;
    setLoading(true);
    readAcademyFile(cs.path).then(md => { setContent(md); setLoading(false); });
  }, [activeId]);

  if (activeId) {
    const cs = CHEATSHEETS.find(c => c.id === activeId);
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => onSelect(null)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
          borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
          color: '#8BA4BE', cursor: 'pointer', marginBottom: 16, fontSize: 13,
        }}>
          <ChevronLeft size={14} /> All Cheatsheets
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          {cs?.icon} {cs?.title} Cheatsheet
        </h2>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#5A7A9A' }}>Loading...</div>
        ) : (
          <div className="academy-lesson-content" style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: 12,
            padding: '24px 28px', border: '1px solid rgba(255,255,255,0.06)',
            lineHeight: 1.7, fontSize: 14, color: '#D0D0D0',
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 24, marginBottom: 10 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E0E0E0', marginTop: 20, marginBottom: 8 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, color: '#C0C0C0', marginTop: 16, marginBottom: 6 }}>{children}</h3>,
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) return <code style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', padding: '1px 5px', borderRadius: 3, fontSize: '0.9em', fontFamily: "'JetBrains Mono', monospace" }}>{children}</code>;
                  return <code className={className} style={{ display: 'block', background: '#0A1628', padding: '12px 16px', borderRadius: 8, overflowX: 'auto', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.06)', color: '#E0E0E0' }} {...props}>{children}</code>;
                },
                pre: ({ children }) => <pre style={{ margin: '12px 0', background: 'transparent' }}>{children}</pre>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" style={{ color: '#00D4FF' }}>{children}</a>,
                table: ({ children }) => <div style={{ overflowX: 'auto', marginBottom: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table></div>,
                th: ({ children }) => <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid rgba(255,255,255,0.1)', color: '#00D4FF', fontWeight: 600 }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{children}</td>,
                strong: ({ children }) => <strong style={{ color: '#fff' }}>{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
        Quick Reference Cheatsheets
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {CHEATSHEETS.map(cs => (
          <button
            key={cs.id}
            onClick={() => onSelect(cs.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg, ${cs.color}10, ${cs.color}05)`,
              border: `1px solid ${cs.color}30`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 32 }}>{cs.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E0E0E0' }}>
              {cs.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Progress View ──

function ProgressView({ completedLessons, studyStreak, totalStudyTime }: {
  completedLessons: string[]; studyStreak: number; totalStudyTime: number;
}) {
  const total = getTotalLessonCount();
  const done = completedLessons.length;
  const xpEarned = done * 10;

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Stats Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        <StatCard icon={<BookOpen size={18} />} label="Lessons Completed" value={`${done}/${total}`} color="#00D4FF" />
        <StatCard icon={<Flame size={18} />} label="Study Streak" value={`${studyStreak} days`} color="#F97316" />
        <StatCard icon={<Clock size={18} />} label="Time Studied" value={`${Math.round(totalStudyTime / 60)}h ${totalStudyTime % 60}m`} color="#A855F7" />
        <StatCard icon={<Zap size={18} />} label="XP Earned" value={`${xpEarned} XP`} color="#FACC15" />
        <StatCard icon={<Trophy size={18} />} label="Completion" value={`${total > 0 ? Math.round((done / total) * 100) : 0}%`} color="#39FF14" />
        <StatCard icon={<Award size={18} />} label="Phases Done" value={`${PHASES.filter(p => p.topics.flatMap(t => t.lessons).every(l => completedLessons.includes(l.id))).length}/6`} color="#D4AF37" />
      </div>

      {/* Phase Breakdown */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
        Phase Progress
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHASES.map(phase => {
          const phaseLessons = phase.topics.flatMap(t => t.lessons);
          const phaseDone = phaseLessons.filter(l => completedLessons.includes(l.id)).length;
          const phaseTotal = phaseLessons.length;
          const phasePercent = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

          return (
            <div key={phase.id} style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#E0E0E0' }}>
                  {phase.icon} {phase.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: phase.color }}>
                  {phaseDone}/{phaseTotal} · {phasePercent}%
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{
                  width: `${phasePercent}%`, height: '100%', borderRadius: 3,
                  background: phase.gradient,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: `linear-gradient(135deg, ${color}08, ${color}04)`,
      border: `1px solid ${color}20`,
    }}>
      <div style={{ color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8BA4BE' }}>{label}</div>
    </div>
  );
}

export default Academy;
