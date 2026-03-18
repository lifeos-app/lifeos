/**
 * Slide Tutorial Definitions — LifeOS
 *
 * Each tutorial is a set of image slides shown once on first visit to a feature.
 * Images are custom-generated per DESIGN-RULES.md (gradient fallbacks until ready).
 */

import type { TourId } from './SpotlightTour';

export interface TutorialSlide {
  image: string;
  fallbackGradient: string;
  title: string;
  description: string;
}

export interface SlideTutorialDef {
  key: TourId;
  slides: TutorialSlide[];
}

const GRADIENT_REALM = 'linear-gradient(135deg, #0d1520 0%, #1a2a3e 50%, #0a3d5c 100%)';
const GRADIENT_JUNCTION = 'linear-gradient(135deg, #1a1520 0%, #2a1a3e 50%, #3d0a3d 100%)';

export const SLIDE_TUTORIALS: Record<string, SlideTutorialDef> = {
  realm: {
    key: 'realm-slides',
    slides: [
      {
        image: '/images/tutorials/realm-overview.webp',
        fallbackGradient: GRADIENT_REALM,
        title: 'Welcome to The Realm',
        description: 'Your habits, goals, and daily actions come alive in this living world. Everything you do shapes the landscape.',
      },
      {
        image: '/images/tutorials/realm-garden.webp',
        fallbackGradient: GRADIENT_REALM,
        title: 'Your Garden',
        description: 'Each habit grows a real botanical species. Complete habits daily to advance them from seed to ancient tree.',
      },
      {
        image: '/images/tutorials/realm-companion.webp',
        fallbackGradient: GRADIENT_REALM,
        title: 'Earn Companions',
        description: 'Stay consistent across 3+ life domains for 7 days to earn your first animal companion.',
      },
    ],
  },
  junction: {
    key: 'junction-slides',
    slides: [
      {
        image: '/images/tutorials/junction-traditions.webp',
        fallbackGradient: GRADIENT_JUNCTION,
        title: 'The Junction',
        description: 'Equip a spiritual tradition to unlock daily practices, sacred calendars, wisdom quotes, and progression.',
      },
      {
        image: '/images/tutorials/junction-calendar.webp',
        fallbackGradient: GRADIENT_JUNCTION,
        title: 'Sacred Calendar',
        description: 'Follow holy days, fasts, and feasts from your chosen tradition. Events appear on your schedule overlay.',
      },
    ],
  },
};
