/**
 * LessonViewer — V1 lesson viewer with markdown rendering and prev/next navigation.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { findLesson, getAdjacentLessons } from '../../data/academy-manifest';
import { readAcademyFile } from '../../lib/academy-data';

export function LessonViewer({ lessonId, completedLessons, onComplete, onUncomplete, onNavigate }: {
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
          aria-label={isComplete ? 'Mark as incomplete' : 'Mark as complete'}
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
          <button onClick={() => onNavigate(prev.id)} aria-label={`Previous lesson: ${prev.title}`} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#8BA4BE', cursor: 'pointer', fontSize: 13,
          }}>
            <ArrowLeft size={14} /> {prev.title}
          </button>
        ) : <div />}
        {next ? (
          <button onClick={() => onNavigate(next.id)} aria-label={`Next lesson: ${next.title}`} style={{
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