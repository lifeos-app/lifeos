/**
 * StudyDashboard — compact education stats widget for embedding in main Dashboard.
 * Shows due card count, streak, forecast, and quick-start buttons.
 */
import { useMemo } from 'react';
import { BookOpen, Zap, Flame, TrendingUp, ChevronRight } from 'lucide-react';
import { useKnowledgeStore, STUDY_DECKS } from '../../stores/useKnowledgeStore';
import { getForecast } from '../../lib/srs-engine';
import { LEARNING_PATHS } from '../../data/learning-paths';

interface StudyDashboardProps {
  onNavigateToAcademy: () => void;
}

export function StudyDashboard({ onNavigateToAcademy }: StudyDashboardProps) {
  const { cards, getDueCount } = useKnowledgeStore();
  const dueCount = getDueCount();

  // Forecast for next 7 days
  const forecast = useMemo(() => {
    return getForecast(cards as any, 7).slice(0, 7);
  }, [cards]);

  const maxForecast = Math.max(...forecast.map(f => f.count), 1);
  const urgencyColor = dueCount > 20 ? '#F43F5E' : dueCount > 10 ? '#F97316' : '#39FF14';

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#0F2D4A', border: '1px solid #1A3A5C' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-[#D4AF37]" />
          <h3 className="text-sm font-semibold text-white">Study</h3>
        </div>
        <button
          onClick={onNavigateToAcademy}
          className="text-[#00D4FF] text-xs flex items-center gap-1 hover:underline"
        >
          Academy <ChevronRight size={12} />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-[#050E1A]/50">
          <div className="text-xl font-bold" style={{ color: urgencyColor }}>{dueCount}</div>
          <div className="text-[10px] text-[#5A7A9A]">Due Cards</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#050E1A]/50">
          <div className="flex items-center justify-center gap-1">
            <Flame size={14} className="text-[#F97316]" />
            <span className="text-xl font-bold text-[#F97316]">
              {Math.min(cards.filter(c => c.lastReview && (Date.now() - c.lastReview < 86400000)).length, 7)}
            </span>
          </div>
          <div className="text-[10px] text-[#5A7A9A]">Day Streak</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[#050E1A]/50">
          <div className="text-xl font-bold text-[#00D4FF]">{cards.length}</div>
          <div className="text-[10px] text-[#5A7A9A]">Total Cards</div>
        </div>
      </div>

      {/* Mini Forecast */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp size={12} className="text-[#5A7A9A]" />
          <span className="text-[10px] text-[#5A7A9A]">7-Day Forecast</span>
        </div>
        <div className="flex items-end gap-1 h-8">
          {forecast.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max((day.count / maxForecast) * 100, 4)}%`,
                  backgroundColor: day.count > 20 ? '#F43F5E' : day.count > 10 ? '#F97316' : '#39FF14',
                  opacity: 0.7,
                }}
              />
              <span className="text-[8px] text-[#5A7A9A] mt-0.5">
                {['S','M','T','W','T','F','S'][new Date(day.date).getDay()]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      {dueCount > 0 && (
        <button
          onClick={onNavigateToAcademy}
          className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
          style={{
            backgroundColor: `${urgencyColor}15`,
            border: `1px solid ${urgencyColor}40`,
            color: urgencyColor,
          }}
        >
          <Zap size={14} />
          Study Now — {dueCount} card{dueCount !== 1 ? 's' : ''} due
        </button>
      )}
    </div>
  );
}

export default StudyDashboard;