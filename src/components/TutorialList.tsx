/**
 * Tutorial List — Accessible from sidebar, shows all tutorials with completion status.
 * Users can replay any tutorial or pick up incomplete ones.
 * Rendered via portal to escape sidebar's backdrop-filter containing block.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap, Check, Play, RotateCcw, X,
  LayoutDashboard, Target, Flame, CalendarDays,
  Wallet, HeartPulse, Sparkles, Trophy,
} from 'lucide-react';
import { isTourComplete, resetTour, startTourManually, type TourId } from './SpotlightTour';
import './TutorialList.css';

interface TutorialInfo {
  id: TourId;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  page: string;
}

const TUTORIALS: TutorialInfo[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Basics',
    description: 'Your command centre — stats, tasks, habits, and AI assistant.',
    icon: <LayoutDashboard size={20} />,
    iconColor: '#00D4FF',
    page: '/',
  },
  {
    id: 'goals',
    title: 'Goals & Objectives',
    description: 'Set objectives, break them into goals, and track progress.',
    icon: <Target size={20} />,
    iconColor: '#FF6B6B',
    page: '/goals',
  },
  {
    id: 'habits',
    title: 'Habit Tracking',
    description: 'Build daily habits, track streaks, and watch progress compound.',
    icon: <Flame size={20} />,
    iconColor: '#FF9F43',
    page: '/habits',
  },
  {
    id: 'schedule',
    title: 'Schedule & Timeline',
    description: 'Unified timeline, event management, and sacred schedule.',
    icon: <CalendarDays size={20} />,
    iconColor: '#54A0FF',
    page: '/schedule',
  },
  {
    id: 'finance',
    title: 'Finances',
    description: 'Track income, expenses, bills, and financial health.',
    icon: <Wallet size={20} />,
    iconColor: '#5FE3A1',
    page: '/finances',
  },
  {
    id: 'health',
    title: 'Health & Wellness',
    description: 'Body metrics, exercise, nutrition, sleep, and mental health.',
    icon: <HeartPulse size={20} />,
    iconColor: '#FF6B8A',
    page: '/health',
  },
  {
    id: 'junction',
    title: 'Junction System',
    description: 'Equip a wisdom tradition with practices, figures, and a sacred calendar.',
    icon: <Sparkles size={20} />,
    iconColor: '#D4AF37',
    page: '/character/junction',
  },
  {
    id: 'gamification',
    title: 'Leveling & Quests',
    description: 'XP system, levels, achievements, daily & weekly quests.',
    icon: <Trophy size={20} />,
    iconColor: '#FFD700',
    page: '/character',
  },
];

interface TutorialListProps {
  open: boolean;
  onClose: () => void;
}

export function TutorialList({ open, onClose }: TutorialListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [completedTours, setCompletedTours] = useState<Set<TourId>>(new Set());

  // Refresh completion state when panel opens
  useEffect(() => {
    if (open) {
      const completed = new Set<TourId>();
      TUTORIALS.forEach(t => {
        if (isTourComplete(t.id)) completed.add(t.id);
      });
      setCompletedTours(completed);
    }
  }, [open]);

  if (!open) return null;

  const completedCount = completedTours.size;
  const totalCount = TUTORIALS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const handleStart = (tutorial: TutorialInfo) => {
    onClose();
    // Navigate to the page first if not already there
    if (location.pathname !== tutorial.page) {
      navigate(tutorial.page + '?tour=' + tutorial.id);
    } else {
      startTourManually(tutorial.id);
    }
  };

  const handleReplay = (tutorial: TutorialInfo) => {
    resetTour(tutorial.id);
    setCompletedTours(prev => {
      const next = new Set(prev);
      next.delete(tutorial.id);
      return next;
    });
    handleStart(tutorial);
  };

  /* Portal to document.body — escapes sidebar's backdrop-filter containing block */
  return createPortal(
    <div className="tut-list-overlay" onClick={onClose}>
      <div className="tut-list-panel" onClick={e => e.stopPropagation()}>
        <div className="tut-list-header">
          <div className="tut-list-header-left">
            <GraduationCap size={18} />
            <span>Tutorials</span>
          </div>
          <button className="tut-list-close" onClick={onClose} aria-label="Close tutorials">
            <X size={16} />
          </button>
        </div>

        {/* Progress */}
        <div className="tut-list-progress">
          <div className="tut-list-progress-bar">
            <div className="tut-list-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="tut-list-progress-text">
            {completedCount} of {totalCount} complete
          </span>
        </div>

        {/* Tutorial items */}
        <div className="tut-list-items">
          {TUTORIALS.map(tutorial => {
            const isComplete = completedTours.has(tutorial.id);
            return (
              <div key={tutorial.id} className={`tut-list-item ${isComplete ? 'complete' : ''}`}>
                <span className="tut-list-item-icon" style={{ color: tutorial.iconColor }}>{tutorial.icon}</span>
                <div className="tut-list-item-info">
                  <div className="tut-list-item-title">
                    {tutorial.title}
                    {isComplete && <Check size={12} className="tut-list-check" />}
                  </div>
                  <div className="tut-list-item-desc">{tutorial.description}</div>
                </div>
                <div className="tut-list-item-actions">
                  {isComplete ? (
                    <button
                      className="tut-list-replay-btn"
                      onClick={() => handleReplay(tutorial)}
                      title="Replay tutorial"
                    >
                      <RotateCcw size={13} />
                    </button>
                  ) : (
                    <button
                      className="tut-list-start-btn"
                      onClick={() => handleStart(tutorial)}
                      title="Start tutorial"
                    >
                      <Play size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
