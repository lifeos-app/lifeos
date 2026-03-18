// LifeOS Gamification — Class-Specific Starter Quests
// Tailored first quests based on ESBI class selection
import type { LucideIcon } from 'lucide-react';
import { Palette, Wrench, Heart, BookOpen, Settings, Search, Crown, Shield } from 'lucide-react';

export type ClassKey = 'E' | 'S' | 'B' | 'I';

export interface StarterQuest {
  id: string;
  title: string;
  description: string;
  category: string;
  xp: number;
}

export const CLASS_STARTER_QUESTS: Record<ClassKey, StarterQuest[]> = {
  // Employee — Stability & Career Growth
  E: [
    {
      id: 'e_career_goal',
      title: 'Set Your Career Goal',
      description: 'Define where you want to be in your career 1-3 years from now',
      category: 'business',
      xp: 100,
    },
    {
      id: 'e_work_expense',
      title: 'Track Your First Work Expense',
      description: 'Log a work-related expense or commute cost for tax tracking',
      category: 'finance',
      xp: 50,
    },
    {
      id: 'e_learning_session',
      title: 'Plan a Learning Session',
      description: 'Schedule time this week to learn a new skill for career growth',
      category: 'education',
      xp: 75,
    },
    {
      id: 'e_performance_review',
      title: 'Document a Win',
      description: 'Write down a recent achievement to use in your next performance review',
      category: 'business',
      xp: 50,
    },
  ],

  // Trader (Self-Employed) — Freedom & Client Work
  S: [
    {
      id: 's_first_client',
      title: 'Add Your First Client',
      description: 'Create a contact or project for a current or potential client',
      category: 'business',
      xp: 100,
    },
    {
      id: 's_business_income',
      title: 'Track Business Income',
      description: 'Log your latest payment or invoice to monitor cash flow',
      category: 'finance',
      xp: 75,
    },
    {
      id: 's_revenue_target',
      title: 'Set a Revenue Target',
      description: 'Define your income goal for this month or quarter',
      category: 'finance',
      xp: 100,
    },
    {
      id: 's_client_pipeline',
      title: 'Build Your Pipeline',
      description: 'Identify 3 potential clients or projects you want to pursue',
      category: 'business',
      xp: 75,
    },
  ],

  // Business Owner — Systems & Scaling
  B: [
    {
      id: 'b_business_systems',
      title: 'Map Your Business Systems',
      description: 'Document one core system or process that runs your business',
      category: 'business',
      xp: 100,
    },
    {
      id: 'b_team_expenses',
      title: 'Track Team Expenses',
      description: 'Log expenses related to contractors, tools, or team operations',
      category: 'finance',
      xp: 75,
    },
    {
      id: 'b_scaling_goal',
      title: 'Set a Scaling Goal',
      description: 'Define one way you want to grow your business this quarter',
      category: 'business',
      xp: 100,
    },
    {
      id: 'b_delegation',
      title: 'Delegate One Task',
      description: 'Identify a task you can delegate or automate to free up your time',
      category: 'business',
      xp: 75,
    },
  ],

  // Investor — Passive Income & Portfolio
  I: [
    {
      id: 'i_first_investment',
      title: 'Log Your First Investment',
      description: 'Record a current investment (stocks, property, crypto, etc.)',
      category: 'finance',
      xp: 100,
    },
    {
      id: 'i_savings_target',
      title: 'Set a Savings Target',
      description: 'Define how much you want to save or invest this month',
      category: 'finance',
      xp: 100,
    },
    {
      id: 'i_portfolio_value',
      title: 'Track Portfolio Value',
      description: 'Calculate the current total value of your investments',
      category: 'finance',
      xp: 75,
    },
    {
      id: 'i_passive_income',
      title: 'Identify Passive Income',
      description: 'Document one source of passive or semi-passive income you have or want',
      category: 'finance',
      xp: 75,
    },
  ],
};

export const CLASS_NAMES: Record<ClassKey, string> = {
  E: 'Employee',
  S: 'Trader',
  B: 'Business Owner',
  I: 'Investor',
};

export const CLASS_ICONS: Record<ClassKey, string> = {
  E: '🏢',
  S: '⚡',
  B: '🏗️',
  I: '📈',
};

export const CLASS_DESCRIPTIONS: Record<ClassKey, string> = {
  E: 'You trade time for a salary. Stability is your foundation.',
  S: 'You work for yourself. Freedom drives you.',
  B: 'You build systems. People and processes work for you.',
  I: 'Your money works for you. Patience is your weapon.',
};

export const ROLE_ARCHETYPES: Record<string, { icon: LucideIcon; emoji: string; description: string }> = {
  Creator: {
    icon: Palette,
    emoji: '🎨',
    description: 'You make things. Art, content, products, ideas.',
  },
  Builder: {
    icon: Wrench,
    emoji: '🔧',
    description: 'You construct and engineer. Systems, code, structures.',
  },
  Healer: {
    icon: Heart,
    emoji: '💚',
    description: 'You restore and care. Health, wellness, support.',
  },
  Educator: {
    icon: BookOpen,
    emoji: '📚',
    description: 'You teach and guide. Knowledge is your currency.',
  },
  Operator: {
    icon: Settings,
    emoji: '⚙️',
    description: 'You execute and optimize. Efficiency is your art.',
  },
  Analyst: {
    icon: Search,
    emoji: '🔍',
    description: 'You decode patterns. Data and strategy guide you.',
  },
  Leader: {
    icon: Crown,
    emoji: '👑',
    description: 'You rally people. Vision and direction are your gifts.',
  },
  Protector: {
    icon: Shield,
    emoji: '🛡️',
    description: 'You safeguard and defend. Security and justice drive you.',
  },
};

export type RoleKey = keyof typeof ROLE_ARCHETYPES;

/** Get starter quests for a given class */
export function getStarterQuestsForClass(classKey: ClassKey): StarterQuest[] {
  return CLASS_STARTER_QUESTS[classKey] || [];
}

/** Get display info for a class */
export function getClassInfo(classKey: ClassKey) {
  return {
    key: classKey,
    name: CLASS_NAMES[classKey],
    icon: CLASS_ICONS[classKey],
    description: CLASS_DESCRIPTIONS[classKey],
  };
}

/** Get display info for a role */
export function getRoleInfo(roleKey: RoleKey) {
  const archetype = ROLE_ARCHETYPES[roleKey];
  return {
    key: roleKey,
    name: roleKey,
    icon: archetype.icon,
    description: archetype.description,
  };
}
