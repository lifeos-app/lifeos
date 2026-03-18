import React from 'react';
import {
  Dumbbell, BookOpen, Flower2, Footprints, Droplets, Target,
  PenTool, Palette, Monitor, Leaf, Music, Brain, Heart, Sun,
  Moon, Zap, Flame, Star, Trophy, GraduationCap, Apple, Pill,
  Phone, Wallet, ClipboardList, Search, Wind, Sparkles, CircleDot,
  NotebookPen, HandHeart, Handshake, Briefcase, Plane, Home,
  Flag, Salad, Utensils, ShowerHead, StretchHorizontal,
  BarChart3, Activity, Circle,
} from 'lucide-react';

// ─── Registry: lucide name → component ───────────────────────────
const ICON_REGISTRY: Record<string, React.ComponentType<any>> = {
  'dumbbell': Dumbbell,
  'book-open': BookOpen,
  'flower-2': Flower2,
  'footprints': Footprints,
  'droplets': Droplets,
  'target': Target,
  'pen-tool': PenTool,
  'palette': Palette,
  'monitor': Monitor,
  'leaf': Leaf,
  'music': Music,
  'brain': Brain,
  'heart': Heart,
  'sun': Sun,
  'moon': Moon,
  'zap': Zap,
  'flame': Flame,
  'star': Star,
  'trophy': Trophy,
  'graduation-cap': GraduationCap,
  'apple': Apple,
  'pill': Pill,
  'phone': Phone,
  'wallet': Wallet,
  'clipboard-list': ClipboardList,
  'search': Search,
  'wind': Wind,
  'sparkles': Sparkles,
  'circle-dot': CircleDot,
  'notebook-pen': NotebookPen,
  'hand-heart': HandHeart,
  'handshake': Handshake,
  'briefcase': Briefcase,
  'plane': Plane,
  'home': Home,
  'flag': Flag,
  'salad': Salad,
  'utensils': Utensils,
  'shower-head': ShowerHead,
  'stretch-horizontal': StretchHorizontal,
  'bar-chart-3': BarChart3,
  'activity': Activity,
};

// ─── Fallback: emoji char → lucide name ──────────────────────────
const EMOJI_FALLBACK: Record<string, string> = {
  '💪': 'dumbbell',
  '📖': 'book-open',
  '📚': 'book-open',
  '🧘': 'flower-2',
  '🧘‍♀️': 'flower-2',
  '📝': 'notebook-pen',
  '💧': 'droplets',
  '🙏': 'hand-heart',
  '🚶': 'footprints',
  '🌬️': 'wind',
  '🎯': 'target',
  '🤝': 'handshake',
  '💰': 'wallet',
  '✨': 'sparkles',
  '💊': 'pill',
  '🍳': 'utensils',
  '🏃': 'activity',
  '🤸': 'stretch-horizontal',
  '😴': 'moon',
  '🚿': 'shower-head',
  '📋': 'clipboard-list',
  '🔍': 'search',
  '🎨': 'palette',
  '✍️': 'pen-tool',
  '📞': 'phone',
  '🧹': 'sparkles',
  '📊': 'bar-chart-3',
  '⚡': 'zap',
  '💻': 'monitor',
  '🔵': 'circle-dot',
  '❤️': 'heart',
  '💼': 'briefcase',
  '✈️': 'plane',
  '🏡': 'home',
  '⭐': 'star',
  '🏁': 'flag',
  '☀️': 'sun',
  '🌙': 'moon',
  '🥗': 'salad',
  '🧠': 'brain',
  '🏦': 'wallet',
};

// ─── HabitIcon component ──────────────────────────────────────────
export function HabitIcon({
  icon,
  size = 18,
  color,
  className,
}: {
  icon: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  // Resolve the icon name: emoji → lucide name, or use directly
  const resolvedName = EMOJI_FALLBACK[icon] ?? icon;
  const IconComponent = ICON_REGISTRY[resolvedName] ?? Circle;

  return <IconComponent size={size} color={color} className={className} />;
}

// Exported for use in icon pickers
export const HABIT_ICONS = [
  'dumbbell', 'book-open', 'flower-2', 'footprints', 'droplets',
  'target', 'pen-tool', 'palette', 'monitor', 'leaf', 'music',
  'brain', 'heart', 'sun', 'moon', 'zap', 'flame', 'star',
  'trophy', 'graduation-cap', 'apple', 'pill', 'phone', 'wallet',
  'clipboard-list', 'search', 'wind', 'sparkles', 'circle-dot',
] as const;

export type HabitIconName = typeof HABIT_ICONS[number];
