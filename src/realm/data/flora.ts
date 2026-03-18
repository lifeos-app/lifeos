/**
 * Flora Data — The Realm
 *
 * Species-aware botanical ecosystem with 32 real species across 10 categories.
 * Deterministic species assignment from habit names, velocity-adjusted growth stages.
 */

// ── Types ────────────────────────────────────────

export interface FloraSpecies {
  species_key: string;
  common_name: string;
  scientific_name: string;
  category: string;
  growth_rate_cm_yr: number;
  max_height_m: number;
  description: string;
  sprite_frames: number; // expected sprite sheet frame count
}

// ── Stage Names ──────────────────────────────────

export const STAGE_NAMES = ['Seed', 'Sprout', 'Young', 'Mature', 'Thriving', 'Ancient'] as const;

// ── Species Pools (32 species across 10 categories) ──

export const CATEGORY_SPECIES_POOL: Record<string, string[]> = {
  wellness: ['sacred_lotus', 'lavender', 'chamomile', 'aloe_vera'],
  fitness: ['english_oak', 'redwood', 'baobab'],
  learning: ['olive', 'bodhi_fig', 'ginkgo'],
  finance: ['money_tree', 'jade_plant', 'golden_pothos'],
  spiritual: ['cedar_of_lebanon', 'white_sage', 'sandalwood'],
  productivity: ['bamboo', 'eucalyptus', 'rubber_tree'],
  creative: ['cherry_blossom', 'wisteria', 'bird_of_paradise'],
  social: ['sunflower', 'rose', 'jasmine'],
  health: ['neem', 'turmeric', 'moringa'],
  other: ['common_fern', 'moss', 'ivy'],
};

// ── Fallback Species Data ────────────────────────

