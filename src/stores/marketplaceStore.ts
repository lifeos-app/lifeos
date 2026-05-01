/**
 * Marketplace Store — Zustand with persist middleware
 *
 * Manages installed plugins and marketplace UI state.
 * Persists installed plugins + settings to localStorage until Supabase sync.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── TYPES ────────────────────────────────────────────────────────────────────

export type PluginCategory =
  | 'junction'
  | 'academy'
  | 'widget'
  | 'realm-skin'
  | 'ai-persona'
  | 'integration'
  | 'theme';

export interface PluginAuthor {
  name: string;
  avatar: string;
  verified: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: PluginCategory;
  author: PluginAuthor;
  version: string;
  icon: string;
  screenshots: string[];
  tags: string[];
  rating: number;
  ratingCount: number;
  installCount: number;
  featured: boolean;
  updatedAt: string;
  permissions: string[];
  dependencies: string[];
  changelog: ChangelogEntry[];
}

export interface InstalledPlugin extends MarketplacePlugin {
  installedAt: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export type MarketplaceTab = 'featured' | 'popular' | 'new' | 'rising';
export type PluginSortKey = 'name' | 'category' | 'installedAt';

interface MarketplaceState {
  /** All plugins available in the marketplace catalog (mock until Supabase) */
  catalog: MarketplacePlugin[];
  /** User-installed plugins, persisted to localStorage */
  installed: InstalledPlugin[];
  /** Active tab on the marketplace page */
  activeTab: MarketplaceTab;
  /** Current search query */
  searchQuery: string;
  /** Selected category filter (null = all) */
  selectedCategory: PluginCategory | null;
  /** Selected tags for filtering */
  selectedTags: string[];
  /** Currently viewed plugin detail (null = closed) */
  detailPluginId: string | null;
  /** Installation in-progress animation state */
  installingIds: string[];
  /** Loading state for catalog fetch */
  catalogLoading: boolean;

  // ── Actions ──
  setActiveTab: (tab: MarketplaceTab) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: PluginCategory | null) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setDetailPluginId: (id: string | null) => void;
  installPlugin: (plugin: MarketplacePlugin) => Promise<void>;
  uninstallPlugin: (id: string) => void;
  toggleEnabled: (id: string) => void;
  updatePluginSetting: (id: string, key: string, value: unknown) => void;
  updatePlugin: (id: string, newVersion: MarketplacePlugin) => Promise<void>;
  setCatalog: (plugins: MarketplacePlugin[]) => void;
  setCatalogLoading: (loading: boolean) => void;

  // ── Selectors ──
  getInstalledPlugin: (id: string) => InstalledPlugin | undefined;
  isInstalled: (id: string) => boolean;
  isUpdateAvailable: (id: string) => boolean;
  getFilteredCatalog: () => MarketplacePlugin[];
  getTotalStorageUsage: () => string;
}

// ── MOCK CATALOG ─────────────────────────────────────────────────────────────

