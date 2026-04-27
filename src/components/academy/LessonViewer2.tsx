/**
 * LessonViewer2 — Two-column lesson + TutorBot layout
 *
 * Left panel: lesson content with breadcrumb, meta bar, markdown.
 * Right panel: TutorBot AI sidebar (~35% width).
 * Mobile: TutorBot hidden by default with toggle button.
 */

import { useState, useEffect } from 'react';
import {
  ChevronRight, Clock, Zap, CheckCircle2, Check,
  ArrowLeft, ArrowRight, Bot, X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TutorBot } from './TutorBot';
import { PhaseProgressBar } from './PhaseProgressBar';
import { showToast } from '../Toast';
import type { TutorMode } from '../../lib/llm/academy-tutor';

// ── Local types (inline per spec) ────────────────────────────────────

type CurriculumLesson = {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  estimatedMinutes: number;
  phaseIndex: number;
  completedAt: string | null;
  xpReward: number;
};

type LearningGoal = {
  id: string;
  topic: string;
  domain: string;
  currentLevel: string;
  curriculum: {
    phases: { title: string; topics: { lessons: CurriculumLesson[] }[] }[];
  } | null;
  [key: string]: unknown;
};

// ── Props ────────────────────────────────────────────────────────────

interface LessonViewer2Props {
  goal: LearningGoal;
  lesson: CurriculumLesson;
  phase: { title: string; topics: { lessons: CurriculumLesson[] }[] };
  onComplete: () => void;
  onBack: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

// ── Component ────────────────────────────────────────────────────────

export function LessonViewer2({
  goal,
  lesson,
  phase,
  onComplete,
  onBack,
  onNavigate,
}: LessonViewer2Props) {
  const [activeMode, setActiveMode] = useState<TutorMode>('chat');
  const [showTutor, setShowTutor] = useState(true);

  // Compute progress info
  const allPhaseLessons = phase.topics.flatMap((t) => t.lessons);
  const completedCount = allPhaseLessons.filter((l) => l.completedAt !== null).length;
  const currentLessonIndex = allPhaseLessons.findIndex((l) => l.id === lesson.id);
  const phaseIndex = lesson.phaseIndex;
  const isComplete = lesson.completedAt !== null;

  // Check mobile (simple width check)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Hide tutor by default on mobile
  useEffect(() => {
    if (isMobile) setShowTutor(false);
  }, [isMobile]);

  const handleMarkComplete = () => {
    if (isComplete) return;
    // TODO: When useAcademyStore2 exists, call:
    // useAcademyStore2.getState().completeLesson(goal.id, lesson.id);
    showToast(`+${lesson.xpReward} XP — ${lesson.title} complete!`, '\u2B50', '#D4AF37');
    onComplete();
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 0,
      gap: 0,
    }}>
      {/* ── Left: Lesson Content ── */}
      <div style={{
        flex: 2,
        overflowY: 'auto',
        padding: '20px 24px 24px',
        minWidth: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{
          fontSize: 12, color: '#5A7A9A', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: '#00D4FF',
              cursor: 'pointer', fontSize: 12, padding: 0,
              display: 'flex', alignItems: 'center', gap: 2,
            }}
          >
            <ArrowLeft size={12} /> Goals
          </button>
          <ChevronRight size={12} />
          <span>{goal.topic}</span>
          <ChevronRight size={12} />
          <span>{phase.title}</span>
          <ChevronRight size={12} />
          <span style={{ color: '#C0C0C0' }}>{lesson.title}</span>
        </div>

        {/* Title + meta bar */}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
          {lesson.title}
        </h2>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          {/* Estimated time pill */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            fontSize: 12, color: '#8BA4BE',
          }}>
            <Clock size={11} /> ~{lesson.estimatedMinutes}min
          </span>

          {/* XP pill */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 12,
            background: 'rgba(212,175,55,0.1)',
            fontSize: 12, color: '#D4AF37', fontWeight: 600,
          }}>
            <Zap size={11} /> {lesson.xpReward} XP
          </span>

          {/* Phase pill */}
          <span style={{
            padding: '3px 10px', borderRadius: 12,
            background: 'rgba(0,212,255,0.08)',
            fontSize: 12, color: '#00D4FF',
          }}>
            Phase {phaseIndex + 1}
          </span>

          {/* Mobile tutor toggle */}
          {isMobile && (
            <button
              onClick={() => setShowTutor((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 12,
                background: showTutor ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.06)',
                border: showTutor ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
                fontSize: 12, color: showTutor ? '#00D4FF' : '#8BA4BE',
                cursor: 'pointer',
              }}
            >
              <Bot size={11} /> Tutor
            </button>
          )}
        </div>

        {/* Phase progress */}
        <div style={{ marginBottom: 20 }}>
          <PhaseProgressBar
            totalLessons={allPhaseLessons.length}
            completedCount={completedCount}
            currentLessonIndex={currentLessonIndex >= 0 ? currentLessonIndex : 0}
          />
        </div>

        {/* Lesson content (markdown) */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 12,
          padding: '24px 28px',
          border: '1px solid rgba(255,255,255,0.06)',
          lineHeight: 1.7,
          fontSize: 15,
          color: '#D0D0D0',
          marginBottom: 20,
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
            {lesson.content}
          </ReactMarkdown>
        </div>

        {/* Key points */}
        {lesson.keyPoints.length > 0 && (
          <div style={{
            background: 'rgba(212,175,55,0.05)',
            border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D4AF37', marginBottom: 8 }}>
              Key Points
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lesson.keyPoints.map((kp, i) => (
                <li key={i} style={{ fontSize: 13, color: '#C0C0C0', marginBottom: 4 }}>{kp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation + Complete */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)',
          gap: 12, flexWrap: 'wrap',
        }}>
          {onNavigate ? (
            <button
              onClick={() => onNavigate('prev')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#8BA4BE', cursor: 'pointer', fontSize: 13,
              }}
            >
              <ArrowLeft size={14} /> Prev
            </button>
          ) : <div />}

          <button
            onClick={handleMarkComplete}
            disabled={isComplete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              borderRadius: 8, border: 'none', cursor: isComplete ? 'default' : 'pointer',
              fontWeight: 600, fontSize: 13,
              background: isComplete ? 'rgba(57,255,20,0.15)' : 'rgba(0,212,255,0.15)',
              color: isComplete ? '#39FF14' : '#00D4FF',
              opacity: isComplete ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {isComplete
              ? <><Check size={16} /> Completed</>
              : <><CheckCircle2 size={16} /> Mark Complete</>
            }
          </button>

          {onNavigate ? (
            <button
              onClick={() => onNavigate('next')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)',
                background: 'rgba(0,212,255,0.08)', color: '#00D4FF',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : <div />}
        </div>
      </div>

      {/* ── Right: TutorBot Sidebar ── */}
      {showTutor && (
        <div style={{
          flex: 1,
          minWidth: 280,
          maxWidth: isMobile ? '100%' : 420,
          height: '100%',
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : undefined,
          right: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          zIndex: isMobile ? 100 : undefined,
          background: isMobile ? '#0A1628' : undefined,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={() => setShowTutor(false)}
              style={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                width: 28, height: 28, borderRadius: 6,
                background: 'rgba(255,255,255,0.06)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#8BA4BE', cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
          <TutorBot
            goal={goal}
            lesson={lesson}
            activeMode={activeMode}
            onModeChange={setActiveMode}
          />
        </div>
      )}
    </div>
  );
}