const FALLBACK_SPECIES: Record<string, FloraSpecies> = {
  sacred_lotus:      { species_key: 'sacred_lotus',      common_name: 'Sacred Lotus',      scientific_name: 'Nelumbo nucifera',       category: 'wellness',     growth_rate_cm_yr: 60,   max_height_m: 1.5,  description: 'Symbol of purity, rises unblemished from muddy waters.',                    sprite_frames: 7 },
  lavender:          { species_key: 'lavender',           common_name: 'Lavender',          scientific_name: 'Lavandula angustifolia', category: 'wellness',     growth_rate_cm_yr: 30,   max_height_m: 0.9,  description: 'Calming aromatic herb used for centuries in healing gardens.',               sprite_frames: 7 },
  chamomile:         { species_key: 'chamomile',          common_name: 'Chamomile',         scientific_name: 'Matricaria chamomilla',  category: 'wellness',     growth_rate_cm_yr: 40,   max_height_m: 0.6,  description: 'Ancient remedy for sleep and relaxation, gentle as its blooms.',            sprite_frames: 7 },
  aloe_vera:         { species_key: 'aloe_vera',          common_name: 'Aloe Vera',         scientific_name: 'Aloe barbadensis',       category: 'wellness',     growth_rate_cm_yr: 20,   max_height_m: 0.6,  description: 'Desert healer — stores water and medicine in succulent leaves.',             sprite_frames: 7 },
  english_oak:       { species_key: 'english_oak',        common_name: 'English Oak',       scientific_name: 'Quercus robur',          category: 'fitness',      growth_rate_cm_yr: 50,   max_height_m: 25,   description: 'Mighty tree of endurance, can live over 1,000 years.',                      sprite_frames: 7 },
  redwood:           { species_key: 'redwood',            common_name: 'Coast Redwood',     scientific_name: 'Sequoia sempervirens',   category: 'fitness',      growth_rate_cm_yr: 150,  max_height_m: 115,  description: 'Tallest tree on Earth — reaching heights no other species can.',             sprite_frames: 7 },
  baobab:            { species_key: 'baobab',             common_name: 'Baobab',            scientific_name: 'Adansonia digitata',     category: 'fitness',      growth_rate_cm_yr: 20,   max_height_m: 25,   description: 'The "Tree of Life" stores thousands of litres of water in its trunk.',      sprite_frames: 7 },
  olive:             { species_key: 'olive',              common_name: 'Olive',             scientific_name: 'Olea europaea',          category: 'learning',     growth_rate_cm_yr: 30,   max_height_m: 15,   description: 'Symbol of wisdom and peace, bearing fruit for millennia.',                  sprite_frames: 7 },
  bodhi_fig:         { species_key: 'bodhi_fig',          common_name: 'Bodhi Fig',         scientific_name: 'Ficus religiosa',        category: 'learning',     growth_rate_cm_yr: 90,   max_height_m: 30,   description: 'The tree under which the Buddha attained enlightenment.',                   sprite_frames: 7 },
  ginkgo:            { species_key: 'ginkgo',             common_name: 'Ginkgo',            scientific_name: 'Ginkgo biloba',          category: 'learning',     growth_rate_cm_yr: 30,   max_height_m: 25,   description: 'A living fossil, unchanged for 200 million years.',                         sprite_frames: 7 },
  money_tree:        { species_key: 'money_tree',         common_name: 'Money Tree',        scientific_name: 'Pachira aquatica',       category: 'finance',      growth_rate_cm_yr: 60,   max_height_m: 18,   description: 'Braided trunks symbolize locked-in fortune and growth.',                    sprite_frames: 7 },
  jade_plant:        { species_key: 'jade_plant',         common_name: 'Jade Plant',        scientific_name: 'Crassula ovata',         category: 'finance',      growth_rate_cm_yr: 10,   max_height_m: 2.5,  description: 'Known as the "friendship tree" — coin-shaped leaves bring luck.',           sprite_frames: 7 },
  golden_pothos:     { species_key: 'golden_pothos',      common_name: 'Golden Pothos',     scientific_name: 'Epipremnum aureum',      category: 'finance',      growth_rate_cm_yr: 45,   max_height_m: 20,   description: 'Nearly indestructible vine with heart-shaped golden leaves.',               sprite_frames: 7 },
  cedar_of_lebanon:  { species_key: 'cedar_of_lebanon',   common_name: 'Cedar of Lebanon',  scientific_name: 'Cedrus libani',          category: 'spiritual',    growth_rate_cm_yr: 30,   max_height_m: 40,   description: 'Sacred tree of ancient temples, mentioned in the oldest texts.',            sprite_frames: 7 },
  white_sage:        { species_key: 'white_sage',         common_name: 'White Sage',        scientific_name: 'Salvia apiana',          category: 'spiritual',    growth_rate_cm_yr: 25,   max_height_m: 1.5,  description: 'Ceremonial plant used for purification across cultures.',                   sprite_frames: 7 },
  sandalwood:        { species_key: 'sandalwood',         common_name: 'Sandalwood',        scientific_name: 'Santalum album',         category: 'spiritual',    growth_rate_cm_yr: 15,   max_height_m: 10,   description: 'Its heartwood yields an oil prized for meditation and prayer.',             sprite_frames: 7 },
  bamboo:            { species_key: 'bamboo',             common_name: 'Bamboo',            scientific_name: 'Bambusa vulgaris',       category: 'productivity', growth_rate_cm_yr: 900,  max_height_m: 20,   description: 'Fastest growing plant on Earth — up to 91 cm per day.',                     sprite_frames: 7 },
  eucalyptus:        { species_key: 'eucalyptus',         common_name: 'Eucalyptus',        scientific_name: 'Eucalyptus globulus',    category: 'productivity', growth_rate_cm_yr: 200,  max_height_m: 55,   description: 'Rapid coloniser that thrives in harsh conditions.',                         sprite_frames: 7 },
  rubber_tree:       { species_key: 'rubber_tree',        common_name: 'Rubber Tree',       scientific_name: 'Hevea brasiliensis',     category: 'productivity', growth_rate_cm_yr: 100,  max_height_m: 30,   description: 'Source of natural rubber — resilience made material.',                       sprite_frames: 7 },
  cherry_blossom:    { species_key: 'cherry_blossom',     common_name: 'Cherry Blossom',    scientific_name: 'Prunus serrulata',       category: 'creative',     growth_rate_cm_yr: 40,   max_height_m: 12,   description: 'Fleeting beauty of sakura — a reminder to create while we can.',            sprite_frames: 7 },
  wisteria:          { species_key: 'wisteria',           common_name: 'Wisteria',          scientific_name: 'Wisteria sinensis',      category: 'creative',     growth_rate_cm_yr: 300,  max_height_m: 20,   description: 'Cascading purple blooms that transform any structure into art.',            sprite_frames: 7 },
  bird_of_paradise:  { species_key: 'bird_of_paradise',   common_name: 'Bird of Paradise',  scientific_name: 'Strelitzia reginae',     category: 'creative',     growth_rate_cm_yr: 25,   max_height_m: 1.5,  description: 'Nature\'s sculpture — flowers shaped like exotic birds.',                   sprite_frames: 7 },
  sunflower:         { species_key: 'sunflower',          common_name: 'Sunflower',         scientific_name: 'Helianthus annuus',      category: 'social',       growth_rate_cm_yr: 250,  max_height_m: 3,    description: 'Always turns toward the light — and each other.',                           sprite_frames: 7 },
  rose:              { species_key: 'rose',               common_name: 'Rose',              scientific_name: 'Rosa gallica',           category: 'social',       growth_rate_cm_yr: 30,   max_height_m: 3,    description: 'Universal symbol of love and connection, cultivated for 5,000 years.',      sprite_frames: 7 },
  jasmine:           { species_key: 'jasmine',            common_name: 'Jasmine',           scientific_name: 'Jasminum officinale',    category: 'social',       growth_rate_cm_yr: 60,   max_height_m: 4,    description: 'Night-blooming fragrance that draws people together.',                      sprite_frames: 7 },
  neem:              { species_key: 'neem',               common_name: 'Neem',              scientific_name: 'Azadirachta indica',     category: 'health',       growth_rate_cm_yr: 60,   max_height_m: 20,   description: 'The "village pharmacy" — every part of the tree is medicinal.',             sprite_frames: 7 },
  turmeric:          { species_key: 'turmeric',           common_name: 'Turmeric',          scientific_name: 'Curcuma longa',          category: 'health',       growth_rate_cm_yr: 50,   max_height_m: 1,    description: 'Golden spice with powerful anti-inflammatory properties.',                  sprite_frames: 7 },
  moringa:           { species_key: 'moringa',            common_name: 'Moringa',           scientific_name: 'Moringa oleifera',       category: 'health',       growth_rate_cm_yr: 400,  max_height_m: 12,   description: 'The "miracle tree" — leaves contain all essential amino acids.',            sprite_frames: 7 },
  common_fern:       { species_key: 'common_fern',        common_name: 'Common Fern',       scientific_name: 'Dryopteris filix-mas',   category: 'other',        growth_rate_cm_yr: 15,   max_height_m: 1.2,  description: 'Ancient lineage predating flowering plants by 200 million years.',          sprite_frames: 7 },
  moss:              { species_key: 'moss',               common_name: 'Cushion Moss',      scientific_name: 'Leucobryum glaucum',     category: 'other',        growth_rate_cm_yr: 2,    max_height_m: 0.1,  description: 'Patient pioneer — first to colonise bare rock, creating soil for others.',  sprite_frames: 7 },
  ivy:               { species_key: 'ivy',                common_name: 'English Ivy',       scientific_name: 'Hedera helix',           category: 'other',        growth_rate_cm_yr: 270,  max_height_m: 30,   description: 'Tenacious climber that covers and transforms forgotten walls.',             sprite_frames: 7 },
};

