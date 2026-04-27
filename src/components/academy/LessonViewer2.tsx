/**
 * LessonViewer2 — Renders a single curriculum lesson with markdown content.
 */

import { useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Check, Clock, Zap, ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAcademyStore2 } from '../../stores/useAcademyStore2';
import { showToast } from '../Toast';
import type { LearningGoal, CurriculumLesson } from '../../types/academy';

interface LessonViewer2Props {
  goal: LearningGoal;
  lesson: CurriculumLesson;
  onComplete: () => void;
  onBack: () => void;
}

export function LessonViewer2({ goal, lesson, onComplete, onBack }: LessonViewer2Props) {
  const [completing, setCompleting] = useState(false);
  const completeLesson = useAcademyStore2(s => s.completeLesson);
  const isComplete = !!lesson.completedAt;

  // Find phase and topic for breadcrumb
  let phaseName = '';
  let topicName = '';
  if (goal.curriculum) {
    for (const phase of goal.curriculum.phases) {
      for (const topic of phase.topics) {
        if (topic.lessons.some(l => l.id === lesson.id)) {
          phaseName = phase.title;
          topicName = topic.title;
        }
      }
    }
  }

  const handleComplete = async () => {
    if (isComplete || completing) return;
    setCompleting(true);
    try {
      await completeLesson(goal.id, lesson.id);
      showToast(`+${lesson.xpReward} XP earned!`, '\u26A1', '#FACC15');
      onComplete();
    } catch {
      showToast('Failed to complete lesson', '\u26A0\uFE0F', '#F43F5E');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 24 }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.06)', color: '#8BA4BE',
          cursor: 'pointer', fontSize: 13, marginBottom: 12,
        }}
      >
        <ArrowLeft size={14} /> Back to Curriculum
      </button>

      {/* Breadcrumb */}
      <div style={{
        fontSize: 12, color: '#5A7A9A', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ color: '#00D4FF' }}>{goal.topic}</span>
        <ChevronRight size={12} />
        <span>{phaseName}</span>
        <ChevronRight size={12} />
        <span>{topicName}</span>
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            {lesson.title}
          </h2>
          <div style={{
            fontSize: 13, color: '#5A7A9A', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> ~{lesson.estimatedMinutes} min
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} color="#FACC15" /> +{lesson.xpReward} XP
            </span>
          </div>
        </div>
      </div>

      {/* Key Points */}
      {lesson.keyPoints.length > 0 && (
        <div style={{
          background: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#00D4FF', marginBottom: 8 }}>
            Key Points
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {lesson.keyPoints.map((kp, i) => (
              <li key={i} style={{ fontSize: 13, color: '#D0D0D0', marginBottom: 4, lineHeight: 1.5 }}>
                {kp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content */}
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

      {/* Mark Complete */}
      <div style={{
        display: 'flex', justifyContent: 'center', marginTop: 24,
        paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={handleComplete}
          disabled={isComplete || completing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 10, border: 'none',
            fontSize: 15, fontWeight: 600, cursor: isComplete ? 'default' : 'pointer',
            background: isComplete
              ? 'rgba(57,255,20,0.15)'
              : 'linear-gradient(135deg, #00D4FF, #0088CC)',
            color: isComplete ? '#39FF14' : '#fff',
            opacity: completing ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          {isComplete ? (
            <><Check size={18} /> Completed</>
          ) : completing ? (
            'Completing...'
          ) : (
            <><CheckCircle2 size={18} /> Mark Complete</>
          )}
        </button>
      </div>
    </div>
  );
}
