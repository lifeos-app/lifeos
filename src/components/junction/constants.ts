import type { JunctionTradition } from '../../hooks/useJunction';

// ═══ Faith Path Website Mapping ═══
export const FAITH_PATH_URLS: Record<string, { url: string; siteName: string; tagline: string }> = {
  buddhism: { url: 'https://dharmapath.com.au', siteName: 'DharmaPath', tagline: 'The Middle Way — mindfulness, meditation & liberation' },
  hinduism: { url: 'https://vedapath.com.au', siteName: 'VedaPath', tagline: 'Sanātana Dharma — eternal truth & cosmic order' },
  islam: { url: 'https://islamicpath.com.au', siteName: 'IslamicPath', tagline: 'Submission & peace — prayer, charity & devotion' },
  tewahedo: { url: 'https://tewahedo.com.au', siteName: 'Tewahedo', tagline: 'Ancient Christianity — fasting, prayer & mystical devotion' },
};

export function getFaithPathInfo(slug: string) {
  return FAITH_PATH_URLS[slug] || null;
}

// ═══ Tradition Categories ═══
export type TraditionCategory = 'All' | 'Abrahamic' | 'Eastern' | 'Indigenous' | 'Philosophical' | 'Lifestyle' | 'Fitness' | 'Career' | 'Education' | 'Health' | 'Wellness';

// All available category tabs for filter UI (in display order)
export const CATEGORY_TABS: TraditionCategory[] = [
  'All', 'Abrahamic', 'Eastern', 'Indigenous', 'Philosophical',
  'Lifestyle', 'Fitness', 'Career', 'Education', 'Health', 'Wellness',
];

export const TRADITION_CATEGORIES: Record<string, TraditionCategory> = {
  // Spiritual / Religious
  tewahedo: 'Abrahamic',
  islam: 'Abrahamic',
  catholic: 'Abrahamic',
  judaism: 'Abrahamic',
  buddhism: 'Eastern',
  hinduism: 'Eastern',
  sikhism: 'Eastern',
  daoism: 'Eastern',
  dreaming: 'Indigenous',
  stoicism: 'Philosophical',
  // Secular lifestyle junctions
  the_game: 'Lifestyle',
  clean_slate: 'Lifestyle',
  iron_protocol: 'Fitness',
  the_grind: 'Career',
  brain_forge: 'Education',
  stack_overflow: 'Education',
  gut_check: 'Health',
  monk_mode: 'Wellness',
};

// ═══ Alpha/Omega Messages ═══
export const ALPHA_MESSAGES: Record<string, string> = {
  // Spiritual traditions
  tewahedo: "Selam. You have chosen the ancient path of the Ethiopian Church. Walk in the footsteps of saints and kings. ☦️",
  islam: "As-salamu alaykum. You have entered the path of submission. Five pillars guide your way. ☪️",
  buddhism: "May you awaken. The Middle Way opens before you — free from extremes, rooted in compassion. ☸️",
  hinduism: "Om. You walk the eternal Dharma. The cosmic dance of Brahman awaits your devotion. 🕉️",
  sikhism: "Sat Sri Akal. Truth is eternal. Walk with courage, serve with love, remember the One. 🪯",
  judaism: "Shalom. You have entered the covenant. Study Torah, keep the commandments, sanctify time. ✡️",
  stoicism: "Welcome, philosopher. Master yourself, accept fate, live with virtue and reason. 🏛️",
  catholic: "Pax Christi. You walk the path of universal communion. The saints accompany you. ⛪",
  daoism: "The Way unfolds. Flow like water, act without force, embrace the mystery of nature. ☯️",
  dreaming: "You walk the ancient paths. Country calls you. The ancestors are near. 🌀",
  rhasta: "Welcome, seeker. I am Ras Tafari. Before you is a path — not of religion, but of rhythm. Time and spirit, together. 🦁",
  // Secular junctions
  the_game: "Welcome, player. The world is a social arena — and you just suited up. Every stranger is a quest. Every room is a level. Let's play. 🎯",
  iron_protocol: "Stand at attention, recruit. The iron protocol is now in effect. No excuses. No shortcuts. Just reps, discipline, and results. 🔗",
  the_grind: "Clock in. The grind doesn't care about your feelings — it cares about your output. Revenue. Skill. Network. Let's build. ⚙️",
  clean_slate: "Exhale. Look around — the clutter didn't appear overnight, and it won't vanish overnight. One room. One surface. One breath. Start here. 🧹",
  brain_forge: "System boot complete. Welcome to the Forge — where minds are reforged through study, repetition, and intellectual force. Initialize learning sequence. 🧬",
  stack_overflow: "Hello, World. You've entered the terminal. Every expert was once a beginner who refused to quit. Start typing. 🖥️",
  gut_check: "Open the fridge. What do you see? That inventory is your character sheet. Every meal is a stat point. Choose wisely. 🔬",
  monk_mode: "Silence. The noise fades. The screen dims. What remains is you — present, still, grateful. Welcome to the monastery of the self. 🕯️",
};

