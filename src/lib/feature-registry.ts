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
}

const FEATURES: FeatureModule[] = [
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
    sidebarOrder: 7,
    mobileNavOrder: 7,
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
    sidebarOrder: 8,
    mobileNavOrder: 8,
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
    mobileNavOrder: 9,
  },
];

/** Get nav features for a given surface, sorted by appropriate order. */
export function getNavFeatures(surface: 'sidebar' | 'mobile'): FeatureModule[] {
  const key = surface === 'sidebar' ? 'showInSidebar' : 'showInMobileNav';
  const orderKey = surface === 'sidebar' ? 'sidebarOrder' : 'mobileNavOrder';
  return FEATURES
    .filter(f => f.enabled && f[key])
    .sort((a, b) => a[orderKey] - b[orderKey]);
}

/** Main tab bar items for mobile nav. */
export function getMobileMainTabs(): FeatureModule[] {
  return FEATURES
    .filter(f => f.enabled && f.showInMobileNav && f.mobileNavGroup === 'main')
    .sort((a, b) => a.mobileNavOrder - b.mobileNavOrder);
}

/** "More" menu groups for mobile nav. */
export function getMobileMoreGroups(): { life: FeatureModule[]; growth: FeatureModule[] } {
  const more = FEATURES.filter(f => f.enabled && f.showInMobileNav && f.mobileNavGroup?.startsWith('more-'));
  return {
    life: more.filter(f => f.mobileNavGroup === 'more-life').sort((a, b) => a.mobileNavOrder - b.mobileNavOrder),
    growth: more.filter(f => f.mobileNavGroup === 'more-growth').sort((a, b) => a.mobileNavOrder - b.mobileNavOrder),
  };
}