// ── Species Assignment ───────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function assignSpecies(habitName: string, category: string): string {
  const pool = CATEGORY_SPECIES_POOL[category] || CATEGORY_SPECIES_POOL.other;
  const index = simpleHash(habitName) % pool.length;
  return pool[index];
}

// ── Growth Stage Calculation ─────────────────────

const BASE_THRESHOLDS = [0, 1, 3, 7, 21, 50]; // days for stages 0-5

export function getGrowthStage(
  streakDays: number,
  growthRateCmYr: number,
): { stage: number; progress: number } {
  // Velocity multiplier: fast growers advance quicker
  // Baseline is 50 cm/yr; scale thresholds inversely
  const velocity = Math.max(0.3, Math.min(3, growthRateCmYr / 50));
  const adjustedThresholds = BASE_THRESHOLDS.map(t =>
    t === 0 ? 0 : Math.max(1, Math.round(t / velocity)),
  );

  let stage = 0;
  for (let i = adjustedThresholds.length - 1; i >= 0; i--) {
    if (streakDays >= adjustedThresholds[i]) {
      stage = i;
      break;
    }
  }

  let progress = 0;
  if (stage < 5) {
    const cur = adjustedThresholds[stage];
    const next = adjustedThresholds[stage + 1];
    progress = Math.min(1, (streakDays - cur) / (next - cur));
  } else {
    progress = 1;
  }

  return { stage, progress };
}

// ── Species Lookup ───────────────────────────────

export function getFloraSpecies(
  speciesKey: string,
  floraMap?: Map<string, FloraSpecies>,
): FloraSpecies | undefined {
  return floraMap?.get(speciesKey) ?? FALLBACK_SPECIES[speciesKey];
}