export const OMEGA_MESSAGES: Record<string, string> = {
  // Spiritual traditions
  tewahedo: "You have walked the ancient path with devotion. The saints witness your faithfulness. Go in peace, child of Zion. ☦️",
  islam: "Ma sha'Allah. You have fulfilled what was asked. Your discipline honours the Creator. Walk on with peace. ☪️",
  buddhism: "The path continues, but you have walked it well. Suffering dissolves where mindfulness endures. Go gently. ☸️",
  hinduism: "Your karma is purified. The cosmic dance turns, and you have moved in rhythm with Dharma. Om Shanti. 🕉️",
  sikhism: "Waheguru. You served with love and walked with courage. The One is pleased. Rise and serve again. 🪯",
  judaism: "You have sanctified your time and honoured the covenant. Shalom — peace be upon your days. ✡️",
  stoicism: "You endured. You reasoned. You mastered yourself. This is the only victory that matters. 🏛️",
  catholic: "Well done, faithful servant. The communion of saints rejoices with you. Go forth in grace. ⛪",
  daoism: "You flowed like water and found the Way without force. The mystery deepens. Walk on. ☯️",
  dreaming: "The ancestors smile. You walked the songlines. Country remembers. Return when called. 🌀",
  rhasta: "With faith, courage, and a just cause — David will still beat Goliath. You conquered. Rise, champion. 🦁",
  // Secular junctions
  the_game: "Level complete. You talked to strangers, held eye contact, and owned the room. The game never ends — but you just proved you can play. 🎯",
  iron_protocol: "Mission accomplished, soldier. You did the reps. You hit the macros. You earned every pound and every breath of discipline. Stay hard. 🔗",
  the_grind: "Revenue closed. Skills sharpened. Network expanded. You didn't just survive the grind — you made it work for you. ⚙️",
  clean_slate: "Room by room, you reclaimed your space. The excess is gone. What remains is what matters. Breathe deep. You're home. 🧹",
  brain_forge: "Knowledge compiled. Streak unbroken. Concepts mastered. Your mind is the sharpest tool in the forge — and you just proved it. 🧬",
  stack_overflow: "Build complete. No syntax errors. You shipped code that works. From 'Hello World' to production — that's the real stack overflow. 🖥️",
  gut_check: "Macros hit. Cravings conquered. Your gut — and your discipline — are dialed in. The foundation of health is built one meal at a time. 🔬",
  monk_mode: "The bell rings. You emerge from silence with clarity, gratitude, and presence. The world is loud, but you carried the quiet with you. 🕯️",
};

// Tier label map
export const TIER_LABELS: Record<number, string> = {
  0: 'Seeker',
  1: 'Acolyte',
  2: 'Adept',
  3: 'Master',
  4: 'Exalted',
  5: 'Legend',
  6: 'Prophet',
  7: 'Divine',
};

