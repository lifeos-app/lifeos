/**
 * ReviewSummaryCards — Week summary stat cards for the Review page.
 */

import {
  CheckCircle2, Target, Flame, DollarSign, Heart, BookOpen, TrendingUp,
} from 'lucide-react';

interface ReviewSummaryCardsProps {
  taskStats: { completed: number; total: number; rate: number };
  habitStats: { completed: number; totalPossible: number; rate: number };
  goalsProgress: number;
  totalIncome: number;
  avgHealthScore: number;
  journalCount: number;
}

export function ReviewSummaryCards({
  taskStats, habitStats, goalsProgress, totalIncome, avgHealthScore, journalCount,
}: ReviewSummaryCardsProps) {
  return (
    <section className="review-wk-section review-wk-summary">
      <h2 className="review-wk-section-title">
        <TrendingUp size={18} /> Week Summary
      </h2>
      <div className="review-wk-cards">
        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Tasks</span>
            <span className="review-wk-card-value">{taskStats.completed}/{taskStats.total}</span>
            <span className="review-wk-card-rate">{taskStats.rate.toFixed(0)}%</span>
          </div>
        </div>

        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
            <Flame size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Habits</span>
            <span className="review-wk-card-value">{habitStats.completed}/{habitStats.totalPossible}</span>
            <span className="review-wk-card-rate">{habitStats.rate.toFixed(0)}%</span>
          </div>
        </div>

        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }}>
            <Target size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Goals</span>
            <span className="review-wk-card-value">{goalsProgress}%</span>
            <span className="review-wk-card-rate">Avg Progress</span>
          </div>
        </div>

        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(57,255,20,0.1)', color: '#39FF14' }}>
            <DollarSign size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Income</span>
            <span className="review-wk-card-value">${totalIncome.toFixed(0)}</span>
            <span className="review-wk-card-rate">This week</span>
          </div>
        </div>

        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>
            <Heart size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Health</span>
            <span className="review-wk-card-value">{avgHealthScore}/10</span>
            <span className="review-wk-card-rate">Avg Score</span>
          </div>
        </div>

        <div className="review-wk-card">
          <div className="review-wk-card-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
            <BookOpen size={20} />
          </div>
          <div className="review-wk-card-info">
            <span className="review-wk-card-label">Journal</span>
            <span className="review-wk-card-value">{journalCount}</span>
            <span className="review-wk-card-rate">Entries</span>
          </div>
        </div>
      </div>
    </section>
  );
}
