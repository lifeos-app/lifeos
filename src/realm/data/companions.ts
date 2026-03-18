/**
 * Companion Animals Data — The Realm
 *
 * 24 fauna species across 8 categories, earned through multi-domain consistency.
 * Deterministic assignment, bond progression, and canvas render palettes.
 *
 * Supabase tables (run manually):
 *
 * CREATE TABLE realm_fauna (
 *   species_key TEXT PRIMARY KEY,
 *   common_name TEXT NOT NULL,
 *   scientific_name TEXT NOT NULL,
 *   companion_category TEXT NOT NULL,
 *   body_type TEXT NOT NULL CHECK (body_type IN ('canine', 'feline', 'bird', 'large')),
 *   activity_pattern TEXT NOT NULL CHECK (activity_pattern IN ('diurnal', 'nocturnal', 'crepuscular')),
 *   description TEXT NOT NULL
 * );
 *
 * CREATE TABLE realm_companions (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   species_key TEXT NOT NULL REFERENCES realm_fauna(species_key),
 *   companion_name TEXT,
 *   bond_level INTEGER NOT NULL DEFAULT 1,
 *   bond_xp INTEGER NOT NULL DEFAULT 0,
 *   state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'resting', 'sleeping')),
 *   earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 *
 * ALTER TABLE realm_fauna ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "fauna_read" ON realm_fauna FOR SELECT USING (true);
 *
 * ALTER TABLE realm_companions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "companions_own" ON realm_companions FOR ALL USING (auth.uid() = user_id);
 */

// ── Types ────────────────────────────────────────

export interface FaunaSpecies {
  species_key: string;
  common_name: string;
  scientific_name: string;
  companion_category: string;
  body_type: 'canine' | 'feline' | 'bird' | 'large';
  activity_pattern: 'diurnal' | 'nocturnal' | 'crepuscular';
  description: string;
}

export interface UserCompanion {
  id: string;
  user_id: string;
  species_key: string;
  companion_name: string | null;
  bond_level: number;
  bond_xp: number;
  state: 'active' | 'resting' | 'sleeping';
  earned_at: string;
  last_active_at: string;
}

// ── Species Pools (24 species across 8 categories) ──

export const CATEGORY_FAUNA_POOL: Record<string, string[]> = {
  habit:     ['shiba_inu', 'border_collie', 'african_grey'],
  task:      ['german_shepherd', 'red_fox', 'peregrine_falcon'],
  goal:      ['snow_leopard', 'golden_eagle', 'grey_wolf'],
  health:    ['bengal_cat', 'dolphin', 'robin'],
  finance:   ['raccoon', 'magpie', 'ferret'],
  social:    ['golden_retriever', 'capybara', 'budgerigar'],
  journal:   ['siamese_cat', 'owl', 'raven'],
  spiritual: ['white_dove', 'deer', 'elephant'],
};

// ── Fallback Fauna Data ──────────────────────────