// Tradition metadata for network display
export const TRADITION_META: Record<string, { icon: string; color: string }> = {
  // Spiritual traditions
  buddhism: { icon: '☸️', color: '#FF8F00' },
  hinduism: { icon: '🕉️', color: '#E65100' },
  islam: { icon: '☪️', color: '#2E7D32' },
  tewahedo: { icon: '☦️', color: '#D4AF37' },
  sikhism: { icon: '🪯', color: '#1565C0' },
  judaism: { icon: '✡️', color: '#1A237E' },
  stoicism: { icon: '🏛️', color: '#455A64' },
  catholic: { icon: '⛪', color: '#6B21A8' },
  daoism: { icon: '☯️', color: '#059669' },
  dreaming: { icon: '🌀', color: '#B45309' },
  // Secular junctions
  the_game: { icon: '🎯', color: '#E11D48' },
  iron_protocol: { icon: '🔗', color: '#7C3AED' },
  the_grind: { icon: '⚙️', color: '#0891B2' },
  clean_slate: { icon: '🧹', color: '#0D9488' },
  brain_forge: { icon: '🧬', color: '#7C3AED' },
  stack_overflow: { icon: '🖥️', color: '#2563EB' },
  gut_check: { icon: '🔬', color: '#16A34A' },
  monk_mode: { icon: '🕯️', color: '#92400E' },
};

// ═══ Junction Quest Tiers ═══
// Themed quest progressions for each junction type — the 'game library' aspect
export interface JunctionTier {
  tier: number;
  name: string;
  quests: string[];
}

