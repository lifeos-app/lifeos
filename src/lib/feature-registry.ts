/**
 * LifeOS Feature Registry — Single source of truth for navigation.
 *
 * Both Sidebar and MobileNav consume this registry so adding/removing
 * a feature only requires a change here.
 */

export interface FeatureModule {
  id: string;
  name: string;
  route: string;
  icon: string;               // Lucide icon name (mapped to component in consumers)
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
  showInSidebar: boolean;
  showInMobileNav: boolean;
  mobileNavGroup?: 'main' | 'more-life' | 'more-growth';
  sidebarOrder: number;
  mobileNavOrder: number;
  /**
   * Progressive disclosure: if set, this feature is hidden until the user
   * has completed onboarding AND used the app for at least N days.
   * 0 = always visible (default), 1 = show after onboarding, 3+ = delayed.
   */
  revealAfterDays?: number;
  /**
   * Visit count populated at runtime by useAdaptiveNav.
   * Not stored in FEATURES array — merged from localStorage visit tracking.
   */
  visitCount?: number;
}

export const FEATURES: FeatureModule[] = [
  {
    id: 'dashboard',
    name: 'Today',
    route: '/',
    icon: 'LayoutDashboard',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 0,
    mobileNavOrder: 0,
  },
  {
    id: 'schedule',
    name: 'Schedule',
    route: '/schedule',
    icon: 'Calendar',
    color: '#A855F7',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 1,
    mobileNavOrder: 1,
  },
  {
    id: 'goals',
    name: 'Goals',
    route: '/goals',
    icon: 'Target',
    color: '#39FF14',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 2,
    mobileNavOrder: 2,
  },
  {
    id: 'habits',
    name: 'Habits',
    route: '/habits',
    icon: 'Flame',
    color: '#F97316',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 3,
    mobileNavOrder: 3,
  },
  {
    id: 'finances',
    name: 'Finances',
    route: '/finances',
    icon: 'Wallet',
    color: '#FACC15',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 4,
    mobileNavOrder: 5,
  },
  {
    id: 'health',
    name: 'Health',
    route: '/health',
    icon: 'Heart',
    color: '#F43F5E',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 5,
    mobileNavOrder: 4,
  },
  {
    id: 'social',
    name: 'Social',
    route: '/social',
    icon: 'Users',
    color: '#06B6D4',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 6,
    mobileNavOrder: 6,
  },
  {
    id: 'timeline',
    name: 'Life Timeline',
    route: '/timeline',
    icon: 'Clock',
    color: '#8B5CF6',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 7,
    mobileNavOrder: 7,
    revealAfterDays: 3, // Show after 3 days — needs accumulated data to be useful
  },
  {
    id: 'character',
    name: 'Character',
    route: '/character',
    icon: 'Swords',
    color: '#D4AF37',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 8,
    mobileNavOrder: 8,
    revealAfterDays: 1, // Show after 1 day of use
  },
  {
    id: 'reflect',
    name: 'Reflect',
    route: '/reflect',
    icon: 'BookOpen',
    color: '#EC4899',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 9,
    mobileNavOrder: 9,
  },
  {
    id: 'academy',
    name: 'Academy',
    route: '/academy',
    icon: 'GraduationCap',
    color: '#D4AF37',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 10,
    mobileNavOrder: 10,
    revealAfterDays: 2, // Show after 2 days
  },
  {
    id: 'lessons',
    name: "Teddy's Lessons",
    route: '/lessons',
    icon: 'Music',
    color: '#FFD700',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 11,
    mobileNavOrder: 11,
    revealAfterDays: 3, // Show after 3 days
  },
  {
    id: 'replicator',
    name: 'Replicator',
    route: '/replicator',
    icon: 'Package',
    color: '#10B981',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 12,
    mobileNavOrder: 12,
    revealAfterDays: 2, // Show after 2 days
  },
  {
    id: 'sage',
    name: 'Holy Sage',
    route: '/sage',
    icon: 'Sparkles',
    color: '#C084FC',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 13,
    mobileNavOrder: 13,
    revealAfterDays: 0, // Always visible — the oracle is for everyone
  },
  {
    id: 'life-simulator',
    name: 'Simulator',
    route: '/simulator',
    icon: 'Sparkles',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 14,
    mobileNavOrder: 15,
    revealAfterDays: 5, // Show after 5 days — needs accumulated data to be useful
  },
  {
    id: 'digital-twin',
    name: 'Digital Twin',
    route: '/twin',
    icon: 'Brain',
    color: '#C084FC',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 15,
    mobileNavOrder: 14,
    revealAfterDays: 7, // Show after 7 days — needs substantial data to build behavioral model
  },
  {
    id: 'voice',
    name: 'Voice',
    route: '/voice',
    icon: 'Mic',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 16,
    mobileNavOrder: 17,
  },
  {
    id: 'settings',
    name: 'Settings',
    route: '/settings',
    icon: 'Settings',
    color: '#64748B',
    enabled: true,
    requiresAuth: true,
    showInSidebar: false,  // Settings is in sidebar footer, not main nav
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 99,
    mobileNavOrder: 18,
  },
  {
    id: 'contract-intel',
    name: 'Contract Intel',
    route: '/contract-intel',
    icon: 'Brain',
    color: '#F59E0B',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 17,
    mobileNavOrder: 16,
    revealAfterDays: 3, // Show after 3 days — needs financial data to be useful
  },
  {
    id: 'dream-journal',
    name: 'Dream Journal',
    route: '/dreams',
    icon: 'Moon',
    color: '#A855F7',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 18,
    mobileNavOrder: 19,
    revealAfterDays: 1, // Show after 1 day — subconscious awareness from the start
  },
  {
    id: 'marketplace',
    name: 'Plugins',
    route: '/marketplace',
    icon: 'Package',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 19,
    mobileNavOrder: 20,
    revealAfterDays: 2, // Show after 2 days — users need some experience first
  },
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    route: '/telegram',
    icon: 'MessageCircle',
    color: '#0088cc',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 20,
    mobileNavOrder: 21,
    revealAfterDays: 3, // Show after 3 days — needs setup to be useful
  },
  {
    id: 'public-api',
    name: 'Public API',
    route: '/api-settings',
    icon: 'Plug',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 21,
    mobileNavOrder: 22,
    revealAfterDays: 2, // Show after 2 days — needs some data to connect
  },
  {
    id: 'family-circles',
    name: 'Family',
    route: '/family',
    icon: 'Home',
    color: '#F59E0B',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 22,
    mobileNavOrder: 23,
    revealAfterDays: 1, // Show after 1 day — family is core to LifeOS
  },
  {
    id: 'location-context',
    name: 'Location',
    route: '/location',
    icon: 'MapPin',
    color: '#06B6D4',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 23,
    mobileNavOrder: 24,
    revealAfterDays: 1, // Show after 1 day — location context is core to LifeOS
  },
  {
    id: 'social-feed',
    name: 'Social Feed',
    route: '/social-feed',
    icon: 'Rss',
    color: '#10B981',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 24,
    mobileNavOrder: 25,
    revealAfterDays: 1, // Show after 1 day — social feed is core to multiplayer
  },
  {
    id: 'notifications',
    name: 'Notifications',
    route: '/notifications',
    icon: 'Bell',
    color: '#EF4444',
    enabled: true,
    requiresAuth: true,
    showInSidebar: false, // Notification panel is accessed via bell icon, not sidebar nav
    showInMobileNav: true,
    mobileNavGroup: 'main',
    sidebarOrder: 25,
    mobileNavOrder: 26,
  },
  {
    id: 'year-in-review-v2',
    name: 'Year in Review',
    route: '/year-in-review',
    icon: 'Sparkles',
    color: '#A855F7',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 24,
    mobileNavOrder: 25,
    revealAfterDays: 7, // Show after 7 days — needs accumulated year data
  },
  {
    id: 'housing',
    name: 'My House',
    route: '/housing',
    icon: 'Home',
    color: '#D4AF37',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 26,
    mobileNavOrder: 27,
    revealAfterDays: 3, // Show after 3 days — earned enough to decorate
  },
  {
    id: 'market',
    name: 'Bazaar',
    route: '/market',
    icon: 'ShoppingBag',
    color: '#FACC15',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 27,
    mobileNavOrder: 28,
    revealAfterDays: 2, // Show after 2 days — start trading
  },
  {
    id: 'mentorship',
    name: 'Mentorship',
    route: '/mentorship',
    icon: 'GraduationCap',
    color: '#F59E0B',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 28,
    mobileNavOrder: 29,
    revealAfterDays: 3, // Show after 3 days — guidance system
  },
  {
    id: 'mini-games',
    name: 'Arena',
    route: '/mini-games',
    icon: 'Gamepad2',
    color: '#A855F7',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 29,
    mobileNavOrder: 30,
    revealAfterDays: 2, // Show after 2 days — fun distraction + XP
  },
  {
    id: 'audio-rooms',
    name: 'Tavern',
    route: '/audio-rooms',
    icon: 'Volume2',
    color: '#D4AF37',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-life',
    sidebarOrder: 30,
    mobileNavOrder: 31,
    revealAfterDays: 1, // Show after 1 day — social hangout
  },
  {
    id: 'temporal-playback',
    name: 'Playback',
    route: '/temporal-playback',
    icon: 'Clock',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 13,
    mobileNavOrder: 13,
    revealAfterDays: 3,
  },
  {
    id: 'knowledge-graph',
    name: 'Knowledge Graph',
    route: '/knowledge-graph',
    icon: 'Brain',
    color: '#00D4FF',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 14,
    mobileNavOrder: 14,
    revealAfterDays: 3,
  },
  {
    id: 'gcal-sync',
    name: 'Calendar Sync',
    route: '/gcal-sync',
    icon: 'CalendarSync',
    color: '#4285F4',
    enabled: true,
    requiresAuth: true,
    showInSidebar: true,
    showInMobileNav: true,
    mobileNavGroup: 'more-growth',
    sidebarOrder: 15,
    mobileNavOrder: 15,
    revealAfterDays: 1,
  },
];

