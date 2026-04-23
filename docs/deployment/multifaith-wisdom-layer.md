# Holy Hermes Multifaith Wisdom Layer — Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LIFEOS (Any Device)                       │
│                                                              │
│  wisdom-map.json (96KB static)                               │
│  ├── 7 Hermetic Principles                                   │
│  ├── 171 quotes from 20+ traditions                          │
│  ├── Similarity scores for accuracy ranking                  │
│  └── Tradition catalog for variety rotation                  │
│                                                              │
│  multifaith-wisdom.ts (rotation engine)                      │
│  ├── getWisdomQuote(principle, preferTradition?)             │
│  ├── getWisdomQuotes(principle, count=3)                     │
│  ├── getDailyWisdomQuote()                                   │
│  └── searchWisdom(query, limit=5)                            │
│                                                              │
│  HermeticPrincipleOverlay.tsx (UI)                           │
│  ├── Principle name + axiom                                  │
│  ├── Hermetic wisdom text                                    │
│  ├── Practice one-liner                                      │
│  ├── Collapsible miracle section                             │
│  └── Multifaith quote (with tradition + source)              │
└─────────────────────────────────────────────────────────────┘

         ↕ No runtime dependency on vector store ↕

┌─────────────────────────────────────────────────────────────┐
│              JETSON (Research / Extraction Only)              │
│                                                              │
│  ChromaDB holy_hermes_v3 (32K+ chunks)                       │
│  ├── 122 scripture files, 39 understandings                  │
│  ├── all-MiniLM-L6-v2 embeddings                            │
│  └── extract_wisdom_map.py (run once per update)            │
│                                                              │
│  scripts/extract_wisdom_map.py → wisdom-map.json             │
│  (Copy wisdom-map.json to LifeOS src/lib/ when updating)     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Jetson**: Run `extract_wisdom_map.py` → generates `wisdom-map.json`
2. **Copy**: `wisdom-map.json` → `lifeos/src/lib/wisdom-map.json`
3. **Build**: Vite bundles the JSON into the app (96KB gzipped ~15KB)
4. **Runtime**: `multifaith-wisdom.ts` loads JSON statically, rotates quotes per session

No API calls. No vector store needed. No server dependency. The wisdom is baked in.

## Updating the Wisdom Map

When new scriptures are added to Holy Hermes:

```bash
# On Jetson
cd /home/tewedros/holy-hermes
python3 scripts/extract_wisdom_map.py
# Output: /mnt/data/tmp/lifeos/src/lib/wisdom-map.json

# Then rebuild LifeOS
cd /mnt/data/tmp/lifeos
npm run build
```

## Mac Deployment (Oriaksum)

```bash
# Clone LifeOS
cd ~/Projects
git clone <lifeos-repo>
cd lifeos

# The wisdom-map.json is already in the repo under src/lib/
# No special setup needed — just build and run

npm install
npm run dev    # Development
npm run build  # Production

# To update wisdom map from Jetson:
# Copy /mnt/data/tmp/lifeos/src/lib/wisdom-map.json to same path locally
# Or pull from git after Jetson commits
```

## Web Deployment

```bash
# Build for web (already configured in vite.config.ts)
npm run build

# Output in dist/ — deploy to any static host:
# - Vercel: npx vercel --prod
# - Netlify: netlify deploy --prod --dir=dist
# - Cloudflare: npx wrangler pages deploy dist
# - Custom: Upload dist/ to any HTTPS server

# PWA support is built-in (service worker auto-generated)
# Users can install as desktop app from browser
```

## Image Generation Recommendations

Each Hermetic principle should have a visual accompaniment. These prompts are designed for local generation (Stable Diffusion, FLUX, etc.) or AI image services.