export const JUNCTION_QUEST_TIERS: Record<string, JunctionTier[]> = {
  the_game: [
    { tier: 1, name: 'Warm-Up', quests: ['Start a conversation with a stranger', 'Make eye contact and smile at 5 people today', 'Ask someone for a recommendation — anything', 'Give a genuine compliment to someone you barely know'] },
    { tier: 2, name: 'Player', quests: ['Ask someone for their number or social handle', 'Tell a story that makes a group laugh', 'Navigate an awkward silence without checking your phone', 'Attend a social event solo and leave with one new connection'] },
    { tier: 3, name: 'High Roller', quests: ['Lead a conversation with someone visibly out of your league', 'Deliver a 30-second pitch about yourself with zero hesitancy', 'De-escalate a tense situation with calm words', 'Host a gathering and make every guest feel welcome'] },
  ],
  iron_protocol: [
    { tier: 1, name: 'Recruit', quests: ['Complete your first workout this week', 'Log every meal for 3 consecutive days', 'Do 50 push-ups total across the day', 'Walk 10,000 steps before midnight'] },
    { tier: 2, name: 'Soldier', quests: ['Hit a progressive overload PR on any lift', 'Meal-prep all lunches for the work week', 'Complete a 30-minute session with zero phone checks', 'Track your body composition — weight, waist, or photos'] },
    { tier: 3, name: 'Warrior', quests: ['Complete a 4-week training block without missing a session', 'Hit macro targets 5 days in a row', 'Run or ruck 5km under a target pace', 'Complete a mobility routine every day for one week'] },
  ],
  the_grind: [
    { tier: 1, name: 'Hustler', quests: ['Send 3 cold outreach messages today', 'Spend 1 hour deep-working with zero distractions', 'Identify your top revenue-generating activity and do it first', 'Write down your quarterly revenue target'] },
    { tier: 2, name: 'Grinder', quests: ['Close one deal or acquire one paying client', 'Attend a networking event and follow up within 24 hours', 'Ship a visible improvement to your product or service', 'Block 2 hours of deep work and protect it like a meeting'] },
    { tier: 3, name: 'Operator', quests: ['Automate one repetitive task in your workflow', 'Hire, delegate, or outsource one task this week', 'Review your P&L and cut one unnecessary expense', 'Build a system that generates leads while you sleep'] },
  ],
  clean_slate: [
    { tier: 1, name: 'Fresh Start', quests: ['Clear one flat surface completely — desk, counter, or table', 'Throw away or donate 10 items you have not used in a year', 'Spend 15 minutes organizing one drawer', 'Take a before photo of the messiest room in your home'] },
    { tier: 2, name: 'Clear Space', quests: ['Declutter an entire room following the 4-box method', 'Implement a one-in-one-out rule for 7 days', 'Cancel 3 subscriptions you do not actively use', 'Digitize paper clutter — scan or shred 20 documents'] },
    { tier: 3, name: 'Clean Slate', quests: ['Maintain a clear kitchen counter for 5 consecutive days', 'Complete a full home audit — every room, every closet', 'Sell or donate everything that fails the spark-joy test', 'Create a weekly reset routine and follow it for 2 weeks'] },
  ],
  brain_forge: [
    { tier: 1, name: 'Initiate', quests: ['Complete 4 Pomodoro sessions in one day', 'Study one new concept and explain it in your own words', 'Maintain a study streak of 3 consecutive days', 'Review yesterday\'s notes using spaced repetition'] },
    { tier: 2, name: 'Scholar', quests: ['Complete a 5-day study streak with at least 2 Pomodoros daily', 'Teach a concept you learned to someone else', 'Finish a chapter or module of a structured course', 'Create a mind map connecting 3 topics you studied this week'] },
    { tier: 3, name: 'Architect', quests: ['Maintain a 14-day study streak', 'Complete an entire course or certification track', 'Write a summary of everything you learned this month', 'Apply a learned concept to a real-world problem or project'] },
  ],
  stack_overflow: [
    { tier: 1, name: 'Newbie', quests: ['Set up your dev environment and write Hello World', 'Complete 3 beginner coding challenges', 'Follow a tutorial and build a working mini-project', 'Push your first commit to a repository'] },
    { tier: 2, name: 'Dev', quests: ['Build a project from scratch without following a tutorial step-by-step', 'Fix a bug in your own code using systematic debugging', 'Write a function with proper error handling and tests', 'Read and understand someone else\'s open-source code'] },
    { tier: 3, name: 'Engineer', quests: ['Ship a project that someone else can use — deploy it or share the repo', 'Refactor a codebase following clean code principles', 'Contribute to an open-source project — even a doc fix counts', 'Build a full feature end-to-end: frontend, backend, and deploy'] },
  ],
  gut_check: [
    { tier: 1, name: 'Aware', quests: ['Log every meal and drink for 3 days', 'Hit your daily water intake target', 'Identify your top 3 nutritional blind spots', 'Go one full day without added sugar'] },
    { tier: 2, name: 'Disciplined', quests: ['Track macros accurately for 5 consecutive days', 'Meal-prep a balanced menu for the entire work week', 'Complete a 16-hour intermittent fast', 'Swap 3 processed staples for whole-food alternatives'] },
    { tier: 3, name: 'Optimized', quests: ['Hit macro and micro targets 6 days in a row', 'Complete a 30-day dietary protocol with no cheat days', 'Log before-and-after bloodwork or biometric measurements', 'Cook 90% of your meals at home for two full weeks'] },
  ],
  monk_mode: [
    { tier: 1, name: 'Postulant', quests: ['Complete a 10-minute meditation session', 'Spend one evening with zero screen entertainment', 'Write down 3 things you are grateful for', 'Go to bed at a consistent time for 3 nights'] },
    { tier: 2, name: 'Novice', quests: ['Complete a digital detox of 12 continuous hours', 'Meditate for 20 minutes every day for 5 days', 'Write a morning journal entry for 7 consecutive days', 'Spend a full Saturday offline with no social media'] },
    { tier: 3, name: 'Monk', quests: ['Complete a 24-hour total digital fast', 'Maintain a daily meditation practice for 21 days', 'Practice a gratitude ritual morning and night for 2 weeks', 'Spend one full day in contemplative solitude — no inputs, only presence'] },
  ],
};

