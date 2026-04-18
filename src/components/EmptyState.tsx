import { type ReactNode, useMemo } from 'react';
import {
  Target, Flame, Calendar, DollarSign, Heart,
  BookOpen, CheckCircle2, Inbox, BarChart3, Sparkles, Users,
  Briefcase, Dumbbell, Apple, Moon, Brain, Scale, Shield, Swords,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './EmptyState.css';

type EmptyVariant =
  | 'tasks' | 'goals' | 'habits' | 'schedule'
  | 'finances' | 'health' | 'journal' | 'inbox'
  | 'review' | 'generic' | 'social' | 'story'
  | 'character' | 'dashboard' | 'work'
  | 'exercise' | 'diet' | 'sleep' | 'mind'
  | 'body' | 'equipment' | 'reflect';

interface EmptyStateProps {
  variant?: EmptyVariant;
  title?: string;
  description?: string;
  action?: { label: ReactNode; onClick: () => void };
  icon?: ReactNode;
}

// ── Hermetic Quotes ──
const HERMETIC_QUOTES = [
  { text: 'As within, so without', principle: 'Correspondence' },
  { text: 'Every journey begins with a single step', principle: 'Vibration' },
  { text: 'The masterpiece is yet to come', principle: 'Mentalism' },
  { text: 'What you seek is also seeking you', principle: 'Rhythm' },
];

function getRandomQuote() {
  return HERMETIC_QUOTES[Math.floor(Math.random() * HERMETIC_QUOTES.length)];
}

const VARIANTS: Record<EmptyVariant, { icon: ReactNode; title: string; description: string; color: string; ctaLabel?: string }> = {
  tasks: {
    icon: <CheckCircle2 size={36} />,
    title: "No tasks yet",
    description: "Let's plan your week! Add tasks or let LifeOS AI help you get started.",
    color: '#39FF14',
  },
  goals: {
    icon: <Zap size={36} />,
    title: "No goals yet",
    description: "Every great achievement starts with a direction. Define what matters to you.",
    color: '#00D4FF',
    ctaLabel: 'Set Your First Goal',
  },
  habits: {
    icon: <Target size={36} />,
    title: "No habits yet",
    description: "Start building your daily rhythm. Small consistent actions create extraordinary results.",
    color: '#F97316',
    ctaLabel: 'Create First Habit',
  },
  schedule: {
    icon: <Calendar size={36} />,
    title: "Nothing scheduled",
    description: "Your day is wide open. Add events or let your tasks fill the gaps.",
    color: '#A855F7',
  },
  finances: {
    icon: <DollarSign size={36} />,
    title: "No financial data yet",
    description: "Understanding your money is the first step to mastering it. Track your first expense.",
    color: '#FACC15',
    ctaLabel: 'Add First Expense',
  },
  health: {
    icon: <Heart size={36} />,
    title: "No health data yet",
    description: "Your body is your temple. Start tracking to see patterns emerge.",
    color: '#F43F5E',
    ctaLabel: 'Log First Entry',
  },
  journal: {
    icon: <BookOpen size={36} />,
    title: "Write your first entry",
    description: "Capture thoughts, wins, and reflections. Your future self will thank you.",
    color: '#EC4899',
  },
  inbox: {
    icon: <Inbox size={36} />,
    title: "Inbox zero!",
    description: "Nothing needs your attention right now. Well done, Commander.",
    color: '#8B5CF6',
  },
  review: {
    icon: <BarChart3 size={36} />,
    title: "Not enough data yet",
    description: "Use LifeOS for a few days to unlock your weekly review and insights.",
    color: '#A855F7',
  },
  generic: {
    icon: <Sparkles size={36} />,
    title: "Nothing here yet",
    description: "Get started by adding your first item.",
    color: '#00D4FF',
  },
  social: {
    icon: <Users size={36} />,
    title: "No connections yet",
    description: "Find friends, join guilds, and build your community.",
    color: '#8B5CF6',
  },
  story: {
    icon: <BookOpen size={36} />,
    title: "No story yet",
    description: "Your chronicle will appear here once you start creating journal entries.",
    color: '#F97316',
  },
  character: {
    icon: <Sparkles size={36} />,
    title: "Character data loading",
    description: "Your character profile is being assembled. Check back in a moment.",
    color: '#00D4FF',
  },
  dashboard: {
    icon: <Sparkles size={36} />,
    title: "Welcome to LifeOS",
    description: "Your command center awaits. Add your first task, habit, or goal to begin your journey.",
    color: '#00D4FF',
    ctaLabel: 'Get Started',
  },
  work: {
    icon: <Briefcase size={36} />,
    title: "No work data",
    description: "Connect a business system to see jobs, revenue, and work stats here.",
    color: '#00D4FF',
  },
  exercise: {
    icon: <Dumbbell size={36} />,
    title: "No workouts logged",
    description: "Create a workout template or log your first exercise session to get started.",
    color: '#39FF14',
  },
  diet: {
    icon: <Apple size={36} />,
    title: "No meals tracked",
    description: "Log what you eat to unlock nutrition insights and track your macros.",
    color: '#FACC15',
  },
  sleep: {
    icon: <Moon size={36} />,
    title: "No sleep data",
    description: "Log your sleep hours and quality to see patterns and improve your rest.",
    color: '#818CF8',
  },
  mind: {
    icon: <Brain size={36} />,
    title: "Mind is quiet",
    description: "Log a meditation session or gratitude entry to start your mindfulness journey.",
    color: '#A855F7',
  },
  body: {
    icon: <Scale size={36} />,
    title: "No body metrics",
    description: "Track weight, measurements, and body markers to see your progress over time.",
    color: '#00D4FF',
  },
  equipment: {
    icon: <Shield size={36} />,
    title: "No equipment yet",
    description: "Equip items and assets from your inventory to boost your character stats.",
    color: '#A855F7',
  },
  reflect: {
    icon: <BookOpen size={36} />,
    title: "Start reflecting",
    description: "Journal your thoughts, review your week, and process ideas in your inbox.",
    color: '#EC4899',
  },
};

export function EmptyState({ variant = 'generic', title, description, action, icon }: EmptyStateProps) {
  const v = VARIANTS[variant];
  const quote = useMemo(() => getRandomQuote(), []);

  return (
    <div className="empty-state">
      <div className="empty-state-visual">
        {/* Animated CSS shapes */}
        <div className="empty-state-orb" style={{ '--orb-color': v.color } as React.CSSProperties} />
        <div className="empty-state-ring" style={{ '--ring-color': v.color } as React.CSSProperties} />
        <div className="empty-state-icon" style={{ color: v.color }}>
          {icon || v.icon}
        </div>
      </div>
      <h3 className="empty-state-title">{title || v.title}</h3>
      <p className="empty-state-desc">{description || v.description}</p>
      {action && (
        <button className="empty-state-cta" onClick={action.onClick} style={{ '--cta-color': v.color } as React.CSSProperties}>
          {action.label || v.ctaLabel || 'Get Started'}
        </button>
      )}
      {!action && v.ctaLabel && (
        <div className="empty-state-hint">Try: {v.ctaLabel}</div>
      )}
      <p className="empty-state-quote">
        "{quote.text}" <span className="empty-state-quote-principle">— {quote.principle}</span>
      </p>
    </div>
  );
}