/** Get nav features for a given surface, sorted by appropriate order. */
export function getNavFeatures(surface: 'sidebar' | 'mobile', accountAgeDays?: number): FeatureModule[] {
  const key = surface === 'sidebar' ? 'showInSidebar' : 'showInMobileNav';
  const orderKey = surface === 'sidebar' ? 'sidebarOrder' : 'mobileNavOrder';
  const days = accountAgeDays ?? Infinity; // If unknown, show all (for existing users)
  return FEATURES
    .filter(f => f.enabled && f[key])
    .filter(f => {
      // Progressive disclosure: hide features that require more account age
      if (f.revealAfterDays && f.revealAfterDays > 0) {
        return days >= f.revealAfterDays;
      }
      return true;
    })
    .sort((a, b) => a[orderKey] - b[orderKey]);
}

/** Main tab bar items for mobile nav. */
export function getMobileMainTabs(accountAgeDays?: number): FeatureModule[] {
  const days = accountAgeDays ?? Infinity;
  return FEATURES
    .filter(f => f.enabled && f.showInMobileNav && f.mobileNavGroup === 'main')
    .filter(f => !f.revealAfterDays || days >= f.revealAfterDays)
    .sort((a, b) => a.mobileNavOrder - b.mobileNavOrder);
}

/** "More" menu groups for mobile nav. */
export function getMobileMoreGroups(accountAgeDays?: number): { life: FeatureModule[]; growth: FeatureModule[] } {
  const days = accountAgeDays ?? Infinity;
  const more = FEATURES.filter(f => f.enabled && f.showInMobileNav && f.mobileNavGroup?.startsWith('more-'))
    .filter(f => !f.revealAfterDays || days >= f.revealAfterDays);
  return {
    life: more.filter(f => f.mobileNavGroup === 'more-life').sort((a, b) => a.mobileNavOrder - b.mobileNavOrder),
    growth: more.filter(f => f.mobileNavGroup === 'more-growth').sort((a, b) => a.mobileNavOrder - b.mobileNavOrder),
  };
}