// Fallback traditions if DB is empty
export const FALLBACK_TRADITIONS: JunctionTradition[] = [
  // ──── Spiritual / Religious Traditions ────
  { id: 'tewahedo', name: 'Tewahedo', slug: 'tewahedo', icon: '☦️', description: 'Ethiopian Orthodox tradition of ancient Christianity, fasting discipline, and mystical devotion.', color: '#D4AF37', background_gradient: null, available: true, calendar_type: 'ethiopian', paths: [
    { id: 'monastic', name: 'Monastic', description: 'Path of ascetic discipline and deep prayer', icon: '🏔️' },
    { id: 'liturgical', name: 'Liturgical', description: 'Path of sacred worship and hymnal tradition', icon: '🕯️' },
    { id: 'scholarly', name: 'Scholarly', description: 'Path of theological study and scriptural wisdom', icon: '📜' },
  ]},
  { id: 'islam', name: 'Islam', slug: 'islam', icon: '☪️', description: 'The path of submission to the One God through prayer, fasting, and righteous action.', color: '#2E7D32', background_gradient: null, available: true, calendar_type: 'hijri', paths: [] },
  { id: 'buddhism', name: 'Buddhism', slug: 'buddhism', icon: '☸️', description: 'The Middle Way — mindfulness, compassion, and liberation from suffering.', color: '#FF8F00', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'hinduism', name: 'Hinduism', slug: 'hinduism', icon: '🕉️', description: 'Sanātana Dharma — cosmic order, devotion, knowledge, and righteous action.', color: '#E65100', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'sikhism', name: 'Sikhism', slug: 'sikhism', icon: '🪯', description: 'One God, honest living, service to humanity, and the warrior-saint ideal.', color: '#1565C0', background_gradient: null, available: true, calendar_type: 'nanakshahi', paths: [] },
  { id: 'judaism', name: 'Judaism', slug: 'judaism', icon: '✡️', description: 'Covenant, Torah study, prayer, and the sanctification of everyday life.', color: '#1A237E', background_gradient: null, available: true, calendar_type: 'hebrew', paths: [] },
  { id: 'stoicism', name: 'Stoicism', slug: 'stoicism', icon: '🏛️', description: 'Virtue, reason, self-mastery, and alignment with nature\'s order.', color: '#455A64', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'catholic', name: 'Catholic', slug: 'catholic', icon: '⛪', description: 'Universal Church — sacraments, saints, and sacred tradition.', color: '#6B21A8', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'daoism', name: 'Daoism', slug: 'daoism', icon: '☯️', description: 'The Way — harmony, simplicity, and the flow of nature.', color: '#059669', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'dreaming', name: 'Aboriginal Dreaming', slug: 'dreaming', icon: '🌀', description: 'The oldest living spiritual tradition — Country, kinship, and the eternal Dreaming.', color: '#B45309', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },

  // ──── Secular Lifestyle Junctions ────
  { id: 'the_game', name: 'The Game', slug: 'the_game', icon: '🎯', description: 'Social mastery as a game. Build confidence, sharpen conversation, own every room you walk into.', color: '#E11D48', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'charisma', name: 'Charisma', description: 'First impressions, storytelling, and magnetic presence', icon: '💬' },
    { id: 'courage', name: 'Courage', description: 'Approach anxiety, vulnerability, and bold action', icon: '⚡' },
    { id: 'connection', name: 'Connection', description: 'Deep rapport, active listening, and real relationships', icon: '🤝' },
  ]},
  { id: 'iron_protocol', name: 'Iron Protocol', slug: 'iron_protocol', icon: '🔗', description: 'Military-grade fitness discipline. Progressive overload, precise nutrition, forged physique.', color: '#7C3AED', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'strength', name: 'Strength', description: 'Progressive overload, compound lifts, and raw power', icon: '🏋️' },
    { id: 'endurance', name: 'Endurance', description: 'Cardiovascular capacity, rucking, and conditioning', icon: '🏃' },
    { id: 'composition', name: 'Composition', description: 'Body fat targets, macro precision, and meal prep', icon: '⚖️' },
  ]},
  { id: 'the_grind', name: 'The Grind', slug: 'the_grind', icon: '⚙️', description: 'Business and career hustle — self-aware edition. Revenue targets, skill trees, and ruthless prioritization.', color: '#0891B2', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'revenue', name: 'Revenue', description: 'Sales pipelines, closing rates, and income growth', icon: '💰' },
    { id: 'skills', name: 'Skill Tree', description: 'Technical and soft skill development paths', icon: '🧠' },
    { id: 'network', name: 'Network', description: 'Strategic relationships, mentorship, and community', icon: '🌐' },
  ]},
  { id: 'clean_slate', name: 'Clean Slate', slug: 'clean_slate', icon: '🧹', description: 'Declutter your space, simplify your life. Room-by-room liberation from the excess you don\'t need.', color: '#0D9488', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'space', name: 'Space', description: 'Room-by-room decluttering and spatial reset', icon: '🏠' },
    { id: 'digital', name: 'Digital', description: 'Inbox zero, file organization, and digital minimalism', icon: '💻' },
    { id: 'systems', name: 'Systems', description: 'Habit loops, weekly resets, and maintenance rituals', icon: '🔄' },
  ]},
  { id: 'brain_forge', name: 'Brain Forge', slug: 'brain_forge', icon: '🧬', description: 'Cyberpunk academy for the relentless learner. Study streaks, Pomodoro protocols, and spaced repetition.', color: '#7C3AED', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'streaks', name: 'Streaks', description: 'Daily study commitment and consistency tracking', icon: '🔥' },
    { id: 'deep_work', name: 'Deep Work', description: 'Pomodoro blocks, focus rituals, and flow states', icon: '⏱️' },
    { id: 'retention', name: 'Retention', description: 'Spaced repetition, active recall, and knowledge permanence', icon: '📎' },
  ]},
  { id: 'stack_overflow', name: 'Stack Overflow', slug: 'stack_overflow', icon: '🖥️', description: 'Learn to code through project-based quests. Build streaks, ship code, level up from newbie to engineer.', color: '#2563EB', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'frontend', name: 'Frontend', description: 'UI, design systems, and browser craft', icon: '🎨' },
    { id: 'backend', name: 'Backend', description: 'APIs, databases, and server architecture', icon: '🗄️' },
    { id: 'fullstack', name: 'Full Stack', description: 'End-to-end features from database to deploy', icon: '🔧' },
  ]},
  { id: 'gut_check', name: 'Gut Check', slug: 'gut_check', icon: '🔬', description: 'Nutrition as a documentary. Meal logging, macro tracking, intermittent fasting — every bite is data.', color: '#16A34A', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'tracking', name: 'Tracking', description: 'Meal logging, macro counting, and honest food journals', icon: '📊' },
    { id: 'fasting', name: 'Fasting', description: 'Intermittent fasting windows and protocol discipline', icon: '⏳' },
    { id: 'optimization', name: 'Optimization', description: 'Micronutrients, supplements, and bio-individual tuning', icon: '🧪' },
  ]},
  { id: 'monk_mode', name: 'Monk Mode', slug: 'monk_mode', icon: '🕯️', description: 'Digital detox, meditation, and gratitude. The contemplative path — silence is the teacher.', color: '#92400E', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [
    { id: 'silence', name: 'Silence', description: 'Digital detox, sensory reduction, and stillness', icon: '🔇' },
    { id: 'meditation', name: 'Meditation', description: 'Daily sitting practice and breath awareness', icon: '🧘' },
    { id: 'gratitude', name: 'Gratitude', description: 'Thankfulness rituals, journaling, and savoring', icon: '🙏' },
  ]},
];