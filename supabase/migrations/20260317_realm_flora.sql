-- Migration: Create realm_flora table + seed 32 species
-- Date: 2026-03-17
-- Context: useFlora hook queries realm_flora but table didn't exist.
--          Schema matches FloraSpecies TypeScript interface in src/realm/data/flora.ts.

-- 1. Create table (reference data — no user_id, read-only)
CREATE TABLE IF NOT EXISTS public.realm_flora (
  species_key TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  category TEXT NOT NULL,
  growth_rate_cm_yr INTEGER NOT NULL DEFAULT 50,
  max_height_m REAL NOT NULL DEFAULT 1.0,
  description TEXT NOT NULL DEFAULT '',
  sprite_frames INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.realm_flora ENABLE ROW LEVEL SECURITY;

-- 3. Read-only for authenticated (reference data pattern — mirrors realm_fauna)
CREATE POLICY "realm_flora_select"
  ON public.realm_flora FOR SELECT
  TO authenticated
  USING (true);

-- 4. Anon can also read
CREATE POLICY "realm_flora_select_anon"
  ON public.realm_flora FOR SELECT
  TO anon
  USING (true);

-- 5. Service role manages seeding
CREATE POLICY "realm_flora_service"
  ON public.realm_flora FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 6. Seed all 32 species from flora.ts
INSERT INTO public.realm_flora (species_key, common_name, scientific_name, category, growth_rate_cm_yr, max_height_m, description, sprite_frames)
VALUES
  ('sacred_lotus', 'Sacred Lotus', 'Nelumbo nucifera', 'wellness', 60, 1.5, 'Symbol of purity, rises unblemished from muddy waters.', 7),
  ('lavender', 'Lavender', 'Lavandula angustifolia', 'wellness', 30, 0.9, 'Calming aromatic herb used for centuries in healing gardens.', 7),
  ('chamomile', 'Chamomile', 'Matricaria chamomilla', 'wellness', 40, 0.6, 'Ancient remedy for sleep and relaxation, gentle as its blooms.', 7),
  ('aloe_vera', 'Aloe Vera', 'Aloe barbadensis', 'wellness', 20, 0.6, 'Desert healer — stores water and medicine in succulent leaves.', 7),
  ('english_oak', 'English Oak', 'Quercus robur', 'fitness', 50, 25, 'Mighty tree of endurance, can live over 1,000 years.', 7),
  ('redwood', 'Coast Redwood', 'Sequoia sempervirens', 'fitness', 150, 115, 'Tallest tree on Earth — reaching heights no other species can.', 7),
  ('baobab', 'Baobab', 'Adansonia digitata', 'fitness', 20, 25, 'The "Tree of Life" stores thousands of litres of water in its trunk.', 7),
  ('olive', 'Olive', 'Olea europaea', 'learning', 30, 15, 'Symbol of wisdom and peace, bearing fruit for millennia.', 7),
  ('bodhi_fig', 'Bodhi Fig', 'Ficus religiosa', 'learning', 90, 30, 'The tree under which the Buddha attained enlightenment.', 7),
  ('ginkgo', 'Ginkgo', 'Ginkgo biloba', 'learning', 30, 25, 'A living fossil, unchanged for 200 million years.', 7),
  ('money_tree', 'Money Tree', 'Pachira aquatica', 'finance', 60, 18, 'Braided trunks symbolize locked-in fortune and growth.', 7),
  ('jade_plant', 'Jade Plant', 'Crassula ovata', 'finance', 10, 2.5, 'Known as the "friendship tree" — coin-shaped leaves bring luck.', 7),
  ('golden_pothos', 'Golden Pothos', 'Epipremnum aureum', 'finance', 45, 20, 'Nearly indestructible vine with heart-shaped golden leaves.', 7),
  ('cedar_of_lebanon', 'Cedar of Lebanon', 'Cedrus libani', 'spiritual', 30, 40, 'Sacred tree of ancient temples, mentioned in the oldest texts.', 7),
  ('white_sage', 'White Sage', 'Salvia apiana', 'spiritual', 25, 1.5, 'Ceremonial plant used for purification across cultures.', 7),
  ('sandalwood', 'Sandalwood', 'Santalum album', 'spiritual', 15, 10, 'Its heartwood yields an oil prized for meditation and prayer.', 7),
  ('bamboo', 'Bamboo', 'Bambusa vulgaris', 'productivity', 900, 20, 'Fastest growing plant on Earth — up to 91 cm per day.', 7),
  ('eucalyptus', 'Eucalyptus', 'Eucalyptus globulus', 'productivity', 200, 55, 'Rapid coloniser that thrives in harsh conditions.', 7),
  ('rubber_tree', 'Rubber Tree', 'Hevea brasiliensis', 'productivity', 100, 30, 'Source of natural rubber — resilience made material.', 7),
  ('cherry_blossom', 'Cherry Blossom', 'Prunus serrulata', 'creative', 40, 12, 'Fleeting beauty of sakura — a reminder to create while we can.', 7),
  ('wisteria', 'Wisteria', 'Wisteria sinensis', 'creative', 300, 20, 'Cascading purple blooms that transform any structure into art.', 7),
  ('bird_of_paradise', 'Bird of Paradise', 'Strelitzia reginae', 'creative', 25, 1.5, E'Nature\'s sculpture — flowers shaped like exotic birds.', 7),
  ('sunflower', 'Sunflower', 'Helianthus annuus', 'social', 250, 3, 'Always turns toward the light — and each other.', 7),
  ('rose', 'Rose', 'Rosa gallica', 'social', 30, 3, 'Universal symbol of love and connection, cultivated for 5,000 years.', 7),
  ('jasmine', 'Jasmine', 'Jasminum officinale', 'social', 60, 4, 'Night-blooming fragrance that draws people together.', 7),
  ('neem', 'Neem', 'Azadirachta indica', 'health', 60, 20, E'The "village pharmacy" — every part of the tree is medicinal.', 7),
  ('turmeric', 'Turmeric', 'Curcuma longa', 'health', 50, 1, 'Golden spice with powerful anti-inflammatory properties.', 7),
  ('moringa', 'Moringa', 'Moringa oleifera', 'health', 400, 12, E'The "miracle tree" — leaves contain all essential amino acids.', 7),
  ('common_fern', 'Common Fern', 'Dryopteris filix-mas', 'other', 15, 1.2, 'Ancient lineage predating flowering plants by 200 million years.', 7),
  ('moss', 'Cushion Moss', 'Leucobryum glaucum', 'other', 2, 0.1, E'Patient pioneer — first to colonise bare rock, creating soil for others.', 7),
  ('ivy', 'English Ivy', 'Hedera helix', 'other', 270, 30, 'Tenacious climber that covers and transforms forgotten walls.', 7)
ON CONFLICT (species_key) DO NOTHING;