const MOCK_CATALOG: MarketplacePlugin[] = [
  {
    id: 'junction-morning-ritual',
    name: 'Morning Ritual',
    description: 'Start every day with a powerful morning sequence.',
    longDescription: `## Morning Ritual Junction\n\nTransform your mornings with a structured ritual that combines mindfulness, exercise, and intention-setting.\n\n### Features\n- Guided breathing exercises\n- Customizable routine builder\n- Streak tracking & XP rewards\n- Integration with your Schedule\n\n### Why it works\nResearch shows that consistent morning rituals compound into massive long-term gains. This Junction guides you through the optimal sequence proven by top performers.`,
    category: 'junction',
    author: { name: 'LifeOS Team', avatar: '🧘', verified: true },
    version: '1.2.0',
    icon: '🌅',
    screenshots: [],
    tags: ['morning', 'ritual', 'habits', 'mindfulness'],
    rating: 4.8,
    ratingCount: 342,
    installCount: 12840,
    featured: true,
    updatedAt: '2025-04-15',
    permissions: ['schedule.read', 'habits.write'],
    dependencies: [],
    changelog: [
      { version: '1.2.0', date: '2025-04-15', changes: ['Added breathwork module', 'Fixed streak calculation bug'] },
      { version: '1.1.0', date: '2025-03-01', changes: ['New routine builder UI', 'Performance improvements'] },
    ],
  },
  {
    id: 'junction-deep-work',
    name: 'Deep Work Sprint',
    description: 'Pomodoro-based focus sprints with ambient soundscapes.',
    longDescription: `## Deep Work Sprint Junction\n\nEnter flow state with structured focus blocks. Inspired by Cal Newport's Deep Work methodology.\n\n### Features\n- Customizable Pomodoro timers\n- Ambient sound library (rain, café, etc.)\n- Distraction blocking integration\n- Focus streaks & deep work hours tracking\n\nPerfect for knowledge workers, students, and anyone who needs sustained focus.`,
    category: 'junction',
    author: { name: 'FocusLabs', avatar: '🎯', verified: true },
    version: '2.0.1',
    icon: '🎯',
    screenshots: [],
    tags: ['focus', 'pomodoro', 'productivity', 'deep-work'],
    rating: 4.9,
    ratingCount: 891,
    installCount: 28500,
    featured: true,
    updatedAt: '2025-04-20',
    permissions: ['schedule.write', 'notifications.send'],
    dependencies: [],
    changelog: [
      { version: '2.0.1', date: '2025-04-20', changes: ['Fixed timer pause bug', 'Added 5 new soundscapes'] },
    ],
  },
  {
    id: 'academy-stoicism-101',
    name: 'Stoicism 101',
    description: 'Master the ancient art of inner resilience.',
    longDescription: `## Stoicism 101 Academy Course\n\nA 30-day immersive course on Stoic philosophy and practical application.\n\n### Course Outline\n1. **Week 1**: The Dichotomy of Control\n2. **Week 2**: Negative Visualization & Voluntary Discomfort\n3. **Week 3**: The View from Above\n4. **Week 4**: Amor Fati & Living Virtuously\n\nEach lesson includes daily exercises, journaling prompts, and reflection questions.`,
    category: 'academy',
    author: { name: 'Sage Academy', avatar: '🏛️', verified: true },
    version: '1.0.0',
    icon: '🏛️',
    screenshots: [],
    tags: ['stoicism', 'philosophy', 'mindset', 'resilience'],
    rating: 4.7,
    ratingCount: 567,
    installCount: 8930,
    featured: true,
    updatedAt: '2025-03-10',
    permissions: ['journal.write', 'goals.read'],
    dependencies: [],
    changelog: [
      { version: '1.0.0', date: '2025-03-10', changes: ['Initial release'] },
    ],
  },
  {
    id: 'widget-weekly-review',
    name: 'Weekly Review',
    description: 'Dashboard widget showing your week at a glance.',
    longDescription: `## Weekly Review Widget\n\nA beautifully designed dashboard widget that summarizes your week.\n\nShows:\n- Habit completion rates\n- Goal progress\n- Financial snapshot\n- Health metrics trend\n- Top achievements\n\nFully customizable layout — choose which metrics to display.`,
    category: 'widget',
    author: { name: 'DashboardPro', avatar: '📊', verified: false },
    version: '1.3.2',
    icon: '📊',
    screenshots: [],
    tags: ['dashboard', 'weekly', 'review', 'analytics'],
    rating: 4.5,
    ratingCount: 203,
    installCount: 5670,
    featured: false,
    updatedAt: '2025-04-01',
    permissions: ['habits.read', 'goals.read', 'finances.read'],
    dependencies: [],
    changelog: [
      { version: '1.3.2', date: '2025-04-01', changes: ['Fixed layout on mobile', 'Added financial snapshot'] },
    ],
  },
  {
    id: 'realm-aurora-theme',
    name: 'Aurora Borealis',
    description: 'Stunning northern lights theme for your Realm.',
    longDescription: `## Aurora Borealis Realm Skin\n\nTransform your Realm with the mesmerizing colors of the northern lights.\n\n### What's included\n- Animated gradient backgrounds\n- Custom particle effects\n- Matching icon set\n- Adaptive color palette that shifts with time of day\n\nOne of our most popular Realm skins — a feast for the eyes.`,
    category: 'realm-skin',
    author: { name: 'Aether Designs', avatar: '🌌', verified: true },
    version: '2.1.0',
    icon: '🌌',
    screenshots: [],
    tags: ['realm', 'theme', 'aurora', 'animated'],
    rating: 4.9,
    ratingCount: 1203,
    installCount: 34200,
    featured: true,
    updatedAt: '2025-04-18',
    permissions: ['realm.write'],
    dependencies: [],
    changelog: [
      { version: '2.1.0', date: '2025-04-18', changes: ['New particle effects', 'Performance optimization'] },
    ],
  },
  {
    id: 'ai-persona-wise-mentor',
    name: 'The Wise Mentor',
    description: 'AI persona that gives Stoic advice and Socratic questioning.',
    longDescription: `## The Wise Mentor AI Persona\n\nAn AI companion grounded in Stoic philosophy and Socratic questioning.\n\n### Personality\n- Calm, measured responses\n- Asks guiding questions instead of giving direct answers\n- References Stoic and philosophical texts\n- Adapts style based on your emotional state\n\nPerfect for those seeking wisdom over quick fixes.`,
    category: 'ai-persona',
    author: { name: 'AI Guild', avatar: '🦉', verified: true },
    version: '1.1.0',
    icon: '🦉',
    screenshots: [],
    tags: ['ai', 'mentor', 'stoicism', 'coaching'],
    rating: 4.6,
    ratingCount: 412,
    installCount: 7650,
    featured: false,
    updatedAt: '2025-03-28',
    permissions: ['ai.chat', 'journal.read', 'habits.read'],
    dependencies: [],
    changelog: [
      { version: '1.1.0', date: '2025-03-28', changes: ['Improved contextual awareness', 'Added reflection prompts'] },
    ],
  },
  {
    id: 'integration-google-calendar',
    name: 'Google Calendar Sync',
    description: 'Two-way sync with Google Calendar.',
    longDescription: `## Google Calendar Integration\n\nSeamlessly sync your LifeOS schedule with Google Calendar.\n\n### Features\n- Two-way sync (changes in either app reflect in both)\n- Color-coded event categories\n- Smart conflict detection\n- Batch import existing events\n- Privacy controls (choose which events sync)\n\nEssential for professionals who live in Google Calendar.`,
    category: 'integration',
    author: { name: 'LifeOS Team', avatar: '📅', verified: true },
    version: '3.0.0',
    icon: '📅',
    screenshots: [],
    tags: ['google', 'calendar', 'sync', 'integration'],
    rating: 4.4,
    ratingCount: 678,
    installCount: 15300,
    featured: true,
    updatedAt: '2025-04-22',
    permissions: ['calendar.read', 'calendar.write', 'schedule.read', 'schedule.write'],
    dependencies: [],
    changelog: [
      { version: '3.0.0', date: '2025-04-22', changes: ['Complete rewrite for reliability', 'Real-time sync'] },
    ],
  },
  {
    id: 'theme-midnight-gold',
    name: 'Midnight & Gold',
    description: 'Luxurious dark theme with gold accents.',
    longDescription: `## Midnight & Gold Theme\n\nA premium dark theme featuring deep midnight blacks with elegant gold accents.\n\n### Design Details\n- Dark background: #0A0A0F\n- Gold accent: #D4AF37\n- Muted gold: #8B7355\n- Smooth transitions between states\n- Custom scrollbar styling\n- Optimized for OLED screens\n\nFor those who appreciate the finer things.`,
    category: 'theme',
    author: { name: 'Lux Themes', avatar: '✨', verified: false },
    version: '1.5.0',
    icon: '✨',
    screenshots: [],
    tags: ['dark', 'gold', 'premium', 'luxury'],
    rating: 4.3,
    ratingCount: 189,
    installCount: 4210,
    featured: false,
    updatedAt: '2025-04-05',
    permissions: [],
    dependencies: [],
    changelog: [
      { version: '1.5.0', date: '2025-04-05', changes: ['Updated contrast ratios for accessibility', 'New icon set'] },
    ],
  },
  {
    id: 'junction-cold-shower',
    name: 'Cold Shower Challenge',
    description: 'Build resilience with progressive cold exposure.',
    longDescription: `## Cold Shower Challenge Junction\n\nBuild mental and physical resilience through progressive cold exposure.\n\n### Progression\n- Week 1: 30 seconds cold at end of shower\n- Week 2: 1 minute cold\n- Week 3: 2 minutes cold\n- Week 4: Full cold shower\n\nTrack your progress, earn badges, and build the discipline that carries into every area of life.`,
    category: 'junction',
    author: { name: 'IronMind', avatar: '🧊', verified: false },
    version: '1.0.2',
    icon: '🧊',
    screenshots: [],
    tags: ['challenge', 'discipline', 'resilience', 'health'],
    rating: 4.2,
    ratingCount: 98,
    installCount: 2340,
    featured: false,
    updatedAt: '2025-02-14',
    permissions: ['habits.write'],
    dependencies: [],
    changelog: [
      { version: '1.0.2', date: '2025-02-14', changes: ['Fixed timer bug on iOS'] },
    ],
  },
  {
    id: 'academy-financial-literacy',
    name: 'Financial Literacy',
    description: 'From budgeting basics to investment fundamentals.',
    longDescription: `## Financial Literacy Academy Course\n\nA comprehensive 6-week course covering personal finance fundamentals.\n\n### Modules\n1. Budgeting & Cash Flow\n2. Emergency Funds & Insurance\n3. Debt Management Strategies\n4. Basic Investment Concepts\n5. Tax Optimization\n6. Long-term Wealth Building\n\nIncludes interactive calculators, quizzes, and real-world exercises.`,
    category: 'academy',
    author: { name: 'WealthWise', avatar: '💰', verified: true },
    version: '1.2.0',
    icon: '💰',
    screenshots: [],
    tags: ['finance', 'education', 'money', 'investing'],
    rating: 4.6,
    ratingCount: 324,
    installCount: 6780,
    featured: false,
    updatedAt: '2025-03-20',
    permissions: ['finances.read'],
    dependencies: [],
    changelog: [
      { version: '1.2.0', date: '2025-03-20', changes: ['Added tax optimization module', 'Updated investment section'] },
    ],
  },
  {
    id: 'widget-habit-streaks',
    name: 'Habit Streak Visualizer',
    description: 'Beautiful heatmap of your habit consistency.',
    longDescription: `## Habit Streak Visualizer Widget\n\nA stunning GitHub-style contribution heatmap for your daily habits.\n\n### Features\n- Contribution heatmap for all tracked habits\n- Streak counters with fire animations\n- Best streak records\n- Color intensity based on completion rate\n- Weekly/monthly/yearly views\n\nSee your consistency at a glance.`,
    category: 'widget',
    author: { name: 'StreakLabs', avatar: '🔥', verified: false },
    version: '1.0.0',
    icon: '🔥',
    screenshots: [],
    tags: ['habits', 'streaks', 'visualization', 'heatmap'],
    rating: 4.4,
    ratingCount: 156,
    installCount: 3890,
    featured: false,
    updatedAt: '2025-01-28',
    permissions: ['habits.read'],
    dependencies: [],
    changelog: [
      { version: '1.0.0', date: '2025-01-28', changes: ['Initial release'] },
    ],
  },
  {
    id: 'realm-cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Futuristic neon-lit realm skin.',
    longDescription: `## Cyberpunk Neon Realm Skin\n\nImmerse yourself in a neon-drenched future.\n\n### Features\n- Glowing neon accent colors\n- Animated grid backgrounds\n- Custom holographic UI elements\n- Retro-futuristic typography\n- Scanline overlay option\n\nFor those who want their Realm to feel like a cyberpunk interface.`,
    category: 'realm-skin',
    author: { name: 'NeonCraft', avatar: '🕹️', verified: false },
    version: '1.0.0',
    icon: '🕹️',
    screenshots: [],
    tags: ['cyberpunk', 'neon', 'futuristic', 'realm'],
    rating: 4.1,
    ratingCount: 87,
    installCount: 1890,
    featured: false,
    updatedAt: '2025-02-05',
    permissions: ['realm.write'],
    dependencies: [],
    changelog: [
      { version: '1.0.0', date: '2025-02-05', changes: ['Initial release'] },
    ],
  },
];

