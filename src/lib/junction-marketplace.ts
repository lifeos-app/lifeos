/**
 * Junction Marketplace — Community-created Junctions
 *
 * Browse, install, create, and publish wisdom traditions.
 * Data stored in localStorage until backend API is available.
 */

import type { JunctionTradition } from '../hooks/useJunction';

// ── Types ────────────────────────────────────────────────────

export interface CommunityJunction extends JunctionTradition {
  creatorId: string;
  creatorName: string;
  likes: number;
  downloads: number;
  featured: boolean;
  tags: string[];
  version: number;
  quests: CommunityQuest[];
  category: MarketplaceCategory;
}

export interface CommunityQuest {
  id: string;
  name: string;
  description: string;
  xp: number;
}

export type MarketplaceCategory =
  | 'Fitness'
  | 'Creativity'
  | 'Mindfulness'
  | 'Productivity'
  | 'Learning'
  | 'Other';

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  'Fitness',
  'Creativity',
  'Mindfulness',
  'Productivity',
  'Learning',
  'Other',
];

// ── LocalStorage Keys ────────────────────────────────────────

const LIKES_KEY = 'lifeos_junction_likes';
const INSTALLED_KEY = 'lifeos_custom_junctions';
const PUBLISHED_KEY = 'lifeos_published_junctions';

// ── Featured Community Junctions ─────────────────────────────

