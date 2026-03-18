/**
 * Industries — User-facing life path categories that map to internal RPG classes.
 *
 * Users see "Health & Fitness" instead of "Warrior", etc.
 * The RPG class system remains intact behind the scenes.
 */

import type { CharacterClass } from '../engine/types';

export interface IndustryInfo {
  id: string;
  label: string;
  description: string;
  mappedClass: CharacterClass;
  icon: string;       // custom generated image path
  color: string;
}

export const INDUSTRIES: IndustryInfo[] = [
  {
    id: 'health_fitness',
    label: 'Health & Fitness',
    description: 'Build strength, forge discipline',
    mappedClass: 'warrior',
    icon: '/img/industries/health-fitness.png',
    color: '#e74c3c',
  },
  {
    id: 'education_research',
    label: 'Education & Research',
    description: 'Knowledge is the ultimate power',
    mappedClass: 'mage',
    icon: '/img/industries/education-research.png',
    color: '#9b59b6',
  },
  {
    id: 'business_finance',
    label: 'Business & Finance',
    description: 'Navigate markets, build empires',
    mappedClass: 'ranger',
    icon: '/img/industries/business-finance.png',
    color: '#27ae60',
  },
  {
    id: 'tech_building',
    label: 'Tech & Building',
    description: 'Create, design, bring ideas to life',
    mappedClass: 'engineer',
    icon: '/img/industries/tech-building.png',
    color: '#3498db',
  },
  {
    id: 'wellbeing_healing',
    label: 'Wellbeing & Healing',
    description: 'Nurture peace, uplift others',
    mappedClass: 'healer',
    icon: '/img/industries/wellbeing-healing.png',
    color: '#f1c40f',
  },
  {
    id: 'creative_arts',
    label: 'Creative & Arts',
    description: 'Express, perform, inspire the world',
    mappedClass: 'mage',
    icon: '/img/industries/creative-arts.png',
    color: '#e67e22',
  },
];

/** Convert an industry id to its internal RPG class */
export function industryToClass(industryId: string): CharacterClass {
  return INDUSTRIES.find(i => i.id === industryId)?.mappedClass || 'warrior';
}

/** Convert an internal RPG class to its industry info */
export function classToIndustry(className: string): IndustryInfo | undefined {
  return INDUSTRIES.find(i => i.mappedClass === className);
}
