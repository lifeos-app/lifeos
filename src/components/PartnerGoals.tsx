// Partner Goals View Component (for Accountability Partners)

import { useState, useEffect } from 'react';
import { MessageCircle, TrendingUp, Target, Calendar, Flame, Award, Send, Trash2 } from 'lucide-react';
import { getPartnerGoals, getGoalComments, addGoalComment, getWeeklyProgress } from '../lib/social/partner-goals';
import { sendNudge } from '../lib/social/messaging';
import type { PartnerGoal, GoalComment, WeeklyProgress } from '../lib/social/types';
import { showToast } from './Toast';
import './PartnerGoals.css';

interface PartnerGoalsProps {
  userId: string;
  partnerId: string;
  partnerName: string;
  onBack: () => void;
}

export function PartnerGoals({ userId, partnerId, partnerName, onBack }: PartnerGoalsProps) {
  const [goals, setGoals] = useState<PartnerGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [comments, setComments] = useState<GoalComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [partnerProgress, setPartnerProgress] = useState<WeeklyProgress | null>(null);
  const [myProgress, setMyProgress] = useState<WeeklyProgress | null>(null);
  const [sendingNudge, setSendingNudge] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [partnerGoals, pProgress, mProgress] = await Promise.all([
        getPartnerGoals(userId, partnerId),
        getWeeklyProgress(partnerId),
        getWeeklyProgress(userId),
      ]);
      setGoals(partnerGoals);
      setPartnerProgress(pProgress);
      setMyProgress(mProgress);
      setLoading(false);
    };
    void load();
  }, [userId, partnerId]);

  useEffect(() => {
    if (selectedGoalId) {
      const loadComments = async () => {
        const c = await getGoalComments(selectedGoalId);
        setComments(c);
      };
      void loadComments();
    }
  }, [selectedGoalId]);

  const handleSendComment = async () => {
    if (!selectedGoalId || !commentInput.trim() || sendingComment) return;
    setSendingComment(true);
    const comment = await addGoalComment(selectedGoalId, userId, commentInput);
    if (comment) {
      setComments(prev => [...prev, comment]);
      setCommentInput('');
    }
    setSendingComment(false);
  };

  const handleNudge = async (goalId: string, goalTitle: string) => {
    setSendingNudge(true);
    await sendNudge(userId, partnerId, 'encourage', `Keep going on "${goalTitle}"! 💪`);
    showToast('Nudge sent!', '👊', '#00D4FF');
    setSendingNudge(false);
  };

  const selectedGoal = goals.find(g => g.id === selectedGoalId);

  return (
    <div className="partner-goals">
      <div className="partner-goals-header">
        <button className="partner-goals-back" onClick={onBack}>← Back</button>
        <h2 className="partner-goals-title">{partnerName}'s Goals</h2>
      </div>

      {/* Weekly Progress Comparison */}
      {partnerProgress && myProgress && (
        <div className="partner-progress-compare">
          <div className="partner-progress-column">
            <div className="partner-progress-label">Your Week</div>
            <div className="partner-progress-stats">
              <div className="partner-progress-stat">
                <Target size={14} />
                <span>{myProgress.tasks_completed}</span>
                <small>tasks</small>
              </div>
              <div className="partner-progress-stat">
                <Flame size={14} />
                <span>{myProgress.habits_logged}</span>
                <small>habits</small>
              </div>
              <div className="partner-progress-stat">
                <TrendingUp size={14} />
                <span>{myProgress.goals_advanced}</span>
                <small>goals</small>
              </div>
              <div className="partner-progress-stat">
                <Award size={14} />
                <span>{myProgress.xp_gained}</span>
                <small>XP</small>
              </div>
            </div>
          </div>
          <div className="partner-progress-divider" />
          <div className="partner-progress-column">
            <div className="partner-progress-label">{partnerName}'s Week</div>
            <div className="partner-progress-stats">
              <div className="partner-progress-stat">
                <Target size={14} />
                <span>{partnerProgress.tasks_completed}</span>
                <small>tasks</small>
              </div>
              <div className="partner-progress-stat">
                <Flame size={14} />
                <span>{partnerProgress.habits_logged}</span>
                <small>habits</small>
              </div>
              <div className="partner-progress-stat">
                <TrendingUp size={14} />
                <span>{partnerProgress.goals_advanced}</span>
                <small>goals</small>
              </div>
              <div className="partner-progress-stat">
                <Award size={14} />
                <span>{partnerProgress.xp_gained}</span>
                <small>XP</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="partner-goals-loading">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="partner-goals-empty">
          <Target size={32} strokeWidth={1.5} />
          <p>{partnerName} hasn't created any goals yet.</p>
        </div>
      ) : (
        <div className="partner-goals-list">
          {goals.map(goal => {
            const isSelected = selectedGoalId === goal.id;
            const pct = Math.round((goal.progress || 0) * 100);
            return (
              <div key={goal.id} className={`partner-goal-card ${isSelected ? 'selected' : ''}`}>
                <div className="partner-goal-header" onClick={() => setSelectedGoalId(isSelected ? null : goal.id)}>
                  <div className="partner-goal-icon" style={{ background: goal.color || '#00D4FF' }}>
                    {goal.icon || '🎯'}
                  </div>
                  <div className="partner-goal-info">
                    <div className="partner-goal-title">{goal.title}</div>
                    {goal.description && <div className="partner-goal-desc">{goal.description}</div>}
                    <div className="partner-goal-meta">
                      {goal.category && <span className="partner-goal-category">{goal.category}</span>}
                      {goal.target_date && (
                        <span className="partner-goal-date">
                          <Calendar size={10} /> {new Date(goal.target_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="partner-goal-progress-ring" data-pct={pct}>
                    <svg viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={goal.color || '#00D4FF'}
                        strokeWidth="3"
                        strokeDasharray={`${pct}, 100`}
                      />
                      <text x="18" y="20.35" fontSize="10" fill="#FFF" textAnchor="middle" fontWeight="600">
                        {pct}%
                      </text>
                    </svg>
                  </div>
                </div>

                {isSelected && (
                  <div className="partner-goal-detail">
                    <div className="partner-goal-actions">
                      <button
                        className="partner-goal-nudge-btn"
                        onClick={() => handleNudge(goal.id, goal.title)}
                        disabled={sendingNudge}
                      >
                        <Flame size={12} /> {sendingNudge ? 'Sending...' : 'Send Nudge'}
                      </button>
                      <button className="partner-goal-react-btn" onClick={() => showToast('Sent 🔥!', '🔥', '#F97316')}>🔥</button>
                      <button className="partner-goal-react-btn" onClick={() => showToast('Sent 💪!', '💪', '#A855F7')}>💪</button>
                      <button className="partner-goal-react-btn" onClick={() => showToast('Sent 👏!', '👏', '#39FF14')}>👏</button>
                    </div>

                    {/* Comments */}
                    <div className="partner-goal-comments">
                      <div className="partner-goal-comments-header">
                        <MessageCircle size={14} /> Comments
                      </div>
                      <div className="partner-goal-comments-list">
                        {comments.length === 0 ? (
                          <div className="partner-goal-comments-empty">No comments yet</div>
                        ) : (
                          comments.map(c => (
                            <div key={c.id} className="partner-goal-comment">
                              <div className="partner-goal-comment-author">
                                {c.user_profile?.display_name || 'User'}
                              </div>
                              <div className="partner-goal-comment-text">{c.content}</div>
                              <div className="partner-goal-comment-time">
                                {new Date(c.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="partner-goal-comment-input">
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleSendComment();
                            }
                          }}
                        />
                        <button onClick={handleSendComment} disabled={sendingComment || !commentInput.trim()}>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
