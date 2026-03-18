import type { CharacterClass } from '../engine/types';

export interface ClassInfo {
  id: CharacterClass;
  name: string;
  title: string;
  description: string;
  icon: string;
  image?: string;
  color: string;
  focusAreas: string[];
  statBonuses: {
    strength: number;
    intelligence: number;
    charisma: number;
    endurance: number;
  };
}

export const CHARACTER_CLASSES: ClassInfo[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    title: 'The Iron Will',
    description: 'Forge your body and mind through discipline. Warriors draw power from physical training, health habits, and relentless consistency.',
    icon: '⚔️',
    image: '/img/onboarding/rpg-warrior.webp',
    color: '#e74c3c',
    focusAreas: ['Health', 'Fitness', 'Discipline'],
    statBonuses: { strength: 3, intelligence: 0, charisma: 1, endurance: 2 },
  },
  {
    id: 'mage',
    name: 'Mage',
    title: 'The Eternal Student',
    description: 'Knowledge is the ultimate power. Mages grow through study, learning, and intellectual pursuits. Every lesson fuels their magic.',
    icon: '🔮',
    image: '/img/onboarding/rpg-mage.webp',
    color: '#9b59b6',
    focusAreas: ['Education', 'Learning', 'Reading'],
    statBonuses: { strength: 0, intelligence: 3, charisma: 1, endurance: 2 },
  },
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'The Path Finder',
    description: 'Masters of resources and opportunity. Rangers excel at business, finance, and navigating the material world with precision.',
    icon: '🏹',
    image: '/img/onboarding/rpg-ranger.webp',
    color: '#27ae60',
    focusAreas: ['Finance', 'Business', 'Strategy'],
    statBonuses: { strength: 1, intelligence: 2, charisma: 1, endurance: 2 },
  },
  {
    id: 'healer',
    name: 'Healer',
    title: 'The Soul Keeper',
    description: 'Inner peace radiates outward. Healers nurture wellbeing, spirituality, and emotional balance. Their presence lifts everyone.',
    icon: '✨',
    image: '/img/onboarding/rpg-healer.webp',
    color: '#f1c40f',
    focusAreas: ['Wellbeing', 'Spiritual', 'Mindfulness'],
    statBonuses: { strength: 0, intelligence: 1, charisma: 3, endurance: 2 },
  },
  {
    id: 'engineer',
    name: 'Engineer',
    title: 'The World Builder',
    description: 'Creation is the highest calling. Engineers build, code, design, and bring ideas to life. Every project is an artifact of power.',
    icon: '🔧',
    image: '/img/onboarding/rpg-engineer.webp',
    color: '#3498db',
    focusAreas: ['Building', 'Tech', 'Projects'],
    statBonuses: { strength: 1, intelligence: 2, charisma: 0, endurance: 3 },
  },
];

export function getClassInfo(classId: CharacterClass): ClassInfo {
  return CHARACTER_CLASSES.find(c => c.id === classId) || CHARACTER_CLASSES[0];
}
