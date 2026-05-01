/**
 * useDreamJournal.ts — Core hook for Dream Journal & Subconscious Tracker
 *
 * Manages dream entries via the Zustand store, auto-links next-day
 * health/mood data, detects recurring symbols, and pattern-matches
 * against symbol databases from Junction's 18 traditions.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDreamStore, type DreamEntry, type DreamMood } from '../../stores/dreamStore';
import { useHealthStore } from '../../stores/useHealthStore';

// ── Symbol Databases (18 Traditions) ────────────────────────────────

export interface SymbolMeaning {
  tradition: string;
  traditionName: string;
  meaning: string;
  element?: string;
  polarity?: 'positive' | 'negative' | 'neutral' | 'dual';
}

export interface DreamSymbol {
  name: string;
  emoji: string;
  meanings: SymbolMeaning[];
  category: 'elements' | 'movement' | 'body' | 'architecture' | 'nature' | 'objects' | 'people' | 'abstract';
}

const TRADITION_NAMES: Record<string, string> = {
  hermetic: 'Hermetic',
  buddhism: 'Buddhist',
  jungian: 'Jungian',
  islam: 'Islamic',
  hinduism: 'Hindu',
  stoicism: 'Stoic',
  christian: 'Christian',
  daoism: 'Daoist',
  sikhism: 'Sikh',
  judaism: 'Jewish',
  indigenous: 'Indigenous',
  tewahedo: 'Ethiopian Orthodox',
  catholic: 'Catholic',
  greek: 'Ancient Greek',
  egyptian: 'Ancient Egyptian',
  shamanic: 'Shamanic',
  celtic: 'Celtic',
  zen: 'Zen',
};

export const SYMBOL_DATABASE: DreamSymbol[] = [
  {
    name: 'Water',
    emoji: '🌊',
    category: 'elements',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Fluidity — emotions, the unconscious mind, the realm of feeling that shapes reality.', polarity: 'dual' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'The river of impermanence. All phenomena flow; attachment to form creates suffering.', polarity: 'neutral' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'The collective unconscious. Deep water represents the psyche beneath the persona; clear water suggests emotional clarity.', polarity: 'dual' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'Purification and divine mercy. Flowing water (ma\') symbolizes Allah\'s sustenance; stagnant water warns of spiritual stagnation.', polarity: 'dual' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'The cosmic waters of creation (Brahmanda). Rivers are goddesses; water carries prana and spiritual energy.', polarity: 'positive' },
      { tradition: 'daoism', traditionName: 'Daoist', meaning: 'Water is the supreme teacher — soft yet powerful, yielding yet overcoming. The Dao flows like water.', polarity: 'positive' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'Baptismal rebirth, the Holy Spirit, the living water of Christ. Flood waters represent divine judgment.', polarity: 'dual' },
      { tradition: 'indigenous', traditionName: 'Indigenous', meaning: 'Water is the blood of the Earth Mother. Dreaming of water connects to Country, healing ceremony, and the Dreaming.', polarity: 'positive' },
    ],
  },
  {
    name: 'Flying',
    emoji: '🕊️',
    category: 'movement',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'As above, so below — the Principle of Correspondence. Flying signals liberation from material gravity, spiritual ascension.', polarity: 'positive' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Transcendence of the ego. Flight dreams indicate rising above a situation, gaining perspective, or escaping inferiority.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Freedom from attachment. The mind untethered soars above samsara; a sign of meditative progress.', polarity: 'positive' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'The soul\'s ascent (Mi\'raj). Prophet Muhammad\'s night journey through the heavens — spiritual elevation and divine proximity.', polarity: 'positive' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'The atman\'s liberation (moksha). Garuda, the divine eagle, carries Vishnu — flight is divine service and transcendence.', polarity: 'positive' },
      { tradition: 'shamanic', traditionName: 'Shamanic', meaning: 'Soul flight or astral travel. The shaman journeys between worlds; flying in dreams is an initiatory experience.', polarity: 'positive' },
      { tradition: 'daoism', traditionName: 'Daoist', meaning: 'The immortal\'s flight — transcending earthly attachments. Cloud-walking sages rise above mundane concerns.', polarity: 'positive' },
    ],
  },
  {
    name: 'Falling',
    emoji: '⬇️',
    category: 'movement',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of rhythm — what rises must fall. Falling signals a swing of the pendulum, loss of spiritual altitude.', polarity: 'negative' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Loss of control or status anxiety. The psyche\'s warning that the ego is overextended; a call for grounding.', polarity: 'negative' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Dukkha — the suffering of loss. Falling represents the inevitability of change and the suffering of clinging.', polarity: 'negative' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'A fall from grace or loss of iman (faith). A reminder that dignity and rank come from Allah alone.', polarity: 'negative' },
      { tradition: 'stoicism', traditionName: 'Stoic', meaning: 'What you control is your response. The fall itself is indifferent — your fear of it is the real adversary.', polarity: 'neutral' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'The Fall of Man — original sin and separation from God. Also: surrender, letting go of self-will.', polarity: 'dual' },
    ],
  },
  {
    name: 'Teeth',
    emoji: '🦷',
    category: 'body',
    meanings: [
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Power and confidence. Teeth falling out = loss of agency, fear of aging, or anxiety about self-image and communication.', polarity: 'negative' },
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The veil of the material body crumbling. Teeth represent the structure of the persona — losing them reveals the true self beneath.', polarity: 'dual' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Anicca — impermanence of the body. Attachment to physical form leads to suffering.', polarity: 'neutral' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'Family members — each tooth represents a household member. Losing teeth can signal concern for family.', polarity: 'negative' },
      { tradition: 'greek', traditionName: 'Ancient Greek', meaning: 'Loss of potency in argument or persuasion — teeth as weapon of rhetoric.', polarity: 'negative' },
    ],
  },
  {
    name: 'Chase',
    emoji: '🏃',
    category: 'movement',
    meanings: [
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'The Shadow pursuing integration. What you run from is what you must face; the pursuer is a disowned part of yourself.', polarity: 'negative' },
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Cause and Effect — you are being chased by the consequences of unexamined actions or thoughts.', polarity: 'dual' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Mara pursuing — the forces of delusion and craving that chase the unawakened mind.', polarity: 'negative' },
      { tradition: 'shamanic', traditionName: 'Shamanic', meaning: 'A power animal or spirit testing your readiness. The chase is an initiation — courage comes from turning to face it.', polarity: 'dual' },
      { tradition: 'stoicism', traditionName: 'Stoic', meaning: 'The only threat is your judgment of the threat. The chaser is your own fear, given form.', polarity: 'neutral' },
    ],
  },
  {
    name: 'Animals',
    emoji: '🦁',
    category: 'nature',
    meanings: [
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Archetypal instincts. Each animal represents a different instinctual force — the lion for courage, the snake for transformation.', polarity: 'neutral' },
      { tradition: 'indigenous', traditionName: 'Indigenous', meaning: 'Totem spirits and ancestors. Animals in dreams are guides from the Dreaming — they bring messages from Country.', polarity: 'positive' },
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Polarity — animals embody raw instinctive forces that must be integrated rather than suppressed.', polarity: 'dual' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'Vahana (divine vehicles) — each deity rides an animal representing their power. Animals are sacred manifestations.', polarity: 'positive' },
      { tradition: 'celtic', traditionName: 'Celtic', meaning: 'Animal guides from the Otherworld. The stag, the boar, the raven — each carries druidic wisdom.', polarity: 'positive' },
      { tradition: 'daoism', traditionName: 'Daoist', meaning: 'Each creature manifests its own Dao — the crane, the tiger, the deer all teach their particular way of being.', polarity: 'neutral' },
    ],
  },
  {
    name: 'Houses',
    emoji: '🏠',
    category: 'architecture',
    meanings: [
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'The Self. Each room is a facet of the psyche — the basement is the unconscious, the attic is higher consciousness, locked rooms are repressed content.', polarity: 'neutral' },
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'As within, so without — the house mirrors the inner architecture of consciousness. Different floors represent different planes of being.', polarity: 'neutral' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'The skandhas (aggregates) — the house of self is made of temporary materials. Entering a house = entering a new state of mind.', polarity: 'neutral' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'The heart is a house — are its doors open to divine light? A ruined house signals a heart in need of repair (tazkiyah).', polarity: 'dual' },
      { tradition: 'fengshui', traditionName: 'Feng Shui', meaning: 'The house is the body — its condition directly affects the inhabitant\'s qi flow. Blocked rooms mean blocked energy.', polarity: 'dual' },
    ],
  },
  {
    name: 'Death',
    emoji: '💀',
    category: 'abstract',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Transformation — death is never an end, always a transit. The alchemical nigredo, the dark night before rebirth.', polarity: 'positive' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Ego death — the end of an old identity. Dying in a dream often signals the most profound transformation: the death of who you were.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Impermanence and rebirth. Death in a dream is the Buddha\'s teaching made visceral — all compound things must pass.', polarity: 'neutral' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'Shiva\'s dance of destruction — destroying to recreate. Death dreams foretell the end of a karmic cycle and liberation.', polarity: 'positive' },
      { tradition: 'egyptian', traditionName: 'Ancient Egyptian', meaning: 'The journey through the Duat — death is the greatest initiation. Osiris dismembered and reborn is your own transformation.', polarity: 'positive' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'Resurrection follows death. Dying in a dream echoes baptism — the old self is buried, the new self rises in Christ.', polarity: 'positive' },
    ],
  },
  {
    name: 'Birth',
    emoji: '🐣',
    category: 'abstract',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Gender — all creation requires both masculine and feminine forces. Birth dreams herald a new cycle of manifestation.', polarity: 'positive' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'The emergence of the Self. Birth represents new potential, a new aspect of personality coming into consciousness.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'A new karmic cycle begins. Birth dreams remind us that becoming is endless until awakening.', polarity: 'neutral' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'Reincarnation — the atman takes new form. Birth dreams can signal the fruition of past karma.', polarity: 'dual' },
    ],
  },
  {
    name: 'Doors',
    emoji: '🚪',
    category: 'architecture',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'Threshold between planes — doors represent transitions, choices, and the Principle of Correspondence (what opens above opens below).', polarity: 'neutral' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'The threshold between conscious and unconscious. An open door invites integration; a locked door indicates repression or unreadiness.', polarity: 'neutral' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'Doors of mercy (bab al-rahmah) and righteousness. Each door you pass through in a dream carries divine significance.', polarity: 'positive' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'Christ is the door. "I am the door; if anyone enters through Me, they will be saved." Doors represent salvation and choice.', polarity: 'positive' },
      { tradition: 'celtic', traditionName: 'Celtic', meaning: 'The threshold between worlds — thin places where the veil between mortal and Otherworld is porous.', polarity: 'neutral' },
    ],
  },
  {
    name: 'Mirrors',
    emoji: '🪞',
    category: 'objects',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'As above, so below — the mirror is the ultimate Hermetic symbol. The reflection reveals hidden correspondences between inner and outer worlds.', polarity: 'neutral' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Self-reflection and the Shadow. The mirror shows what you refuse to see — integrating the reflection is individuation.', polarity: 'neutral' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'The mirror of mind — all phenomena are reflections in consciousness, empty of inherent existence.', polarity: 'neutral' },
      { tradition: 'shamanic', traditionName: 'Shamanic', meaning: 'The mirror is a portal — scrying into reflective surfaces opens gateways to other dimensions.', polarity: 'neutral' },
    ],
  },
  {
    name: 'Fire',
    emoji: '🔥',
    category: 'elements',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Transformation — fire is the great alchemist. It purifies, destroys, and recreates. The alchemical calcination.', polarity: 'dual' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'Agni, the sacred fire — carrier of offerings to the gods, purifier, and witness to all rituals. Fire transforms matter into spirit.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'The fire of desire (tanha) — burning craving that causes suffering. Also: the fire of wisdom that burns away ignorance.', polarity: 'dual' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'Nar (hellfire) as divine justice, but also the light of guidance (nur). Fire dreams test the purity of faith.', polarity: 'dual' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Libidinal energy — creative and destructive. Fire dreams signal powerful transformation or repressed passions demanding expression.', polarity: 'dual' },
      { tradition: 'stoicism', traditionName: 'Stoic', meaning: 'The inner fire of reason (logos spermatikos). Fire dreams may signal the need to refocus on what is within your control.', polarity: 'positive' },
      { tradition: 'egyptian', traditionName: 'Ancient Egyptian', meaning: 'The fiery breath of Ra — creative force and destructive power combined. Fire purifies the soul for the afterlife.', polarity: 'dual' },
    ],
  },
  {
    name: 'Money',
    emoji: '💰',
    category: 'objects',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Correspondence — material wealth reflects inner abundance or scarcity. Money dreams mirror your relationship to worth and value.', polarity: 'dual' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Energy and personal power. Money represents psychic energy — finding money signals discovering inner resources.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Attachment to material forms. Finding money may signal spiritual treasure; losing it signals non-attachment.', polarity: 'neutral' },
      { tradition: 'stoicism', traditionName: 'Stoic', meaning: 'Preferred indifferent. Money is neither good nor bad — only your judgment makes it so.', polarity: 'neutral' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'Talents and stewardship. Money dreams ask: are you using your God-given gifts wisely?', polarity: 'neutral' },
    ],
  },
  {
    name: 'Snakes',
    emoji: '🐍',
    category: 'nature',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The ouroboros — infinity, cyclical renewal. The snake shedding skin is the ultimate symbol of transformation.', polarity: 'positive' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Kundalini energy rising from the base of the spine. The snake represents healing (Caduceus) and the wisdom of the unconscious.', polarity: 'dual' },
      { tradition: 'hinduism', traditionName: 'Hindu', meaning: 'Naga — divine serpent energy. Shesha supports the cosmos; Kundalini serpent power coils at the base of the spine.', polarity: 'positive' },
      { tradition: 'egyptian', traditionName: 'Ancient Egyptian', meaning: 'Wadjet and Renenutet — protector goddesses. The cobra on the pharaoh\'s crown represents divine authority and protection.', polarity: 'positive' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'The serpent in Eden represents temptation, but also the wisdom of discernment. Bronze serpent = healing.', polarity: 'dual' },
    ],
  },
  {
    name: 'Light',
    emoji: '✨',
    category: 'elements',
    meanings: [
      { tradition: 'hermetic', traditionName: 'Hermetic', meaning: 'The Principle of Mind — light is the universal substance of thought. Light in dreams signals the All is revealing truth.', polarity: 'positive' },
      { tradition: 'buddhism', traditionName: 'Buddhist', meaning: 'Enlightenment (bodhi). Radiant dreams signal progress on the path; the inner light of awareness.', polarity: 'positive' },
      { tradition: 'islam', traditionName: 'Islamic', meaning: 'Allah is the Light of the heavens and the earth (Surah An-Nur). Light in dreams is divine guidance and mercy.', polarity: 'positive' },
      { tradition: 'christian', traditionName: 'Christian', meaning: 'Christ as the Light of the World. "Let there be light" — divine illumination and revelation.', polarity: 'positive' },
      { tradition: 'jungian', traditionName: 'Jungian', meaning: 'Consciousness illuminating the shadow. Light dreams signal the ego strengthening and awareness expanding.', polarity: 'positive' },
    ],
  },
];

// ── Available symbol tags ───────────────────────────────────────────

export const DREAM_SYMBOLS = [
  'water', 'flying', 'falling', 'teeth', 'chase', 'animals', 'houses',
  'death', 'birth', 'doors', 'mirrors', 'fire', 'money', 'snakes',
  'light', 'darkness', 'forest', 'mountain', 'ocean', 'sky',
] as const;

export const DREAM_MOODS: { value: DreamMood; label: string; emoji: string; color: string }[] = [
  { value: 'mysterious', label: 'Mysterious', emoji: '🔮', color: '#A855F7' },
  { value: 'anxious', label: 'Anxious', emoji: '😰', color: '#F97316' },
  { value: 'peaceful', label: 'Peaceful', emoji: '☮️', color: '#10B981' },
  { value: 'vivid', label: 'Vivid', emoji: '💎', color: '#06B6D4' },
  { value: 'nightmare', label: 'Nightmare', emoji: '👹', color: '#EF4444' },
  { value: 'lucid', label: 'Lucid', emoji: '👁️', color: '#3B82F6' },
  { value: 'prophetic', label: 'Prophetic', emoji: '🌟', color: '#FACC15' },
  { value: 'recurring', label: 'Recurring', emoji: '🔁', color: '#F472B6' },
];

// ── Hook ─────────────────────────────────────────────────────────────

export function useDreamJournal() {
  const store = useDreamStore();
  const { fetchToday: fetchHealthToday } = useHealthStore();

  const [isInterpreting, setIsInterpreting] = useState(false);

  // Auto-link next-day health data for yesterday's dream
  const linkYesterdayDream = useCallback(async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const yesterdayDream = store.getDreamForDate(yesterdayStr);
    const healthData = useHealthStore.getState().todayMetrics;

    if (yesterdayDream && healthData && yesterdayDream.following_day_mood == null) {
      store.linkNextDayMood(
        yesterdayDream.id,
        healthData.mood_score ?? 0,
        healthData.energy_score ?? 0
      );
    }
  }, []);

  // Run on mount
  useEffect(() => {
    fetchHealthToday().then(() => linkYesterdayDream()).catch(() => {});
  }, []);

  // Computed values
  const stats = useMemo(() => store.getStats(), [store.entries]);
  const recurringSymbols = useMemo(() => store.getRecurringSymbols(), [store.entries]);
  const symbolCorrelations = useMemo(() => store.getSymbolCorrelations(), [store.entries]);

  // Detect if a dream has recurring symbols
  const isDreamRecurring = useCallback((symbolTags: string[]) => {
    return symbolTags.some(s => {
      const existing = recurringSymbols.find(r => r.symbol === s);
      return existing && existing.count >= 2;
    });
  }, [recurringSymbols]);

  // Get symbol meaning from the database
  const getSymbolMeaning = useCallback((symbolName: string): DreamSymbol | undefined => {
    return SYMBOL_DATABASE.find(s => s.name.toLowerCase() === symbolName.toLowerCase());
  }, []);

  // Get meanings from a specific tradition
  const getTraditionInterpretation = useCallback((symbolName: string, traditionId: string): SymbolMeaning | undefined => {
    const symbol = SYMBOL_DATABASE.find(s => s.name.toLowerCase() === symbolName.toLowerCase());
    return symbol?.meanings.find(m => m.tradition === traditionId);
  }, []);

  // Generate AI interpretation prompt (would be fed to LLM)
  const generateInterpretationPrompt = useCallback((dream: DreamEntry): string => {
    const symbolDescriptions = dream.symbol_tags
      .map(s => {
        const sym = SYMBOL_DATABASE.find(db => db.name.toLowerCase() === s.toLowerCase());
        return sym ? `${s}: ${sym.meanings.map(m => m.meaning).join(' | ')}` : s;
      })
      .join('\n');

    const moodDescriptions = dream.mood_tags
      .map(m => DREAM_MOODS.find(dm => dm.value === m)?.label || m)
      .join(', ');

    return `Interpret this dream using multiple spiritual traditions:

Title: ${dream.title}
Narrative: ${dream.narrative}
Moods: ${moodDescriptions}
Symbols: ${symbolDescriptions}
Intensity: ${dream.intensity}/10
${dream.isLucid ? 'This was a LUCID dream.' : ''}
${dream.isRecurring ? 'This is a RECURRING dream.' : ''}

Provide interpretation through: Hermetic, Jungian, Buddhist, and Islamic perspectives. Then synthesize a personal meaning.`;
  }, []);

  // Calculate correlation coefficient between dream intensity and next-day mood
  const calculateIntensityMoodCorrelation = useCallback((): number => {
    const withMood = store.entries.filter(e => e.following_day_mood != null);
    if (withMood.length < 3) return 0;

    const n = withMood.length;
    const intensities = withMood.map(e => e.intensity);
    const moods = withMood.map(e => e.following_day_mood!);

    const avgI = intensities.reduce((a, b) => a + b, 0) / n;
    const avgM = moods.reduce((a, b) => a + b, 0) / n;

    let num = 0, denI = 0, denM = 0;
    for (let i = 0; i < n; i++) {
      const di = intensities[i] - avgI;
      const dm = moods[i] - avgM;
      num += di * dm;
      denI += di * di;
      denM += dm * dm;
    }

    const den = Math.sqrt(denI * denM);
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
  }, [store.entries]);

  // Get seasonal dream patterns
  const getSeasonalPatterns = useCallback(() => {
    const monthlyData: Record<string, { count: number; totalIntensity: number; avgIntensity: number }> = {};

    store.entries.forEach(e => {
      const month = e.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { count: 0, totalIntensity: 0, avgIntensity: 0 };
      monthlyData[month].count++;
      monthlyData[month].totalIntensity += e.intensity;
    });

    Object.keys(monthlyData).forEach(m => {
      monthlyData[m].avgIntensity = Math.round((monthlyData[m].totalIntensity / monthlyData[m].count) * 10) / 10;
    });

    return monthlyData;
  }, [store.entries]);

  return {
    // Store
    entries: store.entries,
    stats,
    recurringSymbols,
    symbolCorrelations,

    // CRUD
    addDream: store.addDream,
    updateDream: store.updateDream,
    deleteDream: store.deleteDream,
    getDreamForDate: store.getDreamForDate,
    getDreamsForMonth: store.getDreamsForMonth,
    getDreamById: store.getDreamById,

    // Derived
    isDreamRecurring,
    getSymbolMeaning,
    getTraditionInterpretation,
    generateInterpretationPrompt,
    calculateIntensityMoodCorrelation,
    getSeasonalPatterns,
    linkYesterdayDream: linkYesterdayDream,

    // Loading state
    isInterpreting,
    setIsInterpreting,

    // Constants
    SYMBOL_DATABASE,
    DREAM_MOODS,
    DREAM_SYMBOLS,
    TRADITION_NAMES,
  };
}