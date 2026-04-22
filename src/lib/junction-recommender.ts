// ═══════════════════════════════════════════════════════════
// Junction AI Recommender — Hermes Recommends
// Scores each of the 18 Junction traditions against user profile data
// to produce personalized top-3 recommendations.
// ═══════════════════════════════════════════════════════════

import { FALLBACK_TRADITIONS, TRADITION_CATEGORIES } from '../components/junction/constants';
import type { JunctionTradition } from '../hooks/useJunctionTypes';

// ── Input types ──

export interface UserProfileInput {
  primary_focus: string | null;
  occupation: string | null;
  preferences: Record<string, unknown> | null;
}

export interface HabitInput {
  title: string;
  icon?: string;
  frequency?: string;
}

export interface Recommendation {
  tradition: JunctionTradition;
  score: number;       // 0–100
  reason: string;      // Brief: "Based on your focus on X"
  detail: string;      // Tooltip detail
}

// ── Topic / keyword mapping ──

interface TraditionTopic {
  slug: string;
  keywords: string[];
  focusAreas: string[];   // matches onboarding focusAreas
  habitThemes: string[];  // matches habit titles/description
  preferenceKeys: string[]; // matches preferences top-level keys
}

const TRADITION_TOPICS: TraditionTopic[] = [
  // Spiritual / Religious
  { slug: 'tewahedo', keywords: ['christianity','faith','prayer','fasting','church','orthodox','bible','devotion','spiritual','ancient','liturgy'], focusAreas: ['Spirituality','Religion','Faith','Prayer'], habitThemes: ['pray','fast','church','bible','scripture','devotion','meditat'], preferenceKeys: ['spiritual','prayer','fasting'] },
  { slug: 'islam', keywords: ['islam','muslim','prayer','fasting','quran','submission','pillar','ramadan','mosque','faith'], focusAreas: ['Spirituality','Religion','Faith','Prayer'], habitThemes: ['pray','fast','quran','mosque','charity','devotion'], preferenceKeys: ['spiritual','prayer','fasting'] },
  { slug: 'buddhism', keywords: ['buddhism','mindfulness','meditation','compassion','suffering','middle way','awakening','zen','dharma','karma'], focusAreas: ['Spirituality','Meditation','Mindfulness','Mental Health'], habitThemes: ['meditat','mindful','breath','calm','peace','compassion'], preferenceKeys: ['spiritual','meditation','mindfulness'] },
  { slug: 'hinduism', keywords: ['hinduism','dharma','devotion','karma','yoga','veda','puja','meditation','spiritual','ritual'], focusAreas: ['Spirituality','Yoga','Meditation','Tradition'], habitThemes: ['yoga','meditat','pray','devotion','ritual','mantra'], preferenceKeys: ['spiritual','yoga','meditation'] },
  { slug: 'sikhism', keywords: ['sikh','service','devotion','truth','courage','community','gratitude','warrior','faith'], focusAreas: ['Spirituality','Community','Faith','Service'], habitThemes: ['service','community','pray','meditat','gratitude'], preferenceKeys: ['spiritual','service'] },
  { slug: 'judaism', keywords: ['judaism','torah','covenant','sabbath','prayer','study','tradition','community','faith'], focusAreas: ['Spirituality','Religion','Tradition','Community'], habitThemes: ['study','pray','tradition','sabbath','community'], preferenceKeys: ['spiritual','tradition'] },
  { slug: 'stoicism', keywords: ['stoicism','virtue','discipline','reason','resilience','philosophy','self-control','endurance','wisdom'], focusAreas: ['Personal Growth','Discipline','Philosophy','Self-improvement'], habitThemes: ['journal','reflect','discipline','cold shower','resilien','philosophy'], preferenceKeys: ['philosophy','discipline','growth'] },
  { slug: 'catholic', keywords: ['catholic','sacrament','saint','mass','prayer','church','tradition','faith','devotion'], focusAreas: ['Spirituality','Religion','Faith','Tradition'], habitThemes: ['pray','church','mass','devotion','sacrament'], preferenceKeys: ['spiritual','prayer'] },
  { slug: 'daoism', keywords: ['daoism','taoism','flow','nature','simplicity','harmony','wu wei','balance','yin yang','meditation'], focusAreas: ['Spirituality','Balance','Nature','Meditation'], habitThemes: ['meditat','flow','balance','nature','breath','yoga','mindful'], preferenceKeys: ['spiritual','balance','flow'] },
  { slug: 'dreaming', keywords: ['aboriginal','dreaming','indigenous','country','ancestors','kinship','land','ceremony','spiritual'], focusAreas: ['Spirituality','Nature','Culture','Community'], habitThemes: ['nature','community','ceremony','country','reflect'], preferenceKeys: ['spiritual','nature','culture'] },

  // Secular lifestyle junctions
  { slug: 'the_game', keywords: ['social','confidence','dating','conversation','charisma','networking','communication','people','extrovert','social skills'], focusAreas: ['Relationships','Social Skills','Confidence','Communication'], habitThemes: ['social','talk','network','approach','confiden','people','communi','dating','friend'], preferenceKeys: ['social','confidence','communication','dating'] },
  { slug: 'iron_protocol', keywords: ['fitness','workout','gym','strength','muscle','lifting','bodybuilding','exercise','training','physical'], focusAreas: ['Health & Fitness','Strength','Exercise','Physical Fitness'], habitThemes: ['workout','gym','lift','weight','cardio','run','exercise','push','pull','squat','bench','deadlift','muscle','body'], preferenceKeys: ['fitness','exercise','strength','workout'] },
  { slug: 'the_grind', keywords: ['business','career','hustle','revenue','money','entrepreneur','sales','grind','startup','work','success'], focusAreas: ['Career / Business','Finances','Professional Development','Leadership'], habitThemes: ['business','revenue','sales','client','goal','productivity','work','hustle','network','income'], preferenceKeys: ['business','career','finance','revenue'] },
  { slug: 'clean_slate', keywords: ['declutter','minimalism','organize','clean','tidy','simplify','decluttering','space','home','environment'], focusAreas: ['Home / Physical Environment','Organization','Simplicity','Mental Clarity'], habitThemes: ['clean','declutter','organiz','tidy','minimize','simplify','home','space','purge'], preferenceKeys: ['cleaning','organization','minimalism'] },
  { slug: 'brain_forge', keywords: ['study','learn','education','knowledge','academic','pomodoro','spaced repetition','school','university','intellectual'], focusAreas: ['Education / Learning','Knowledge','Study Skills','Academic'], habitThemes: ['study','learn','read','pomodoro','flashcard','review','course','book','homework','academic','research'], preferenceKeys: ['education','learning','study','academic'] },
  { slug: 'stack_overflow', keywords: ['code','programming','developer','software','coding','tech','engineering','computer','web','app','frontend','backend','fullstack'], focusAreas: ['Education / Learning','Technology','Career / Business','Skills'], habitThemes: ['code','program','develop','debug','deploy','build','ship','git','javascript','python','react','api','stack','project'], preferenceKeys: ['coding','programming','tech','developer'] },
  { slug: 'gut_check', keywords: ['nutrition','food','diet','macros','meal','fasting','health','eating','cooking','calories','protein'], focusAreas: ['Health & Fitness','Nutrition','Diet','Eating Well'], habitThemes: ['meal','diet','nutrit','cook','fast','macro','protein','calori','food','eat','water','prep','vegetable'], preferenceKeys: ['nutrition','diet','food','fasting'] },
  { slug: 'monk_mode', keywords: ['meditation','digital detox','silence','gratitude','mindfulness','minimalism','stillness','contemplation','simplify','detox'], focusAreas: ['Mental Health','Mindfulness','Spirituality','Personal Growth'], habitThemes: ['meditat','digital detox','silence','gratitude','journal','mindful','breath','simplif','declutter','reflect','sleep'], preferenceKeys: ['mindfulness','meditation','digital detox','simplicity'] },
];