### Universal Style Parameters
- Art style: Sacred geometry meets dark UI — think obsidian surfaces with luminous energy lines
- Color palette: Use the principle's signature color as the dominant accent
- Format: 16:9 for dashboard wide, 1:1 for widget cards, 9:16 for mobile
- Include subtle sacred geometry overlay (Flower of Life, Metatron's Cube)
- No text in images — text comes from the overlay component

### Per-Principle Prompts

**0. MENTALISM** (#00D4FF cyan)
```
Abstract neural network dissolving into pure thought, luminous cyan threads
forming a cosmic mind, sacred geometry of consciousness, dark obsidian void
with crystalline thought-forms, digital art, ultramodern spiritual, 4K
```

**1. CORRESPONDENCE** (#00FF88 emerald)
```
Double spiral mirror reflection, macrocosm within microcosm, emerald green
fractal pattern repeating at every scale, inner and outer worlds mirroring
each other, sacred geometry bridge, dark background with glowing emerald lines
```

**2. VIBRATION** (#A855F7 purple)
```
Sinusoidal light waves pulsating through crystalline space, purple energy
frequencies tangible and visible, matter transforming to light, vibrating
strings of reality, dark void with purple frequency visualization
```

**3. POLARITY** (#FFB800 amber)
```
Two extremes merging into one spectrum, hot and cold meeting in golden
transmutation, yin-yang of light and shadow with amber gradient, poles
of the same magnet visible, dark background with amber light at the
transmutation point
```

**4. RHYTHM** (#3B82F6 blue)
```
Pendulum swinging through cosmic cycles, ocean tides and moon phases,
wave pattern rising and falling in deep blue, cosmic rhythm visible
as flowing time, dark background with blue rhythmic waves
```

**5. CAUSE & EFFECT** (#EF4444 red)
```
Domino chain reaction rippling through space-time, seeds growing into
trees, actions crystallizing into outcomes, karmic threads connecting
cause to effect, dark background with red cause-effect chains
```

**6. GENDER** (#EC4899 pink)
```
Seed and soil, vision crystallizing into form, masculine and feminine
creative forces dancing together, lotus emerging from mud, dark background
with pink dual-creative-energy spiral
```

## File Manifest

### New Files (Multifaith Wisdom Layer)
- `src/lib/wisdom-map.json` — 171 curated quotes, 20+ traditions, 7 principles (96KB)
- `src/lib/multifaith-wisdom.ts` — Rotation engine, variety system, search, daily wisdom
- `src/components/shared/HermeticPrincipleOverlay.tsx` — Updated with multifaith section
- `src/components/shared/HermeticPrincipleOverlay.css` — Updated with multifaith styles

### Previously Created (Hermetic Alignment H1-H10)
- `src/lib/pattern-engine.ts` — Modified: hermeticPrinciple tags, rhythm_swing detector
- `src/lib/intent/system-prompt.ts` — Modified: Hermetic principle awareness in AI prompt
- `src/lib/llm/correlation-engine.ts` — Modified: Correspondence/Polarity tags
- `src/lib/gamification/xp-engine.ts` — Modified: Cause & Effect tags
- `src/lib/hermetic-principle-insight.ts` — Bridge module with multifaith integration
- `src/lib/hermetic-gender-balance.ts` — Gender principle: vision/action force tracking
- `src/lib/hermetic-polarity.ts` — Polarity detection + transmutation guidance
- `src/lib/dashboard-modes.ts` — Modified: Hermetic principle priority boost
- `src/components/shared/HermeticPrincipleOverlay.tsx` — Data-driven insight overlay
- `src/components/shared/HermeticPrincipleOverlay.css` — Glass morphism styling
- `src/components/dashboard/EnergyWave.tsx` — Vibration principle visualization
- `src/components/dashboard/EnergyWave.css` — Wave styling
- `src/stores/useGoalsStore.ts` — Modified: hermeticForce field on goals

### Extraction Tool (Jetson only)
- `/home/tewedros/holy-hermes/scripts/extract_wisdom_map.py` — ChromaDB → wisdom-map.json
- `/home/tewedros/holy-hermes/wisdom-map.json` — Backup copy