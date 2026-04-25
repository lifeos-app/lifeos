/**
 * WeeklyAssessment — Full-screen assessment overlay for Academy 2.0
 *
 * 5 questions, one per screen with slide animation.
 * Phase gate at 80% pass threshold.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, ChevronRight, CheckCircle, XCircle, Award, BookOpen, RotateCcw } from 'lucide-react';
import { type AssessmentQuestion, type AssessmentResult, gradeAssessment } from '../../lib/assessment-engine';
import { Confetti } from '../Confetti';

// ── Types ──

interface Assessment {
  id: string;
  learningGoalId: string;
  phaseIndex: number;
  questions: AssessmentQuestion[];
  status: 'pending' | 'passed' | 'failed';
  score: number | null;
  answers: Record<string, string>;
  completedAt: string | null;
}

interface WeeklyAssessmentProps {
  assessment: Assessment;
  phase: { title: string; milestoneDescription: string };
  goal: { id: string; topic: string };
  onClose: () => void;
  onPass: (assessmentId: string) => void;
}

// ── Component ──

export function WeeklyAssessment({ assessment, phase, goal, onClose, onPass }: WeeklyAssessmentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [slideDir, setSlideDir] = useState<'enter' | 'exit'>('enter');
  const [showConfetti, setShowConfetti] = useState(false);

  const questions = assessment.questions;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const canProceed = !!answers[currentQuestion?.id];

  const handleSelect = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleNext = useCallback(() => {
    if (isLastQuestion) return;
    setSlideDir('exit');
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSlideDir('enter');
    }, 200);
  }, [isLastQuestion]);

  const handleSubmit = useCallback(() => {
    const graded = gradeAssessment(questions, answers);
    setResult(graded);
    if (graded.passed) {
      setShowConfetti(true);
      setTimeout(() => onPass(assessment.id), 300);
    }
  }, [questions, answers, assessment.id, onPass]);

  const correctCount = useMemo(() => {
    if (!result) return 0;
    return Object.values(result.feedback).filter(f => f.correct).length;
  }, [result]);

  // ── Results Screen ──
  if (result) {
    return (
      <div style={overlayStyle}>
        <div style={panelStyle}>
          {showConfetti && <Confetti />}
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            <X size={20} />
          </button>

          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            {result.passed ? (
              <>
                <Award size={64} color="#D4AF37" style={{ marginBottom: 16 }} />
                <h2 style={{ color: '#4ECB71', fontSize: 28, margin: '0 0 8px' }}>Phase Complete!</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 24px' }}>
                  {phase.title} -- {goal.topic}
                </p>
              </>
            ) : (
              <>
                <BookOpen size={64} color="#F97316" style={{ marginBottom: 16 }} />
                <h2 style={{ color: '#F97316', fontSize: 28, margin: '0 0 8px' }}>Keep going!</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 24px' }}>
                  Review the lessons and try again.
                </p>
              </>
            )}

            {/* Score display */}
            <div style={{
              fontSize: 48, fontWeight: 700, color: result.passed ? '#4ECB71' : '#F97316',
              margin: '0 0 8px',
            }}>
              {correctCount}/{questions.length}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 32 }}>
              {result.score}%
            </div>

            {/* Feedback per question */}
            {!result.passed && (
              <div style={{ textAlign: 'left', marginBottom: 24 }}>
                {questions.map(q => {
                  const fb = result.feedback[q.id];
                  if (!fb || fb.correct) return null;
                  return (
                    <div key={q.id} style={{
                      background: 'rgba(249,115,22,0.08)',
                      border: '1px solid rgba(249,115,22,0.2)',
                      borderRadius: 10, padding: 14, marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <XCircle size={16} color="#F97316" />
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{q.question}</span>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0, paddingLeft: 24 }}>
                        {fb.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {result.passed ? (
                <button onClick={onClose} style={primaryBtnStyle}>
                  Next Phase <ChevronRight size={16} />
                </button>
              ) : (
                <>
                  <button onClick={onClose} style={secondaryBtnStyle}>
                    <BookOpen size={16} /> Review Lessons
                  </button>
                  <button onClick={onClose} style={secondaryBtnStyle}>
                    <RotateCcw size={16} /> Retry Tomorrow
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Question Screen ──
  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
            {phase.title} Assessment
          </p>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, margin: 0 }}>{goal.topic}</h3>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '16px 0' }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i === currentIndex ? '#00D4FF' : answers[q.id] ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.12)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>

        {/* Question */}
        <div style={{
          padding: '0 24px 24px',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          opacity: slideDir === 'exit' ? 0 : 1,
          transform: slideDir === 'exit' ? 'translateX(-20px)' : 'translateX(0)',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 12px',
          }}>
            Question {currentIndex + 1} of {questions.length}
          </p>

          <p style={{
            color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 1.5, margin: '0 0 24px',
          }}>
            {currentQuestion.question}
          </p>

          {/* Options */}
          {currentQuestion.type === 'short_answer' ? (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={e => handleSelect(currentQuestion.id, e.target.value)}
              placeholder="Type your answer..."
              style={{
                width: '100%', minHeight: 100, padding: 14, borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)', fontSize: 14, resize: 'vertical',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(currentQuestion.options || []).map((opt, i) => {
                const isSelected = answers[currentQuestion.id] === opt;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(currentQuestion.id, opt)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: isSelected ? '#00D4FF' : 'rgba(255,255,255,0.8)',
                      fontSize: 14, textAlign: 'left', width: '100%',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: isSelected ? '2px solid #00D4FF' : '2px solid rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <CheckCircle size={14} color="#00D4FF" />}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed}
              style={{
                ...primaryBtnStyle,
                opacity: canProceed ? 1 : 0.4,
                cursor: canProceed ? 'pointer' : 'not-allowed',
              }}
            >
              Submit
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              style={{
                ...primaryBtnStyle,
                opacity: canProceed ? 1 : 0.4,
                cursor: canProceed ? 'pointer' : 'not-allowed',
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const panelStyle: React.CSSProperties = {
  position: 'relative', width: '100%', maxWidth: 520, maxHeight: '90vh',
  overflowY: 'auto', borderRadius: 16,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 16, right: 16, zIndex: 2,
  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: '#00D4FF', color: '#0A1628', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', transition: 'opacity 0.2s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 20px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
};
