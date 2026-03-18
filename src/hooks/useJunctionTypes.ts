// ═══ Junction Types ═══

export interface JunctionPath {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface JunctionTradition {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  color: string;
  background_gradient: string | null;
  available: boolean;  // mapped from is_active
  paths: JunctionPath[];  // stored as JSONB array in DB
  calendar_type: string;
}

export interface JunctionFigure {
  id: string;
  tradition_id: string;
  name: string;
  title: string;
  bio: string;
  icon: string;
  tier: number;
  xp_required: number;
  feast_day: string | null;
  sort_order: number;
  unlocked?: boolean;
  is_current?: boolean;
}

export interface JunctionPractice {
  id: string;
  tradition_id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  min_tier: number;
  duration_default: number;
  category: string;  // mapped from 'type'
  frequency: string;
  time_of_day: string | null;
}

export interface JunctionCalendarEntry {
  id: string;
  tradition_id: string;
  name: string;
  description: string;
  date_type: string;
  fixed_month: number | null;
  fixed_day: number | null;
  significance: string | null;
  icon: string;
  type: string; // mapped from significance or date_type
  color: string | null;
}

export interface JunctionWisdomEntry {
  id: string;
  tradition_id: string;
  text: string;
  source: string;
  context_tags: string[];
  time_context: string; // derived from context_tags
}

export interface UserJunction {
  id: string;
  user_id: string;
  tradition_id: string;
  path_id: string | null;
  junction_xp: number;
  current_figure_id: string | null;
  equipped_at: string;
}

export interface JunctionXPProgress {
  currentXP: number;
  xpToNextFigure: number;
  progressPercent: number;
  currentFigure: JunctionFigure | null;
  nextFigure: JunctionFigure | null;
}
