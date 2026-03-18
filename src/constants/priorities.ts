// Priority mapping: UI labels (P1-P4) to database values
export const PRIORITY_MAP = {
  1: 'urgent',   // P1 - Critical/Urgent
  2: 'high',     // P2 - High
  3: 'medium',   // P3 - Medium
  4: 'low',      // P4 - Low
} as const;

// Reverse mapping: database value to P1-P4
export const PRIORITY_TO_LEVEL: Record<string, 1 | 2 | 3 | 4> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export interface PriorityConfig {
  level: 1 | 2 | 3 | 4;
  dbValue: 'urgent' | 'high' | 'medium' | 'low';
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
}

export const PRIORITY_CONFIGS: Record<1 | 2 | 3 | 4, PriorityConfig> = {
  1: {
    level: 1,
    dbValue: 'urgent',
    label: 'P1 - Critical',
    shortLabel: 'P1',
    color: '#F43F5E',      // Red
    bgColor: '#F43F5E20',
  },
  2: {
    level: 2,
    dbValue: 'high',
    label: 'P2 - High',
    shortLabel: 'P2',
    color: '#F97316',      // Orange
    bgColor: '#F9731620',
  },
  3: {
    level: 3,
    dbValue: 'medium',
    label: 'P3 - Medium',
    shortLabel: 'P3',
    color: '#FACC15',      // Yellow
    bgColor: '#FACC1520',
  },
  4: {
    level: 4,
    dbValue: 'low',
    label: 'P4 - Low',
    shortLabel: 'P4',
    color: '#3B82F6',      // Blue
    bgColor: '#3B82F620',
  },
};

export const DEFAULT_PRIORITY_LEVEL = 3;  // P3 (Medium)

// Helper: Get config from database priority value
export function getPriorityConfig(dbPriority?: string): PriorityConfig {
  const level = PRIORITY_TO_LEVEL[dbPriority || 'medium'] || 3;
  return PRIORITY_CONFIGS[level];
}

// Helper: Get database value from P1-P4 level
export function getPriorityDbValue(level: 1 | 2 | 3 | 4): string {
  return PRIORITY_MAP[level];
}

// Helper: Sort tasks by priority (P1 first = ascending)
export function sortByPriority<T extends { priority?: string }>(tasks: T[], ascending = true): T[] {
  return [...tasks].sort((a, b) => {
    const levelA = PRIORITY_TO_LEVEL[a.priority || 'medium'] || 3;
    const levelB = PRIORITY_TO_LEVEL[b.priority || 'medium'] || 3;
    return ascending ? levelA - levelB : levelB - levelA;
  });
}
