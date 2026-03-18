/**
 * emoji-icon.tsx
 * Central emoji → Lucide icon resolver for LifeOS.
 * Use <EmojiIcon emoji="🎯" size={16} /> anywhere emoji was previously rendered.
 * Use resolveIcon(emoji) to get the Lucide component programmatically.
 */
import React from 'react';
import {
  Target, Flame, Dumbbell, BarChart3, Heart, Wallet, BookOpen,
  CheckCircle2, Zap, Brain, Sprout, Sparkles, Palette, AlertTriangle,
  Hammer, FileText, Moon, Apple, Pill, Calendar, Home, User,
  MessageCircle, Bell, Settings, TrendingUp, Trophy, Gamepad2,
  ClipboardList, Lock, Key, Sun, Lightbulb, Plug, FolderOpen,
  Smartphone, Link, Plus, X, PartyPopper, Users, Swords, Flag,
  Briefcase, Handshake, Activity, ShowerHead, Search,
  HandHeart, Circle, PenTool, Droplets,
  Footprints, Flower2, Salad, Utensils, StretchHorizontal,
  Monitor, Plane, GraduationCap, Star, TrendingDown,
  Package, Leaf, DollarSign, Wrench, Globe, Truck,
  Clock, RefreshCw, Award, CreditCard, Building2, Receipt,
  Inbox, ScrollText, Crown, Rocket, Map, Hash,
  Bot, Wand2, Mail, Square, Gem, Compass,
} from 'lucide-react';

type IconProps = {
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
};

type IconComponent = React.ComponentType<IconProps>;

// ─── Full emoji → Lucide component map ───────────────────────────────────────
export const EMOJI_ICON_MAP: Record<string, IconComponent> = {
  // Fitness & Health
  '💪': Dumbbell,
  '🏋️': Dumbbell,
  '🏋': Dumbbell,
  '🏃': Activity,
  '🤸': StretchHorizontal,
  '🧘': Flower2,
  '🧘‍♀️': Flower2,
  '🚶': Footprints,
  '😴': Moon,
  '💤': Moon,
  '🍎': Apple,
  '💊': Pill,
  '🥗': Salad,
  '🍳': Utensils,
  '🚿': ShowerHead,
  '💧': Droplets,
  '❤️': Heart,
  '🧠': Brain,
  '⚖️': Square,   // scales → square closest

  // Goals & Productivity
  '🎯': Target,
  '🏁': Flag,
  '✅': CheckCircle2,
  '☐': Square,
  '📋': ClipboardList,
  '📝': FileText,
  '✍️': PenTool,
  '🔍': Search,
  '🗂️': FolderOpen,
  '📂': FolderOpen,

  // Energy & Growth
  '⚡': Zap,
  '🔥': Flame,
  '🌱': Sprout,
  '✨': Sparkles,
  '🚀': Rocket,
  '💡': Lightbulb,
  '🌟': Star,
  '⭐': Star,

  // Finance
  '💰': Wallet,
  '💵': DollarSign,
  '💳': CreditCard,
  '📈': TrendingUp,
  '📉': TrendingDown,
  '📊': BarChart3,
  '🏦': Building2,
  '🧾': Receipt,
  '💸': DollarSign,

  // Knowledge & Learning
  '📖': BookOpen,
  '📚': BookOpen,
  '🎓': GraduationCap,
  '📓': ScrollText,

  // Lifestyle & Social
  '🏠': Home,
  '🏡': Home,
  '👤': User,
  '👥': Users,
  '🤝': Handshake,
  '🙏': HandHeart,
  '💬': MessageCircle,
  '🔔': Bell,
  '🎉': PartyPopper,
  '🥳': PartyPopper,

  // Tools & Tech
  '⚙️': Settings,
  '🔨': Hammer,
  '🔧': Wrench,
  '🔌': Plug,
  '💻': Monitor,
  '📱': Smartphone,
  '🔗': Link,
  '📦': Package,

  // Navigation & UI
  '➕': Plus,
  '❌': X,
  '🔒': Lock,
  '🔑': Key,
  '🌙': Moon,
  '☀️': Sun,
  '🎨': Palette,
  '🎮': Gamepad2,
  '🏆': Trophy,
  '📅': Calendar,
  '🗺️': Map,
  '🗓️': Calendar,
  '⚠️': AlertTriangle,

  // Work & Business
  '💼': Briefcase,
  '✈️': Plane,
  '🚚': Truck,
  '🌍': Globe,
  '🌐': Globe,
  '🌾': Leaf,
  '🏗️': Wrench,
  '🏥': Heart,

  // Social context icons
  '⚔️': Swords,
  '🤖': Bot,
  '🧙': Wand2,
  '👑': Crown,
  '🦉': Sparkles,
  '🐦': Sparkles,
  '🧹': Sparkles, // broom → sparkles (closest Lucide match)
  '🔄': RefreshCw,
  '🔵': Circle,
  '📡': Globe,
  '🔟': Hash,
  '🎲': Gamepad2,

  // Misc
  '📧': Mail,
  '📥': Inbox,
  '⏱️': Clock,
  '🕐': Clock,
  '🌅': Sun,
  '🌆': Sun,
  '🏅': Award,
  '🎖️': Award,
  '📆': Calendar,
  '🎂': PartyPopper,
  '🏔️': Flag,
  '⛓️': Link,
  '💯': Star,
  '♾️': RefreshCw,
  '🧩': Gamepad2,
  '🛡️': Lock,
  '🧑': User,
  '👋': User,
};

