// ═══ Junction Icon Mapping & Helpers ═══
import { assetPath } from '../utils/assets';

export function getPracticeIconPath(traditionSlug: string | null, practiceType: string, practiceId: string): string {
  // Generic practice icons (used across all traditions)
  const genericPracticeIcons: Record<string, string> = {
    prayer: '/junction/practices/prayer.webp',
    fasting: '/junction/practices/fasting.webp',
    study: '/junction/practices/study.webp',
    meditation: '/junction/practices/meditation.webp',
    charity: '/junction/practices/charity.webp',
    pilgrimage: '/junction/practices/pilgrimage.webp',
    worship: '/junction/practices/worship.webp',
    chanting: '/junction/practices/chanting.webp',
    service: '/junction/practices/service.webp',
    ritual: '/junction/practices/ritual.webp',
    contemplation: '/junction/practices/contemplation.webp',
    discipline: '/junction/practices/discipline.webp',
  };

  // Tradition-specific icons
  const traditionIcons: Record<string, Record<string, string>> = {
    tewahedo: {
      prayer: '/junction/traditions/tewahedo/practices/prayer_tewahedo.webp',
      fasting: '/junction/traditions/tewahedo/practices/fasting_tewahedo.webp',
      study: '/junction/traditions/tewahedo/practices/study_tewahedo.webp',
    },
    islam: {
      'salah': '/junction/traditions/islam/practices/salah.webp',
      'sawm': '/junction/traditions/islam/practices/sawm.webp',
      'quran-study': '/junction/traditions/islam/practices/quran_study.webp',
    },
    buddhism: {
      'zazen': '/junction/traditions/buddhism/practices/zazen.webp',
      'mindfulness': '/junction/traditions/buddhism/practices/mindfulness.webp',
      'dharma-study': '/junction/traditions/buddhism/practices/dharma_study.webp',
    },
    hinduism: {
      'puja': '/junction/traditions/hinduism/practices/puja.webp',
      'yoga': '/junction/traditions/hinduism/practices/yoga.webp',
      'vedic-study': '/junction/traditions/hinduism/practices/vedic_study.webp',
    },
    catholic: {
      'mass': '/junction/traditions/catholic/practices/mass.webp',
      'rosary': '/junction/traditions/catholic/practices/rosary.webp',
      'lectio': '/junction/traditions/catholic/practices/lectio.webp',
    },
    judaism: {
      'shabbat': '/junction/traditions/judaism/practices/shabbat.webp',
      'torah-study': '/junction/traditions/judaism/practices/torah_study.webp',
      'tikkun': '/junction/traditions/judaism/practices/tikkun.webp',
    },
    stoicism: {
      'journal': '/junction/traditions/stoicism/practices/journal.webp',
      'negative-visualization': '/junction/traditions/stoicism/practices/negative_vis.webp',
      'virtue': '/junction/traditions/stoicism/practices/virtue.webp',
    },
    daoism: {
      'qigong': '/junction/traditions/daoism/practices/qigong.webp',
      'wuwei': '/junction/traditions/daoism/practices/wuwei.webp',
      'dao-study': '/junction/traditions/daoism/practices/dao_study.webp',
    },
    dreaming: {
      'walkabout': '/junction/traditions/dreaming/practices/walkabout.webp',
      'story': '/junction/traditions/dreaming/practices/story.webp',
      'country': '/junction/traditions/dreaming/practices/country.webp',
    },
    sikhism: {
      'simran': '/junction/traditions/sikhism/practices/simran.webp',
      'seva': '/junction/traditions/sikhism/practices/seva.webp',
      'gurbani': '/junction/traditions/sikhism/practices/gurbani.webp',
    },
  };

  // Try tradition-specific first
  if (traditionSlug && traditionIcons[traditionSlug]?.[practiceId]) {
    return assetPath(traditionIcons[traditionSlug][practiceId]);
  }

  // Fall back to generic
  return assetPath(genericPracticeIcons[practiceType] || '/junction/practices/prayer.webp');
}

export function getCalendarIconPath(type: string): string {
  const calendarIcons: Record<string, string> = {
    fast: '/junction/events/fast.webp',
    feast: '/junction/events/feast.webp',
    'holy-day': '/junction/events/holy_day.webp',
    observance: '/junction/events/observance.webp',
  };

  return assetPath(calendarIcons[type] || '/junction/events/observance.webp');
}

export function getTimeContext(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