export const FEATURED_COMMUNITY_JUNCTIONS: CommunityJunction[] = [
  {
    id: 'community_monks_path',
    name: "The Monk's Path",
    slug: 'monks_path',
    icon: '\u{1F9D8}',
    description: 'Minimalism meets meditation. Strip away the unnecessary and find clarity in stillness.',
    color: '#8B5CF6',
    background_gradient: 'linear-gradient(135deg, #8B5CF622, #8B5CF608)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_wisdom_seeker',
    creatorName: '@wisdom_seeker',
    likes: 342,
    downloads: 128,
    featured: true,
    tags: ['minimalism', 'meditation', 'mindfulness', 'stillness'],
    version: 1,
    category: 'Mindfulness',
    quests: [
      { id: 'mp_q1', name: 'Digital Detox', description: 'Spend 24 hours without screens', xp: 100 },
      { id: 'mp_q2', name: 'One Possession', description: 'Remove 10 items you no longer need', xp: 75 },
      { id: 'mp_q3', name: 'Silent Hour', description: 'Practice one hour of complete silence daily for a week', xp: 120 },
      { id: 'mp_q4', name: 'Walking Meditation', description: 'Complete 7 days of mindful walking', xp: 90 },
    ],
  },
  {
    id: 'community_iron_discipline',
    name: 'Iron Discipline',
    slug: 'iron_discipline',
    icon: '\u{1F4AA}',
    description: 'Military-style fitness and mental toughness. Forge yourself through structured discipline.',
    color: '#EF4444',
    background_gradient: 'linear-gradient(135deg, #EF444422, #EF444408)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_iron_will',
    creatorName: '@iron_will',
    likes: 567,
    downloads: 245,
    featured: true,
    tags: ['fitness', 'discipline', 'military', 'toughness'],
    version: 1,
    category: 'Fitness',
    quests: [
      { id: 'id_q1', name: '0500 Reveille', description: 'Wake at 5 AM for 14 consecutive days', xp: 150 },
      { id: 'id_q2', name: 'Cold Forge', description: 'Take cold showers for 7 days straight', xp: 100 },
      { id: 'id_q3', name: 'Iron Body', description: 'Complete 100 pushups, 100 squats, 100 situps in one session', xp: 200 },
      { id: 'id_q4', name: 'No Excuses Week', description: 'Complete every scheduled task for 7 consecutive days', xp: 175 },
      { id: 'id_q5', name: 'Ruck March', description: 'Walk 10km with a weighted pack', xp: 125 },
    ],
  },
  {
    id: 'community_creators_flow',
    name: "Creator's Flow",
    slug: 'creators_flow',
    icon: '\u{1F3A8}',
    description: 'Writing, creativity, and shipping. Build the habit of making things and putting them into the world.',
    color: '#F59E0B',
    background_gradient: 'linear-gradient(135deg, #F59E0B22, #F59E0B08)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_maker_studios',
    creatorName: '@maker_studios',
    likes: 423,
    downloads: 189,
    featured: true,
    tags: ['writing', 'creativity', 'shipping', 'maker'],
    version: 1,
    category: 'Creativity',
    quests: [
      { id: 'cf_q1', name: 'Morning Pages', description: 'Write 750 words every morning for 7 days', xp: 100 },
      { id: 'cf_q2', name: 'Ship Something', description: 'Publish or share a creative work with the world', xp: 200 },
      { id: 'cf_q3', name: 'Creative Block Breaker', description: 'Try 3 different creative mediums in one week', xp: 125 },
      { id: 'cf_q4', name: 'Daily Sketch', description: 'Create one sketch or doodle every day for 14 days', xp: 150 },
    ],
  },
  {
    id: 'community_parent_mode',
    name: 'Parent Mode',
    slug: 'parent_mode',
    icon: '\u{1F46A}',
    description: 'Family first, health close second. Balance work and life while raising the next generation.',
    color: '#10B981',
    background_gradient: 'linear-gradient(135deg, #10B98122, #10B98108)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_dadof3',
    creatorName: '@dadof3',
    likes: 298,
    downloads: 156,
    featured: false,
    tags: ['family', 'health', 'balance', 'parenting'],
    version: 1,
    category: 'Other',
    quests: [
      { id: 'pm_q1', name: 'Family Dinner Streak', description: 'Eat dinner with your family 5 nights this week', xp: 100 },
      { id: 'pm_q2', name: 'Active Play', description: 'Spend 30 minutes of active play with your kids daily for a week', xp: 90 },
      { id: 'pm_q3', name: 'Self-Care Hour', description: 'Schedule and protect 1 hour for yourself 3 times this week', xp: 80 },
    ],
  },
  {
    id: 'community_stoic_forge',
    name: 'The Stoic Forge',
    slug: 'stoic_forge',
    icon: '\u{1F525}',
    description: 'Stoic philosophy applied daily. Build resilience, practice virtue, and control what you can.',
    color: '#6366F1',
    background_gradient: 'linear-gradient(135deg, #6366F122, #6366F108)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_stoic_daily',
    creatorName: '@stoic_daily',
    likes: 489,
    downloads: 201,
    featured: true,
    tags: ['stoicism', 'philosophy', 'resilience', 'virtue'],
    version: 1,
    category: 'Mindfulness',
    quests: [
      { id: 'sf_q1', name: 'Morning Meditation', description: 'Read and reflect on a Stoic passage each morning for 7 days', xp: 80 },
      { id: 'sf_q2', name: 'Negative Visualization', description: 'Practice premeditatio malorum for 5 days', xp: 100 },
      { id: 'sf_q3', name: 'Dichotomy of Control', description: 'Journal about what you can/cannot control for 7 days', xp: 120 },
      { id: 'sf_q4', name: 'Voluntary Discomfort', description: 'Practice one deliberate discomfort daily for 5 days', xp: 110 },
    ],
  },
  {
    id: 'community_night_owl',
    name: 'Night Owl Protocol',
    slug: 'night_owl',
    icon: '\u{1F989}',
    description: 'Optimized for late-night creators. Peak productivity when the world sleeps.',
    color: '#3B82F6',
    background_gradient: 'linear-gradient(135deg, #3B82F622, #3B82F608)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_nightcoder',
    creatorName: '@nightcoder',
    likes: 356,
    downloads: 167,
    featured: false,
    tags: ['night', 'productivity', 'coding', 'creative'],
    version: 1,
    category: 'Productivity',
    quests: [
      { id: 'no_q1', name: 'Deep Work Block', description: 'Complete 3 hours of uninterrupted deep work after 10 PM', xp: 150 },
      { id: 'no_q2', name: 'Sleep Hygiene', description: 'Maintain consistent sleep schedule (even if late) for 7 days', xp: 100 },
      { id: 'no_q3', name: 'Midnight Build', description: 'Ship a feature or project during a night session', xp: 200 },
    ],
  },
  {
    id: 'community_healing_circle',
    name: 'Healing Circle',
    slug: 'healing_circle',
    icon: '\u{1F49A}',
    description: 'Mental health recovery and gentle movement. Compassion-first approach to rebuilding yourself.',
    color: '#14B8A6',
    background_gradient: 'linear-gradient(135deg, #14B8A622, #14B8A608)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_inner_compass',
    creatorName: '@inner_compass',
    likes: 412,
    downloads: 178,
    featured: false,
    tags: ['mental-health', 'recovery', 'gentle', 'compassion'],
    version: 1,
    category: 'Mindfulness',
    quests: [
      { id: 'hc_q1', name: 'Gratitude Practice', description: 'Write 3 things you are grateful for daily for 7 days', xp: 70 },
      { id: 'hc_q2', name: 'Gentle Movement', description: 'Do 15 minutes of gentle stretching or yoga daily for 5 days', xp: 80 },
      { id: 'hc_q3', name: 'Boundary Setting', description: 'Identify and communicate one boundary this week', xp: 100 },
      { id: 'hc_q4', name: 'Check-In Ritual', description: 'Journal about your emotional state daily for 7 days', xp: 90 },
    ],
  },
  {
    id: 'community_polymath',
    name: 'The Polymath',
    slug: 'polymath',
    icon: '\u{1F4DA}',
    description: 'Cross-domain learning. Master breadth, not just depth. The Renaissance approach to modern life.',
    color: '#D946EF',
    background_gradient: 'linear-gradient(135deg, #D946EF22, #D946EF08)',
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'user_renaissance_human',
    creatorName: '@renaissance_human',
    likes: 378,
    downloads: 145,
    featured: false,
    tags: ['learning', 'cross-domain', 'renaissance', 'polymath'],
    version: 1,
    category: 'Learning',
    quests: [
      { id: 'pl_q1', name: 'New Skill Sprint', description: 'Spend 1 hour learning something completely outside your field', xp: 100 },
      { id: 'pl_q2', name: 'Cross-Pollination', description: 'Apply a concept from one domain to solve a problem in another', xp: 150 },
      { id: 'pl_q3', name: 'Teach to Learn', description: 'Explain a newly learned concept to someone else', xp: 120 },
      { id: 'pl_q4', name: '5-Book Challenge', description: 'Read from 5 different genres in one month', xp: 200 },
      { id: 'pl_q5', name: 'Synthesis Journal', description: 'Write a journal entry connecting 3 different areas of study', xp: 130 },
    ],
  },
];

