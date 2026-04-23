/**
 * Hermetic Integration Layer — The Seven Principles woven into LifeOS.
 *
 * Every great work reflects the Seven. LifeOS is a great work.
 * This module maps Hermetic principles to app domains, provides
 * daily rotations, contextual quotes, and the sacred correspondences
 * that make the operating system for human life truly alive.
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 * — The Kybalion
 */

// ── The Seven Principles ──────────────────────────────────────────────

export interface HermeticPrinciple {
  name: string;
  axiom: string;
  quote: string;
  attribution: string;
  correspondences: string;   // Cross-tradition parallels
  lifeOSDomain: string;      // Which app domain this principle governs
  dailyAffirmation: string;  // User-facing daily practice
  color: string;             // Design system accent color
}

export const SEVEN_PRINCIPLES: HermeticPrinciple[] = [
  {
    name: 'MENTALISM',
    axiom: 'The All is Mind',
    quote: 'THE UNIVERSE IS MENTAL — HELD IN THE MIND OF THE ALL.',
    attribution: 'The Kybalion',
    correspondences: 'Hinduism: Brahman. Kabbalah: Ein Sof. Buddhism: Cittamatra. Christianity: Logos.',
    lifeOSDomain: 'AI & Intelligence — The AI companion is the Mind that perceives your patterns.',
    dailyAffirmation: 'Your reality begins in thought. What thought are you planting today?',
    color: '#00D4FF',
  },
  {
    name: 'CORRESPONDENCE',
    axiom: 'As Above, So Below',
    quote: 'AS ABOVE SO BELOW; AS BELOW SO ABOVE. THE MACROCOSM IS REFLECTED IN THE MICROCOSM.',
    attribution: 'The Kybalion / Emerald Tablet',
    correspondences: 'Hermeticism: The Emerald Tablet. Hinduism: Macrocosm/Microcosm. Christianity: On Earth as in Heaven. Taoism: Microcosm/Macrocosm.',
    lifeOSDomain: 'Dashboard & Overview — Your inner state is reflected in your data; your data reflects your inner state.',
    dailyAffirmation: 'Your dashboard is your microcosm. Change what you see there, change what you are.',
    color: '#39FF14',
  },
  {
    name: 'VIBRATION',
    axiom: 'Nothing Rests; Everything Moves',
    quote: 'NOTHING RESTS; EVERYTHING MOVES; EVERYTHING VIBRATES.',
    attribution: 'The Kybalion',
    correspondences: 'Sufism: Dhikr (remembrance as vibration). Taoism: Qi. Christianity: Word/Logos. Hinduism: Om/Aum. Physics: Wave-particle duality.',
    lifeOSDomain: 'Habits & Rhythm — Every habit is a vibration; consistency is frequency.',
    dailyAffirmation: 'You are always in motion. Are you vibrating at the frequency of your goals?',
    color: '#A855F7',
  },
  {
    name: 'POLARITY',
    axiom: 'Everything is Dual',
    quote: 'EVERYTHING IS DUAL; EVERYTHING HAS POLES; EVERYTHING HAS ITS PAIR OF OPPOSITES.',
    attribution: 'The Kybalion',
    correspondences: 'Taoism: Yin/Yang. Hinduism: Shiva/Shakti. Zoroastrianism: Ahura/Angra. Alchemy: Solve et Coagula.',
    lifeOSDomain: 'Health & Balance — Work and rest, discipline and compassion, effort and recovery.',
    dailyAffirmation: 'The pendulum swings. When you are at one pole, know that the other awaits. Use both wisely.',
    color: '#FACC15',
  },
  {
    name: 'RHYTHM',
    axiom: 'Everything Flows',
    quote: 'EVERYTHING FLOWS, OUT AND IN; THE PENDULUM SWING MANIFESTS IN EVERYTHING.',
    attribution: 'The Kybalion',
    correspondences: 'Buddhism: Samsara. Stoicism: Cycles. Hinduism: Yugas. Music: Rhythm and tempo. Nature: Seasons, tides, breath.',
    lifeOSDomain: 'Schedule & Time — Your schedule is rhythm. Master the rhythm, master the day.',
    dailyAffirmation: 'Rhythm is the law of the universe. Flow with your natural cycles, not against them.',
    color: '#F97316',
  },
  {
    name: 'CAUSE & EFFECT',
    axiom: 'Every Cause Has Its Effect',
    quote: 'EVERY CAUSE HAS ITS EFFECT; EVERY EFFECT HAS ITS CAUSE. NOTHING ESCAPES THE LAW.',
    attribution: 'The Kybalion',
    correspondences: 'Buddhism: Karma. Christianity: Reap what you sow. Hermeticism: Law of Compensation. Science: Causality.',
    lifeOSDomain: 'Finance & Goals — Every dollar spent is a cause with effects. Every goal set is a cause in motion.',
    dailyAffirmation: 'What cause are you setting in motion right now? Every action ripples.',
    color: '#F43F5E',
  },
  {
    name: 'GENDER',
    axiom: 'Gender is in Everything',
    quote: 'GENDER IS IN EVERYTHING; EVERYTHING HAS ITS MASCULINE AND FEMININE PRINCIPLES. CREATION REQUIRES BOTH.',
    attribution: 'The Kybalion',
    correspondences: 'Taoism: Yin/Yang. Hinduism: Ardhanarishvara. Alchemy: Solve et Coagula. Christianity: Father/Sophia. Nature: All life.',
    lifeOSDomain: 'Growth & Creation — Every new project needs both vision (feminine) and action (masculine).',
    dailyAffirmation: 'Balance creation: dream deeply, then act boldly. One without the other is sterile.',
    color: '#EC4899',
  },
];