// ─── Lucide icon name → component (for string-stored icon names) ─────────────
export const LUCIDE_NAME_MAP: Record<string, IconComponent> = {
  'target': Target, 'flame': Flame, 'dumbbell': Dumbbell, 'bar-chart-3': BarChart3,
  'heart': Heart, 'wallet': Wallet, 'book-open': BookOpen, 'check-circle-2': CheckCircle2,
  'zap': Zap, 'brain': Brain, 'sprout': Sprout, 'sparkles': Sparkles, 'palette': Palette,
  'alert-triangle': AlertTriangle, 'hammer': Hammer, 'file-text': FileText,
  'moon': Moon, 'apple': Apple, 'pill': Pill, 'calendar': Calendar, 'home': Home,
  'user': User, 'message-circle': MessageCircle, 'bell': Bell, 'settings': Settings,
  'trending-up': TrendingUp, 'trophy': Trophy, 'gamepad-2': Gamepad2,
  'clipboard-list': ClipboardList, 'lock': Lock, 'key': Key, 'sun': Sun,
  'lightbulb': Lightbulb, 'plug': Plug, 'folder-open': FolderOpen,
  'smartphone': Smartphone, 'link': Link, 'plus': Plus, 'x': X,
  'party-popper': PartyPopper, 'users': Users, 'swords': Swords, 'flag': Flag,
  'gem': Gem, 'compass': Compass, 'droplets': Droplets,
  'flower-2': Flower2, 'map': Map, 'refresh-cw': RefreshCw,
  'briefcase': Briefcase, 'trending-down': TrendingDown,
  'circle': Circle, 'globe': Globe, 'truck': Truck,
  'award': Award, 'crown': Crown, 'rocket': Rocket, 'hash': Hash,
  'bot': Bot, 'wand-2': Wand2, 'mail': Mail, 'inbox': Inbox, 'scroll-text': ScrollText,
  'clock': Clock, 'building-2': Building2, 'receipt': Receipt, 'credit-card': CreditCard,
  'wrench': Wrench, 'leaf': Leaf, 'hand-heart': HandHeart,
};

// ─── Resolve emoji to icon component ─────────────────────────────────────────
export function resolveIcon(emoji: string): IconComponent {
  return EMOJI_ICON_MAP[emoji] ?? LUCIDE_NAME_MAP[emoji] ?? Circle;
}

// ─── EmojiIcon component ─────────────────────────────────────────────────────
interface EmojiIconProps {
  /** Emoji character(s) */
  emoji: string;
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
  /** If true, renders emoji as text when no mapping found */
  fallbackAsText?: boolean;
}

export function EmojiIcon({
  emoji,
  size = 16,
  className,
  color,
  style,
  fallbackAsText,
}: EmojiIconProps) {
  // Check emoji map first, then Lucide name map
  const IconComponent = EMOJI_ICON_MAP[emoji] ?? LUCIDE_NAME_MAP[emoji];
  if (IconComponent) {
    return <IconComponent size={size} className={className} color={color} style={style} />;
  }
  if (fallbackAsText) {
    return <span className={className} style={style}>{emoji}</span>;
  }
  return <Circle size={size} className={className} color={color} style={style} />;
}

export default EmojiIcon;
