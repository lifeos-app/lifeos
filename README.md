<h1 align="center">⚡ LifeOS</h1>

<p align="center">
  <strong>Your life is the game. Level up for real.</strong>
</p>

<p align="center">
  <a href="https://app.runlifeos.com">Use LifeOS Free</a> · 
  <a href="https://runlifeos.com">Website</a> · 
  <a href="#self-hosting">Self-Host</a> · 
  <a href="#contributing">Contribute</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.19.20-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/platform-PWA-orange" alt="PWA" />
</p>

---

LifeOS is an open-source personal operating system that turns your goals, habits, finances, health, and daily schedule into a living RPG. Built as a progressive web app — install it on any device, works offline, syncs when connected.

**514 components. 126,000+ lines of TypeScript. One app to run your life.**

<br />

## Why LifeOS?

Most productivity apps solve one problem. LifeOS connects everything:

- Your **goals** break down into tasks that appear on your **schedule**
- Your **habits** feed XP into your **character** who levels up in a living **realm**
- Your **finances** track alongside your **health** so you see the full picture
- Your **AI companion** understands all of it and coaches you in context
- Your **journal** captures reflections that inform your **weekly reviews**

It's not another todo list. It's the system underneath your life.

<br />

## Features

### **Command Center**
A dashboard that actually matters. Morning briefs, today's schedule, habit streaks, financial snapshot, goal progress — all in one glance. Fully customisable layout.

### **Goal Engine**
Hierarchical goal system: Objectives → Epics → Goals → Tasks. AI-powered decomposition breaks ambitious plans into scheduled, actionable steps spread across realistic timelines.

### **Smart Schedule**
Calendar meets task manager. Events, tasks, and habits on one timeline. Drag to reschedule. Conflict detection. Deep-link notifications that highlight exactly what needs attention.

### **Habit Tracking**
Streak-based habits with XP rewards. Habit garden where plants grow with consistency and wilt when you break the chain. Custom frequencies, reminders, and analytics.

### **Finance Dashboard**
Income, expenses, budgets, and net worth tracking. Visual breakdowns by category. Business and personal separation. CSV import for bank statements.

### **Health & Wellness**
Mood, energy, sleep, stress, and exercise logging. Guided check-ins. Correlations between your health metrics and productivity patterns.

### **The Realm** *(RPG Engine)*
Your real life rendered as a fantasy world. Character with class, equipment, and stats derived from your actual habits and achievements. NPC companions, quest board, procedural music, dynamic weather that reflects your emotional state.

### **Junction** *(Spiritual Practice)*
Multi-tradition spiritual companion. Daily practices, wisdom traditions, sacred texts, and guided reflections from Christianity, Islam, Buddhism, Hinduism, Sikhism, Tewahedo, and more.

### **AI Companion**
Context-aware AI chat that knows your goals, schedule, habits, and history. Plan objectives, get coaching, decompose projects, generate meal plans, optimise your week — all from natural conversation.

### **Journal & Reviews**
Daily journal with mood tagging. Weekly reviews that surface patterns, celebrate wins, and recalibrate priorities. Guided reflection prompts.

### **Social & Multiplayer**
Guilds, partnerships, community leaderboards, and shared challenges. Accountability through friendly competition.

### **Works Everywhere**
Progressive Web App — install on iOS, Android, Mac, Windows, Linux. Offline-first with IndexedDB. Background sync when connected. No app store needed.

<br />

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | CSS (no framework — full custom) |
| State | Zustand (9 stores) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Offline | IndexedDB with tiered sync engine |
| AI | OpenRouter (multi-model, server-proxied) |
| Deploy | Static build → any CDN or server |
| Auth | Supabase Auth (Google OAuth + email) |

<br />

## Quick Start

### Use the hosted version (recommended)

**[app.runlifeos.com](https://app.runlifeos.com)** — free, always up to date, no setup required.

Works on any device with a browser. Install as a PWA for the native app experience.

<br />

### Self-Hosting

Want to run your own instance? LifeOS is fully open source.

#### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- An [OpenRouter](https://openrouter.ai) API key (for AI features)

#### Setup

```bash
# Clone the repo
git clone https://github.com/lifeos-app/lifeos.git
cd lifeos

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL, anon key, and API base URL

# Start development server
npm run dev
```

#### Environment Variables

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_BASE_URL=https://your-server.com    # LLM proxy endpoint
```

#### Database Setup

The app uses Supabase with Row Level Security. Migration files are in `supabase/migrations/`. You'll need to set up the base schema in your Supabase project — see the [Supabase docs](https://supabase.com/docs) for getting started.

> **Note:** The migration files handle incremental changes. If you need help setting up the complete schema, [open an issue](https://github.com/lifeos-app/lifeos/issues) or check the discussions — the community can help.

#### Production Build

```bash
npm run build
# Deploy the `dist/` folder to any static host
```

<br />

## Project Structure

```
src/
├── components/     # 200+ React components
├── pages/          # 24 page-level views
├── stores/         # Zustand state management (9 stores)
├── lib/            # Core engines (sync, habits, finance, AI, gamification)
├── hooks/          # Custom React hooks
├── utils/          # Shared utilities
└── types/          # TypeScript definitions

public/
├── images/         # NPC artwork, custom illustrations
└── junction/       # Spiritual tradition assets
```

<br />

## Contributing

LifeOS is built by a small team and contributions are welcome.

### Good first contributions
- **Schema documentation** — Help document the full database schema for self-hosters
- **Bug fixes** — Check [open issues](https://github.com/lifeos-app/lifeos/issues)
- **New integrations** — Plugin system supports custom data sources
- **Translations** — Help make LifeOS accessible in more languages
- **Mobile UX** — PWA refinements for iOS/Android edge cases

### How to contribute

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Submit a PR with a clear description

<br />

## Roadmap

- [ ] Desktop app (Tauri)
- [ ] Telegram bot integration
- [ ] Plugin marketplace
- [ ] Shared goals & family accounts
- [ ] Wearable data import (Apple Health, Google Fit)
- [ ] Public API

<br />

## License

MIT — use it, fork it, build on it.

<br />

---

<p align="center">
  <strong>Built in Melbourne, Australia</strong>
  <br />
  <a href="https://teddyscleaning.com.au">Teddy's Cleaning Systems</a> · <a href="https://app.runlifeos.com">Try LifeOS</a>
</p>
