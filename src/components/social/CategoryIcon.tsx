/**
 * CategoryIcon — Renders a Lucide icon for goal categories
 * Replaces emoji usage in social components.
 */
import {
  Dumbbell, Briefcase, BookOpen, Heart, Palette,
  TrendingUp, Sparkles, Users, Target,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  Dumbbell, Briefcase, BookOpen, Heart, Palette,
  TrendingUp, Sparkles, Users, Target,
  // Fallbacks for guild icons stored as lucide names
  dumbbell: Dumbbell, briefcase: Briefcase, 'book-open': BookOpen,
  heart: Heart, palette: Palette, 'trending-up': TrendingUp,
  sparkles: Sparkles, users: Users, target: Target,
  // Category id shortcuts
  fitness: Dumbbell, business: Briefcase, education: BookOpen,
  health: Heart, creative: Palette, finance: TrendingUp,
  spiritual: Sparkles, social: Users,
};

interface CategoryIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export function CategoryIcon({ name, size = 16, color, className }: CategoryIconProps) {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={size} color={color} className={className} />;
  // Unknown icon name — render as Target fallback
  return <Target size={size} color={color} className={className} />;
}

/** Available guild icon options (Lucide icon names) */
export const GUILD_ICON_OPTIONS = [
  { id: 'target', label: 'Target' },
  { id: 'dumbbell', label: 'Strength' },
  { id: 'briefcase', label: 'Business' },
  { id: 'book-open', label: 'Knowledge' },
  { id: 'heart', label: 'Heart' },
  { id: 'palette', label: 'Creative' },
  { id: 'trending-up', label: 'Growth' },
  { id: 'sparkles', label: 'Spirit' },
  { id: 'users', label: 'Community' },
];