export const FALLBACK_FAUNA: Record<string, FaunaSpecies> = {
  shiba_inu:        { species_key: 'shiba_inu',        common_name: 'Shiba Inu',         scientific_name: 'Canis lupus familiaris',    companion_category: 'habit',     body_type: 'canine', activity_pattern: 'diurnal',     description: 'Loyal and spirited, this ancient breed embodies daily dedication.' },
  border_collie:    { species_key: 'border_collie',    common_name: 'Border Collie',     scientific_name: 'Canis lupus familiaris',    companion_category: 'habit',     body_type: 'canine', activity_pattern: 'diurnal',     description: 'The most intelligent herding dog, thrives on routine and purpose.' },
  african_grey:     { species_key: 'african_grey',     common_name: 'African Grey',      scientific_name: 'Psittacus erithacus',      companion_category: 'habit',     body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Remarkable memory and speech — learns patterns like no other bird.' },
  german_shepherd:  { species_key: 'german_shepherd',  common_name: 'German Shepherd',   scientific_name: 'Canis lupus familiaris',    companion_category: 'task',      body_type: 'canine', activity_pattern: 'diurnal',     description: 'Disciplined worker, excels at complex tasks and service.' },
  red_fox:          { species_key: 'red_fox',          common_name: 'Red Fox',           scientific_name: 'Vulpes vulpes',             companion_category: 'task',      body_type: 'canine', activity_pattern: 'crepuscular', description: 'Clever and adaptable, finds solutions others overlook.' },
  peregrine_falcon: { species_key: 'peregrine_falcon', common_name: 'Peregrine Falcon',  scientific_name: 'Falco peregrinus',          companion_category: 'task',      body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Fastest animal alive — executes with precision and speed.' },
  snow_leopard:     { species_key: 'snow_leopard',     common_name: 'Snow Leopard',      scientific_name: 'Panthera uncia',            companion_category: 'goal',      body_type: 'feline', activity_pattern: 'crepuscular', description: 'Ghost of the mountains, patient and persistent in pursuit.' },
  golden_eagle:     { species_key: 'golden_eagle',     common_name: 'Golden Eagle',      scientific_name: 'Aquila chrysaetos',         companion_category: 'goal',      body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Soars above all obstacles, seeing the path to distant goals.' },
  grey_wolf:        { species_key: 'grey_wolf',        common_name: 'Grey Wolf',         scientific_name: 'Canis lupus',               companion_category: 'goal',      body_type: 'canine', activity_pattern: 'crepuscular', description: 'Pack leader that coordinates long-term hunts across vast ranges.' },
  bengal_cat:       { species_key: 'bengal_cat',       common_name: 'Bengal Cat',        scientific_name: 'Prionailurus bengalensis',  companion_category: 'health',    body_type: 'feline', activity_pattern: 'crepuscular', description: 'Athletic and graceful, embodies vitality and agile strength.' },
  dolphin:          { species_key: 'dolphin',          common_name: 'Bottlenose Dolphin', scientific_name: 'Tursiops truncatus',       companion_category: 'health',    body_type: 'large',  activity_pattern: 'diurnal',     description: 'Joyful swimmer, known for healing presence and playfulness.' },
  robin:            { species_key: 'robin',            common_name: 'European Robin',    scientific_name: 'Erithacus rubecula',        companion_category: 'health',    body_type: 'bird',   activity_pattern: 'diurnal',     description: 'First to sing at dawn, welcoming each new day with energy.' },
  raccoon:          { species_key: 'raccoon',          common_name: 'Raccoon',           scientific_name: 'Procyon lotor',             companion_category: 'finance',   body_type: 'canine', activity_pattern: 'nocturnal',   description: 'Resourceful forager with clever hands — wastes nothing.' },
  magpie:           { species_key: 'magpie',           common_name: 'Eurasian Magpie',   scientific_name: 'Pica pica',                 companion_category: 'finance',   body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Collector of shiny things, one of the most intelligent birds.' },
  ferret:           { species_key: 'ferret',           common_name: 'Ferret',            scientific_name: 'Mustela putorius furo',     companion_category: 'finance',   body_type: 'canine', activity_pattern: 'crepuscular', description: 'Playful hunter that stashes treasures in hidden caches.' },
  golden_retriever: { species_key: 'golden_retriever', common_name: 'Golden Retriever',  scientific_name: 'Canis lupus familiaris',    companion_category: 'social',    body_type: 'canine', activity_pattern: 'diurnal',     description: 'The friendliest companion — brings warmth to every gathering.' },
  capybara:         { species_key: 'capybara',         common_name: 'Capybara',          scientific_name: 'Hydrochoerus hydrochaeris', companion_category: 'social',    body_type: 'large',  activity_pattern: 'crepuscular', description: 'Calm and sociable, gets along with every creature it meets.' },
  budgerigar:       { species_key: 'budgerigar',       common_name: 'Budgerigar',        scientific_name: 'Melopsittacus undulatus',   companion_category: 'social',    body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Chatty and cheerful, thrives in companionship and song.' },
  siamese_cat:      { species_key: 'siamese_cat',      common_name: 'Siamese Cat',       scientific_name: 'Felis catus',               companion_category: 'journal',   body_type: 'feline', activity_pattern: 'crepuscular', description: 'Vocal and contemplative, a companion for quiet reflection.' },
  owl:              { species_key: 'owl',              common_name: 'Barn Owl',          scientific_name: 'Tyto alba',                 companion_category: 'journal',   body_type: 'bird',   activity_pattern: 'nocturnal',   description: 'Silent observer of the night, keeper of hidden wisdom.' },
  raven:            { species_key: 'raven',            common_name: 'Common Raven',      scientific_name: 'Corvus corax',              companion_category: 'journal',   body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Storyteller of the animal kingdom, remembers faces for years.' },
  white_dove:       { species_key: 'white_dove',       common_name: 'White Dove',        scientific_name: 'Columba livia',             companion_category: 'spiritual', body_type: 'bird',   activity_pattern: 'diurnal',     description: 'Universal symbol of peace, always finds its way home.' },
  deer:             { species_key: 'deer',             common_name: 'Fallow Deer',       scientific_name: 'Dama dama',                 companion_category: 'spiritual', body_type: 'large',  activity_pattern: 'crepuscular', description: 'Gentle forest dweller, moves with grace through sacred groves.' },
  elephant:         { species_key: 'elephant',         common_name: 'African Elephant',  scientific_name: 'Loxodonta africana',        companion_category: 'spiritual', body_type: 'large',  activity_pattern: 'diurnal',     description: 'Ancient wisdom in gentle strength — never forgets.' },
};

// ── Species Assignment ───────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function assignCompanion(userId: string, dominantCategory: string): string {
  const pool = CATEGORY_FAUNA_POOL[dominantCategory] || CATEGORY_FAUNA_POOL.habit;
  const index = simpleHash(userId) % pool.length;
  return pool[index];
}

export function getDominantPattern(actionCounts: Record<string, number>): string {
  let maxCategory = 'habit';
  let maxCount = 0;
  for (const [category, count] of Object.entries(actionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = category;
    }
  }
  return maxCategory;
}

/**
 * Check if user qualifies for a companion:
 * 7 consecutive days with activity in 3+ domains
 */
export function checkCompanionEligibility(dailyDomainCounts: number[]): boolean {
  if (dailyDomainCounts.length < 7) return false;
  const last7 = dailyDomainCounts.slice(-7);
  return last7.every(count => count >= 3);
}

// ── Bond System ──────────────────────────────────

export const BOND_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2400, 3200];

export function getBondLevel(bondXp: number): number {
  for (let i = BOND_THRESHOLDS.length - 1; i >= 0; i--) {
    if (bondXp >= BOND_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getCompanionState(
  lastActive: string,
  now: Date,
): 'active' | 'resting' | 'sleeping' {
  const diffMs = now.getTime() - new Date(lastActive).getTime();
  const diffHours = diffMs / 3600000;
  if (diffHours < 18) return 'active';
  if (diffHours < 72) return 'resting';
  return 'sleeping';
}

export const BOND_DESCRIPTIONS: Record<number, string> = {
  1: 'Following at a distance',
  2: 'Following at a distance',
  3: 'Following at a distance',
  4: 'Walking alongside you',
  5: 'Walking alongside you',
  6: 'Walking alongside you',
  7: 'Celebrating your victories',
  8: 'Celebrating your victories',
  9: 'Celebrating your victories',
  10: 'Bonded for life',
};

// ── Species Palettes (for canvas rendering) ──────

export const SPECIES_PALETTES: Record<string, { body: string; accent: string; eye: string }> = {
  shiba_inu:        { body: '#D4915E', accent: '#FFF5E6', eye: '#2C1810' },
  border_collie:    { body: '#1C1C1C', accent: '#FFFFFF', eye: '#3D2B1F' },
  african_grey:     { body: '#808080', accent: '#CC3333', eye: '#FFD700' },
  german_shepherd:  { body: '#8B6914', accent: '#1C1C1C', eye: '#2C1810' },
  red_fox:          { body: '#D2691E', accent: '#FFFFFF', eye: '#FFB347' },
  peregrine_falcon: { body: '#4A4A4A', accent: '#FFD700', eye: '#1C1C1C' },
  snow_leopard:     { body: '#C0C0C0', accent: '#2F2F2F', eye: '#7FB3D8' },
  golden_eagle:     { body: '#8B6914', accent: '#FFD700', eye: '#FF8C00' },
  grey_wolf:        { body: '#6E6E6E', accent: '#A9A9A9', eye: '#FFB347' },
  bengal_cat:       { body: '#D4915E', accent: '#1C1C1C', eye: '#4CAF50' },
  dolphin:          { body: '#708090', accent: '#B0C4DE', eye: '#1C1C1C' },
  robin:            { body: '#8B4513', accent: '#FF4500', eye: '#1C1C1C' },
  raccoon:          { body: '#6E6E6E', accent: '#1C1C1C', eye: '#2C1810' },
  magpie:           { body: '#1C1C1C', accent: '#FFFFFF', eye: '#1C1C1C' },
  ferret:           { body: '#D2B48C', accent: '#1C1C1C', eye: '#2C1810' },
  golden_retriever: { body: '#DAA520', accent: '#FFF8DC', eye: '#3D2B1F' },
  capybara:         { body: '#8B6914', accent: '#A0522D', eye: '#1C1C1C' },
  budgerigar:       { body: '#32CD32', accent: '#FFD700', eye: '#1C1C1C' },
  siamese_cat:      { body: '#FFF5E6', accent: '#4A3728', eye: '#4169E1' },
  owl:              { body: '#D2B48C', accent: '#FFF5E6', eye: '#1C1C1C' },
  raven:            { body: '#1C1C1C', accent: '#2F2F4F', eye: '#1C1C1C' },
  white_dove:       { body: '#FAFAFA', accent: '#E8E8E8', eye: '#FF6347' },
  deer:             { body: '#C4A35A', accent: '#FFFFFF', eye: '#3D2B1F' },
  elephant:         { body: '#808080', accent: '#696969', eye: '#3D2B1F' },
};

export function getFaunaSpecies(
  speciesKey: string,
  faunaMap?: Map<string, FaunaSpecies>,
): FaunaSpecies | undefined {
  return faunaMap?.get(speciesKey) ?? FALLBACK_FAUNA[speciesKey];
}