// ── Matching logic ──

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function computeRelevanceScore(
  topic: TraditionTopic,
  profile: UserProfileInput,
  habits: HabitInput[],
): number {
  let score = 0;
  const maxScore = 100;

  // 1. Primary focus matching (0–35 points)
  if (profile.primary_focus) {
    const focusNorm = normalize(profile.primary_focus);
    for (const kw of topic.keywords) {
      if (focusNorm.includes(kw)) {
        score += 30;
        break;
      }
    }
    for (const fa of topic.focusAreas) {
      if (focusNorm.includes(fa.toLowerCase())) {
        score += 25;
        break;
      }
    }
  }

  // 2. Preferences matching (0–25 points)
  const prefs = profile.preferences || {};
  let prefScore = 0;
  for (const key of Object.keys(prefs)) {
    const keyNorm = normalize(key);
    for (const pk of topic.preferenceKeys) {
      if (keyNorm.includes(pk)) {
        prefScore += 8;
      }
    }
    // Also check values if they're strings
    const val = prefs[key];
    if (typeof val === 'string') {
      const valNorm = normalize(val);
      for (const kw of topic.keywords) {
        if (valNorm.includes(kw)) {
          prefScore += 5;
        }
      }
    }
  }
  score += Math.min(prefScore, 25);

  // 3. Occupation matching (0–15 points)
  if (profile.occupation) {
    const occNorm = normalize(profile.occupation);
    for (const kw of topic.keywords) {
      if (occNorm.includes(kw)) {
        score += 13;
        break;
      }
    }
  }

  // 4. Habits matching (0–25 points)
  let habitScore = 0;
  const matchedHabits: string[] = [];
  for (const habit of habits) {
    const titleNorm = normalize(habit.title || '');
    let matched = false;
    for (const theme of topic.habitThemes) {
      if (titleNorm.includes(theme)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Broad keyword match on habit title
      for (const kw of topic.keywords) {
        if (titleNorm.includes(kw)) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      habitScore += 5;
      matchedHabits.push(habit.title);
    }
  }
  score += Math.min(habitScore, 25);

  // Cap at 100
  return Math.min(score, maxScore);
}

function generateReason(topic: TraditionTopic, profile: UserProfileInput, habits: HabitInput[], score: number): string {
  const reasons: string[] = [];

  if (profile.primary_focus) {
    const focusNorm = normalize(profile.primary_focus);
    for (const fa of topic.focusAreas) {
      if (focusNorm.includes(fa.toLowerCase())) {
        reasons.push(`Based on your focus on ${fa}`);
        break;
      }
    }
    if (reasons.length === 0) {
      for (const kw of topic.keywords) {
        if (focusNorm.includes(kw)) {
          reasons.push(`Matches your interest in ${kw}`);
          break;
        }
      }
    }
  }

  if (reasons.length === 0 && habits.length > 0) {
    const matchedHabit = habits.find(h => {
      const titleNorm = normalize(h.title || '');
      return topic.habitThemes.some(t => titleNorm.includes(t));
    });
    if (matchedHabit) {
      reasons.push(`Aligns with your "${matchedHabit.title}" habit`);
    }
  }

  if (reasons.length === 0 && profile.occupation) {
    const occNorm = normalize(profile.occupation);
    for (const kw of topic.keywords) {
      if (occNorm.includes(kw)) {
        reasons.push(`Suited for your work in ${kw}`);
        break;
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Explores themes of ${topic.keywords.slice(0, 2).join(' & ')}`);
  }

  return reasons[0];
}

function generateDetail(topic: TraditionTopic, profile: UserProfileInput, habits: HabitInput[]): string {
  const details: string[] = [];
  const traditionName = FALLBACK_TRADITIONS.find(t => t.slug === topic.slug)?.name || topic.slug;

  if (profile.primary_focus) {
    const focusNorm = normalize(profile.primary_focus);
    const matchedAreas = topic.focusAreas.filter(fa => focusNorm.includes(fa.toLowerCase()));
    if (matchedAreas.length > 0) {
      details.push(`Your primary focus "${profile.primary_focus}" aligns with ${traditionName}'s themes of ${matchedAreas.join(', ')}.`);
    }
  }

  const matchedHabits = habits.filter(h => {
    const titleNorm = normalize(h.title || '');
    return topic.habitThemes.some(t => titleNorm.includes(t));
  });
  if (matchedHabits.length > 0) {
    const names = matchedHabits.slice(0, 3).map(h => `"${h.title}"`);
    details.push(`Your habits (${names.join(', ')}) complement this tradition's practices.`);
  }

  if (details.length === 0) {
    const prefs = profile.preferences || {};
    const matchedPrefs = topic.preferenceKeys.filter(pk => pk in prefs);
    if (matchedPrefs.length > 0) {
      details.push(`Your preferences around ${matchedPrefs.join(', ')} suggest a strong affinity for this path.`);
    }
  }

  if (details.length === 0) {
    details.push(`${traditionName} focuses on ${topic.keywords.slice(0, 3).join(', ')}, which may offer fresh perspective on your journey.`);
  }

  return details.join(' ');
}

// ── Public API ──

export function getJunctionRecommendations(
  profile: UserProfileInput,
  habits: HabitInput[],
  traditions?: JunctionTradition[],
): Recommendation[] {
  const allTraditions = (traditions && traditions.length > 0) ? traditions : FALLBACK_TRADITIONS;

  const scored: Recommendation[] = allTraditions.map(trad => {
    const topic = TRADITION_TOPICS.find(t => t.slug === trad.slug);
    if (!topic || !trad.available) {
      return {
        tradition: trad,
        score: 0,
        reason: '',
        detail: '',
      };
    }

    const score = computeRelevanceScore(topic, profile, habits);
    const reason = generateReason(topic, profile, habits, score);
    const detail = generateDetail(topic, profile, habits);

    return { tradition: trad, score, reason, detail };
  });

  // Sort by score descending, take top 3 with score > 0
  const recommendations = scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // If fewer than 3 with score > 0, fill from available traditions by category affinity
  if (recommendations.length < 3) {
    const usedSlugs = new Set(recommendations.map(r => r.tradition.slug));
    const remaining = allTraditions
      .filter(t => t.available && !usedSlugs.has(t.slug))
      .sort(() => Math.random() - 0.5); // light shuffle for variety

    for (const trad of remaining) {
      if (recommendations.length >= 3) break;
      const topic = TRADITION_TOPICS.find(t => t.slug === trad.slug);
      usedSlugs.add(trad.slug);
      recommendations.push({
        tradition: trad,
        score: 5, // low default for fallback
        reason: `Explore new horizons with ${trad.name}`,
        detail: `${trad.name}: ${trad.description}. Broaden your path by trying something different.`,
      });
    }
  }

  return recommendations;
}

export function getCategoryForSlug(slug: string): string {
  return TRADITION_CATEGORIES[slug] || 'Lifestyle';
}