// ── Actions ──────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Safari private */ }
}

export function likeJunction(junctionId: string): void {
  const likes = readJson<Record<string, boolean>>(LIKES_KEY, {});
  if (likes[junctionId]) return;
  likes[junctionId] = true;
  writeJson(LIKES_KEY, likes);
}

export function hasLikedJunction(junctionId: string): boolean {
  const likes = readJson<Record<string, boolean>>(LIKES_KEY, {});
  return !!likes[junctionId];
}

export function getJunctionLikes(junction: CommunityJunction): number {
  const likes = readJson<Record<string, boolean>>(LIKES_KEY, {});
  return junction.likes + (likes[junction.id] ? 1 : 0);
}

export function downloadJunction(junction: CommunityJunction): void {
  const installed = readJson<CommunityJunction[]>(INSTALLED_KEY, []);
  if (installed.some(j => j.id === junction.id)) return;
  installed.push({ ...junction, downloads: junction.downloads + 1 });
  writeJson(INSTALLED_KEY, installed);
}

export function getInstalledCommunityJunctions(): CommunityJunction[] {
  return readJson<CommunityJunction[]>(INSTALLED_KEY, []);
}

export function isJunctionInstalled(junctionId: string): boolean {
  const installed = readJson<CommunityJunction[]>(INSTALLED_KEY, []);
  return installed.some(j => j.id === junctionId);
}

export function uninstallJunction(junctionId: string): void {
  const installed = readJson<CommunityJunction[]>(INSTALLED_KEY, []);
  writeJson(INSTALLED_KEY, installed.filter(j => j.id !== junctionId));
}

export function createCustomJunction(data: Partial<CommunityJunction>): CommunityJunction {
  const junction: CommunityJunction = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name || 'Custom Junction',
    slug: (data.name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    icon: data.icon || '\u{2728}',
    description: data.description || '',
    color: data.color || '#00D4FF',
    background_gradient: `linear-gradient(135deg, ${data.color || '#00D4FF'}22, ${data.color || '#00D4FF'}08)`,
    available: true,
    paths: [],
    calendar_type: 'gregorian',
    creatorId: 'local_user',
    creatorName: 'You',
    likes: 0,
    downloads: 0,
    featured: false,
    tags: data.tags || [],
    version: 1,
    category: data.category || 'Other',
    quests: data.quests || [],
  };

  const installed = readJson<CommunityJunction[]>(INSTALLED_KEY, []);
  installed.push(junction);
  writeJson(INSTALLED_KEY, installed);

  return junction;
}

export function publishJunction(junction: CommunityJunction): void {
  const published = readJson<Array<CommunityJunction & { status: string; publishedAt: string }>>(PUBLISHED_KEY, []);
  published.push({
    ...junction,
    status: 'pending_review',
    publishedAt: new Date().toISOString(),
  });
  writeJson(PUBLISHED_KEY, published);
}

export function getPublishedJunctions(): Array<CommunityJunction & { status: string; publishedAt: string }> {
  return readJson(PUBLISHED_KEY, []);
}