// ── CATEGORY CONFIG ───────────────────────────────────────────────────────────

export const PLUGIN_CATEGORIES: { id: PluginCategory; label: string; icon: string; color: string; description: string }[] = [
  { id: 'junction', label: 'Junctions', icon: '🔌', color: '#39FF14', description: 'Structured routines & challenges' },
  { id: 'academy', label: 'Academy Courses', icon: '🎓', color: '#D4AF37', description: 'Learn & grow with guided courses' },
  { id: 'widget', label: 'Dashboard Widgets', icon: '📊', color: '#00D4FF', description: 'Add info blocks to your dashboard' },
  { id: 'realm-skin', label: 'Realm Skins', icon: '🎨', color: '#A855F7', description: 'Customize your Realm\'s look & feel' },
  { id: 'ai-persona', label: 'AI Personas', icon: '🤖', color: '#F43F5E', description: 'AI companions & coaching styles' },
  { id: 'integration', label: 'Integrations', icon: '🔗', color: '#F97316', description: 'Connect with external services' },
  { id: 'theme', label: 'Themes', icon: '🌙', color: '#64748B', description: 'Visual themes for LifeOS' },
];

// ── ALL TAGS (derived from catalog) ──────────────────────────────────────────

function getAllTags(catalog: MarketplacePlugin[]): string[] {
  const tagSet = new Set<string>();
  catalog.forEach(p => p.tags.forEach(t => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

// ── STORE ────────────────────────────────────────────────────────────────────

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set, get) => ({
      catalog: MOCK_CATALOG,
      installed: [],
      activeTab: 'featured',
      searchQuery: '',
      selectedCategory: null,
      selectedTags: [],
      detailPluginId: null,
      installingIds: [],
      catalogLoading: false,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      toggleTag: (tag) => {
        const { selectedTags } = get();
        set({
          selectedTags: selectedTags.includes(tag)
            ? selectedTags.filter(t => t !== tag)
            : [...selectedTags, tag],
        });
      },
      clearFilters: () => set({ searchQuery: '', selectedCategory: null, selectedTags: [] }),

      setDetailPluginId: (id) => set({ detailPluginId: id }),

      installPlugin: async (plugin) => {
        const { installed, installingIds } = get();
        if (installed.find(p => p.id === plugin.id)) return;

        // Add to installing list for animation
        set({ installingIds: [...installingIds, plugin.id] });

        // Simulate install delay
        await new Promise(resolve => setTimeout(resolve, 1200));

        const installedPlugin: InstalledPlugin = {
          ...plugin,
          installedAt: new Date().toISOString(),
          enabled: true,
          settings: {},
        };

        set({
          installed: [...installed.filter(p => p.id !== plugin.id), installedPlugin],
          installingIds: installingIds.filter(id => id !== plugin.id),
        });
      },

      uninstallPlugin: (id) => {
        set({ installed: get().installed.filter(p => p.id !== id) });
      },

      toggleEnabled: (id) => {
        set({
          installed: get().installed.map(p =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
          ),
        });
      },

      updatePluginSetting: (id, key, value) => {
        set({
          installed: get().installed.map(p =>
            p.id === id ? { ...p, settings: { ...p.settings, [key]: value } } : p
          ),
        });
      },

      updatePlugin: async (id, newVersion) => {
        const { installed } = get();
        const existing = installed.find(p => p.id === id);
        if (!existing) return;

        set({ installingIds: [...get().installingIds, id] });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const updated: InstalledPlugin = {
          ...newVersion,
          installedAt: existing.installedAt,
          enabled: existing.enabled,
          settings: existing.settings,
        };

        set({
          installed: installed.map(p => p.id === id ? updated : p),
          installingIds: get().installingIds.filter(iid => iid !== id),
        });
      },

      setCatalog: (plugins) => set({ catalog: plugins }),
      setCatalogLoading: (loading) => set({ catalogLoading: loading }),

      getInstalledPlugin: (id) => get().installed.find(p => p.id === id),
      isInstalled: (id) => get().installed.some(p => p.id === id),
      isUpdateAvailable: (id) => {
        const installed = get().installed.find(p => p.id === id);
        const catalog = get().catalog.find(p => p.id === id);
        if (!installed || !catalog) return false;
        return catalog.version !== installed.version;
      },
      getFilteredCatalog: () => {
        const { catalog, activeTab, searchQuery, selectedCategory, selectedTags } = get();
        let filtered = [...catalog];

        // Category filter
        if (selectedCategory) {
          filtered = filtered.filter(p => p.category === selectedCategory);
        }

        // Tag filter
        if (selectedTags.length > 0) {
          filtered = filtered.filter(p =>
            selectedTags.some(tag => p.tags.includes(tag))
          );
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some(t => t.toLowerCase().includes(q)) ||
            p.author.name.toLowerCase().includes(q)
          );
        }

        // Tab sorting
        switch (activeTab) {
          case 'featured':
            filtered = filtered.filter(p => p.featured).concat(filtered.filter(p => !p.featured));
            break;
          case 'popular':
            filtered = filtered.sort((a, b) => b.installCount - a.installCount);
            break;
          case 'new':
            filtered = filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            break;
          case 'rising':
            // Simulate "rising" with rating * recent activity
            filtered = filtered.sort((a, b) => {
              const scoreA = a.rating * (a.ratingCount / (a.installCount || 1)) * (100 - (Date.now() - new Date(a.updatedAt).getTime()) / 86400000);
              const scoreB = b.rating * (b.ratingCount / (b.installCount || 1)) * (100 - (Date.now() - new Date(b.updatedAt).getTime()) / 86400000);
              return scoreB - scoreA;
            });
            break;
        }

        return filtered;
      },
      getTotalStorageUsage: () => {
        const { installed } = get();
        // Simulated storage estimate
        const totalKB = installed.length * 250; // ~250KB per plugin
        if (totalKB < 1024) return `${totalKB} KB`;
        return `${(totalKB / 1024).toFixed(1)} MB`;
      },
    }),
    {
      name: 'lifeos-marketplace-installed',
      partialize: (state) => ({
        installed: state.installed,
      }),
    }
  )
);