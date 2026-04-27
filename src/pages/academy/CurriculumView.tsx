/**
 * CurriculumView — Expandable phase/topic/lesson tree for the Academy curriculum.
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { PHASES } from '../../data/academy-manifest';

export function CurriculumView({ completedLessons, onOpenLesson }: {
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
              aria-expanded={isExpanded}
              aria-label={`${phase.name} phase, ${percent}% complete, ${done} of ${total} lessons`}
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
                        aria-expanded={isTopicExpanded}
                        aria-label={`${topic.name} topic, ${topicDone} of ${topicTotal} lessons`}
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
                                aria-label={`${lesson.title}, ${isComplete ? 'completed' : 'not completed'}, ${lesson.estimatedMinutes} minutes`}
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