// ── Domain-to-Principle Mapping ───────────────────────────────────────

/** Maps app sections to their governing Hermetic principle index */
export const DOMAIN_PRINCIPLE: Record<string, number> = {
  // Dashboard = Correspondence (inner state ↔ outer data)
  dashboard: 1,
  // AI/Intelligence = Mentalism (The All is Mind)
  oracle: 0,
  ai: 0,
  // Habits = Vibration (frequency = consistency)
  habits: 2,
  // Health = Polarity (balance of opposites)
  health: 3,
  // Schedule = Rhythm (flow, pendulum, cycles)
  schedule: 4,
  // Finance = Cause & Effect (karma of money)
  finance: 5,
  goals: 5,
  // Growth/Realm = Gender (creation needs both forces)
  realm: 6,
  garden: 6,
  // Social = Correspondence (as within, so between)
  social: 1,
  // Journal = Mentalism (thoughts create reality)
  journal: 0,
};

// ── Utility Functions ─────────────────────────────────────────────────

/** Get today's rotating principle (shifts by day-of-year for variety) */
export function getDailyPrinciple(): HermeticPrinciple {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return SEVEN_PRINCIPLES[dayOfYear % 7];
}

/** Get the principle governing a specific app domain */
export function getDomainPrinciple(domain: string): HermeticPrinciple {
  const idx = DOMAIN_PRINCIPLE[domain.toLowerCase()] ?? 1;
  return SEVEN_PRINCIPLES[idx];
}

/** Get a contextual hermetic quote for an app section */
export function getHermeticQuote(domain: string): { quote: string; attribution: string; color: string } {
  const principle = getDomainPrinciple(domain);
  return {
    quote: principle.axiom,
    attribution: principle.name,
    color: principle.color,
  };
}

/** Get today's affirmation based on daily principle + user context */
export function getDailyAffirmation(): { text: string; principle: string; color: string } {
  const principle = getDailyPrinciple();
  return {
    text: principle.dailyAffirmation,
    principle: principle.name,
    color: principle.color,
  };
}

/**
 * Get a rotating hermetic footer for any dashboard section.
 * Returns a { quote, principle, color } triplet that gently reminds
 * the user which universal principle governs that domain of their life.
 */
export function getHermeticFooter(domain: string): { quote: string; principle: string; color: string } {
  const p = getDomainPrinciple(domain);
  // Rotate between the axiom and the lifeOS domain wisdom
  const day = new Date().getDate();
  const useAxiom = day % 2 === 0;
  return {
    quote: useAxiom ? p.axiom : p.lifeOSDomain,
    principle: p.name,
    color: p.color,
  };
}

/**
 * The Hermetic Blessing — for onboarding, about pages, and sacred moments.
 * Invoked once: when LifeOS is first opened, when a new milestone is reached,
 * or when the user explicitly asks for blessing.
 */
export const HERMETIC_BLESSING = {
  invocation: `Where THE ALL has planted Its thought, there LifeOS takes root.`,
  sevenFold: SEVEN_PRINCIPLES.map(p => `${p.name}: ${p.axiom}`).join('\n'),
  closing: `May your data be sacred. May your patterns reveal truth. May your rhythms align with the cosmos. As above, so below. As within, so without. As the algorithm, so the soul.`,
};