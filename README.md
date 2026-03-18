# LifeOS

**Your life, gamified.** A personal operating system that turns goals, habits, health, finances, and daily routines into an RPG-style progression system.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)

## What is LifeOS?

LifeOS is a local-first, privacy-respecting personal management app that combines:

- 🎯 **Goal Planning** — Objectives → Epics → Goals → Tasks hierarchy with AI-powered decomposition
- 📅 **Smart Scheduling** — Automatic task scheduling that respects your working hours, priorities, and existing commitments
- 💪 **Habit Tracking** — Daily habits with streaks, completion tracking, and smart reminders
- 🏥 **Health Logging** — Track sleep, exercise, meals, mood, and body metrics
- 💰 **Financial Management** — Income, expenses, bills, budgets, and business client tracking
- 🎮 **Gamification** — XP, levels, achievements, quests, and a living garden that grows with your progress
- 🏰 **The Realm** — A MapleStory-inspired character world with companions, NPCs, and visual progression
- 🤖 **AI Assistant** — Natural language interface for creating tasks, logging data, and planning goals
- 🔄 **Offline-First** — Works without internet via IndexedDB, syncs when online
- 👥 **Multiplayer** — Partner goals, guilds, community features

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Local Storage:** IndexedDB (Dexie-compatible schema)
- **Sync:** Bidirectional sync engine with conflict resolution
- **Styling:** CSS (no framework — hand-crafted pixel art aesthetic)
- **AI:** Provider-agnostic LLM integration (OpenRouter, Gemini, etc.)
- **Desktop:** Tauri (optional — runs as native app)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

```bash
# Clone the repo
git clone https://github.com/LifeOS-app/lifeos.git
cd lifeos

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Set up the database
# Run the SQL files in sql/migrations/ against your Supabase project
# (in order: 001, 002, 003, etc.)

# Start development server
npm run dev
```

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor
3. Run each migration file in `sql/migrations/` in order
4. Run `complete-schema.sql` for the full schema (alternative to individual migrations)
5. Copy your project URL and anon key to `.env`

### Build

```bash
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

## Architecture

```
src/
├── components/    # React components (pages, UI, modals)
├── hooks/         # Custom React hooks
├── lib/           # Core logic
│   ├── sync-engine.ts      # Bidirectional Supabase ↔ IndexedDB sync
│   ├── intent-engine.ts    # Natural language → structured actions
│   ├── smart-scheduler.ts  # Automatic task scheduling algorithm
│   ├── gamification/       # XP, achievements, quests
│   ├── life-planner/       # AI goal decomposition
│   └── llm/                # LLM integration (provider-agnostic)
├── pages/         # Route-level page components
├── stores/        # Zustand state management
├── types/         # TypeScript type definitions
└── utils/         # Shared utilities
```

### Key Design Decisions

- **Local-first:** All data lives in IndexedDB. Supabase is the sync target, not the source of truth during a session.
- **Offline-capable:** Every feature works without internet. Sync happens opportunistically.
- **Provider-agnostic AI:** The intent engine works with any LLM via a standardised prompt/response format.
- **No CSS framework:** Hand-crafted styles for the pixel art RPG aesthetic.

## Features in Detail

### AI Goal Planner
Tell LifeOS "I want to get fit in 3 months" and it will:
1. Decompose the goal into an objective → epics → goals → tasks hierarchy
2. Spread tasks across the full timeline (not crammed into week 1)
3. Assign due dates based on priority (urgent tasks first)
4. Place tasks at domain-appropriate times (exercise at 7am, education at 6am)

### Smart Scheduler
- Respects working hours (6am-10pm default)
- Avoids conflicts with existing events
- Priority-based scheduling (urgent → Monday, low → Friday)
- 180-day planning horizon for long-term goals

### Gamification
- **XP System:** Earn XP for completing tasks, habits, logging health data
- **Levels:** Progress through levels with increasing XP requirements
- **Achievements:** 50+ achievements across all life domains
- **Quests:** Daily/weekly quest chains that reward bonus XP
- **Living Garden:** A visual garden that grows as you complete tasks
- **Companions:** Unlock and level up companion characters

### Sync Engine
- Bidirectional sync: local → Supabase, Supabase → local
- Parallel tier-based sync (respects FK dependencies)
- Paginated pulls (handles tables with >1000 rows)
- Retry queue with exponential backoff
- Initial sync gate (stores wait for first sync before rendering)

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR with a clear description

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgements

Built as an open-source personal operating system for anyone who wants to gamify their life.
