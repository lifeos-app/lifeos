/**
 * materialize-templates.ts — Domain-specific goal templates for resilient onboarding
 *
 * When the LLM times out or fails, these templates provide instant, high-quality
 * fallback goals that feel personalized (user's name, selected domains, stated goals).
 *
 * Each domain has:
 *   - A canonical goal with 3-5 sub-goals (milestones)
 *   - Due dates staggered at 30/60/90 days
 *   - Specific, actionable tasks — never generic 'Be healthier'
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface TemplateMilestone {
  title: string;
  dueOffset: number; // days from today
}

export interface DomainTemplate {
  name: string;
  icon: string;
  color: string;
  goalTitle: string;
  goalDescription: string;
  milestones: TemplateMilestone[];
  habits: string[];
}

// ═══════════════════════════════════════════════════════════════
// DOMAIN TEMPLATES
// ═══════════════════════════════════════════════════════════════

const TEMPLATES: Record<string, DomainTemplate> = {
  education: {
    name: 'Education / Learning',
    icon: 'book-open',
    color: '#7C5CFC',
    goalTitle: 'Accelerate my learning',
    goalDescription: 'Build a structured learning practice with clear targets and measurable progress',
    milestones: [
      { title: 'Identify top 3 skills to develop and gather resources', dueOffset: 7 },
      { title: 'Complete first course module or book chapter', dueOffset: 21 },
      { title: 'Apply new knowledge in a real project or exercise', dueOffset: 45 },
      { title: 'Earn a certification or finish a course', dueOffset: 60 },
      { title: 'Teach what you learned to solidify mastery', dueOffset: 90 },
    ],
    habits: ['Daily study session', 'Notes review'],
  },

  career: {
    name: 'Career / Business',
    icon: 'briefcase',
    color: '#F97316',
    goalTitle: 'Advance my career',
    goalDescription: 'Take deliberate steps toward the next level in my professional journey',
    milestones: [
      { title: 'Audit current role: gaps, strengths, next-step requirements', dueOffset: 7 },
      { title: 'Define a clear 90-day career target with measurable outcomes', dueOffset: 14 },
      { title: 'Complete one skill gap course or certification', dueOffset: 30 },
      { title: 'Ship a visible deliverable or lead a project', dueOffset: 60 },
      { title: 'Negotiate promotion, raise, or new opportunity', dueOffset: 90 },
    ],
    habits: ['Weekly career review', 'Network outreach'],
  },

  financial: {
    name: 'Finances',
    icon: 'wallet',
    color: '#FFD93D',
    goalTitle: 'Take control of my finances',
    goalDescription: 'Build a financial system with clear visibility, savings targets, and debt strategy',
    milestones: [
      { title: 'Track every expense for two weeks — build awareness', dueOffset: 14 },
      { title: 'Set up budget categories and monthly limits', dueOffset: 21 },
      { title: 'Automate savings transfer and build emergency fund base', dueOffset: 30 },
      { title: 'Review subscriptions and cut waste', dueOffset: 45 },
      { title: 'Hit first savings milestone or pay down first debt chunk', dueOffset: 90 },
    ],
    habits: ['Daily expense log', 'Weekly finance review'],
  },

  health: {
    name: 'Health & Fitness',
    icon: 'dumbbell',
    color: '#4ECB71',
    goalTitle: 'Build my fitness foundation',
    goalDescription: 'Establish a sustainable exercise and nutrition routine with measurable health metrics',
    milestones: [
      { title: 'Baseline: record weight, measurements, and fitness test results', dueOffset: 7 },
      { title: 'Lock in 3 consistent workout sessions per week', dueOffset: 21 },
      { title: 'Build 5 go-to healthy meal rotation', dueOffset: 30 },
      { title: 'Month 1 reassessment: measurements, energy, sleep quality', dueOffset: 30 },
      { title: 'Month 2 reassessment: adjust programming based on results', dueOffset: 60 },
      { title: 'Hit body composition or performance target', dueOffset: 90 },
    ],
    habits: ['Workout session', 'Track meals', 'Sleep on schedule'],
  },

  spiritual: {
    name: 'Spirituality',
    icon: 'hand-heart',
    color: '#FF6B6B',
    goalTitle: 'Deepen my spiritual practice',
    goalDescription: 'Cultivate a meaningful spiritual routine that grounds and centers me',
    milestones: [
      { title: 'Choose or renew a daily spiritual practice (meditation, prayer, reflection)', dueOffset: 7 },
      { title: 'Establish consistent morning or evening spiritual routine', dueOffset: 21 },
      { title: 'Read one spiritual or philosophical book fully', dueOffset: 45 },
      { title: 'Join a community or group for shared practice', dueOffset: 60 },
      { title: 'Reflect and write about personal growth and meaning', dueOffset: 90 },
    ],
    habits: ['Morning meditation or prayer', 'Gratitude journal'],
  },

  personal: {
    name: 'Personal Growth',
    icon: 'star',
    color: '#00D4FF',
    goalTitle: 'Level up as a person',
    goalDescription: 'Build habits, mindsets, and systems that compound over time into lasting change',
    milestones: [
      { title: 'Identify 3 personal weaknesses and plan to address each', dueOffset: 7 },
      { title: 'Establish morning and evening routines that stick', dueOffset: 21 },
      { title: 'Read one personal development book and apply one concept', dueOffset: 30 },
      { title: 'Conduct monthly life audit: what changed, what to adjust', dueOffset: 60 },
      { title: 'Complete 90-day personal growth retrospective', dueOffset: 90 },
    ],
    habits: ['Morning review', 'Evening reflection', 'Weekly life audit'],
  },

  creative: {
    name: 'Creative',
    icon: 'palette',
    color: '#7C5CFC',
    goalTitle: 'Build a creative practice',
    goalDescription: 'Develop a consistent creative output and share work with the world',
    milestones: [
      { title: 'Choose primary creative medium and set up workspace', dueOffset: 7 },
      { title: 'Complete and ship first creative piece (post, publish, share)', dueOffset: 21 },
      { title: 'Establish weekly creative blocks — minimum 3 hours', dueOffset: 30 },
      { title: 'Finish a portfolio-worthy project', dueOffset: 60 },
      { title: 'Share work publicly and gather feedback', dueOffset: 90 },
    ],
    habits: ['Daily creative practice', 'Weekly creative review'],
  },

  social: {
    name: 'Relationships',
    icon: 'heart',
    color: '#FF6B6B',
    goalTitle: 'Strengthen my relationships',
    goalDescription: 'Invest deliberately in the people and connections that matter most',
    milestones: [
      { title: 'List top 5 relationships and rate each 1-10 for quality', dueOffset: 7 },
      { title: 'Schedule and complete one quality hangout or call per person', dueOffset: 21 },
      { title: 'Start one new social routine (weekly dinner, gaming night)', dueOffset: 30 },
      { title: 'Have one meaningful conversation you have been avoiding', dueOffset: 60 },
      { title: 'Host or organise a gathering for your community', dueOffset: 90 },
    ],
    habits: ['Reach out to one person daily', 'Weekly social time'],
  },
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/** All available domain keys */
export const DOMAIN_KEYS = Object.keys(TEMPLATES);

/** Get a template by key (e.g. 'health', 'career'). Returns undefined if not found. */
export function getTemplate(domainKey: string): DomainTemplate | undefined {
  return TEMPLATES[domainKey];
}

/**
 * Match a user-provided focus area string to a template key.
 * Uses fuzzy matching so 'Health & Fitness' => 'health', 'Career / Business' => 'career', etc.
 */
export function matchDomainKey(focusArea: string): string | null {
  const lower = focusArea.toLowerCase();

  // Exact key match
  if (TEMPLATES[lower]) return lower;

  // Fuzzy matches by keywords
  const keywordMap: Record<string, string[]> = {
    education: ['educat', 'learn', 'study', 'skill', 'cours', 'academi', 'school', 'training'],
    career: ['career', 'business', 'work', 'profession', 'job', 'employment', 'entrepreneur'],
    financial: ['financ', 'money', 'budget', 'saving', 'invest', 'debt', 'income', 'wealth'],
    health: ['health', 'fit', 'exercis', 'workout', 'gym', 'nutrition', 'diet', 'sleep', 'wellness', 'body'],
    spiritual: ['spirit', 'faith', 'religio', 'meditat', 'pray', 'mindful', 'soul', 'chur'],
    personal: ['personal', 'growth', 'self', 'habit', 'mindset', 'discipline', 'routin', 'develop'],
    creative: ['creativ', 'art', 'music', 'writ', 'design', 'paint', 'photo', 'craft', 'build'],
    social: ['relation', 'social', 'friend', 'family', 'communit', 'network', 'connect', 'love'],
  };

  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return key;
    }
  }

  return null;
}

/**
 * Build smart fallback FoundationData from user's focus areas and name.
 * Returns goalDetails with domain-specific milestones and actions.
 * This is INSTANT — no LLM call required.
 */
export function buildSmartFallback(opts: {
  focusAreas: string[];
  name?: string;
  statedGoals?: string[];
}): {
  goalDetails: Array<{
    title: string;
    type: 'short' | 'medium' | 'long';
    description: string;
    category: string;
    actions: string[];
    milestones: string[];
  }>;
  goals: string[];
  focusAreas: string[];
  goodHabits: string[];
  morningRoutine: Array<{ activity: string }>;
  eveningRoutine: Array<{ activity: string }>;
} {
  const { focusAreas, name, statedGoals } = opts;
  const personalPrefix = name ? `${name}' ` : '';

  // Resolve template keys from focus areas
  const resolvedKeys: string[] = [];
  const matched = new Set<string>();

  for (const area of focusAreas.slice(0, 5)) {
    const key = matchDomainKey(area);
    if (key && !matched.has(key)) {
      resolvedKeys.push(key);
      matched.add(key);
    }
  }

  // If no matches found, use health + career + personal as defaults
  if (resolvedKeys.length === 0) {
    resolvedKeys.push('health', 'career', 'personal');
  }

  const goalDetails: Array<{
    title: string;
    type: 'short' | 'medium' | 'long';
    description: string;
    category: string;
    actions: string[];
    milestones: string[];
  }> = [];

  const allHabits = new Set<string>();

  for (const key of resolvedKeys) {
    const template = TEMPLATES[key];
    if (!template) continue;

    // If the user stated a goal matching this domain, use it as the title
    const domainKeywords = key === 'education' ? ['learn', 'study', 'cours', 'skill', 'educat']
      : key === 'career' ? ['career', 'job', 'work', 'business', 'profession']
      : key === 'financial' ? ['money', 'financ', 'save', 'budget', 'invest', 'debt']
      : key === 'health' ? ['health', 'fit', 'exercis', 'gym', 'diet', 'nutrition', 'sleep']
      : key === 'spiritual' ? ['spirit', 'faith', 'meditat', 'pray', 'mindful']
      : key === 'personal' ? ['personal', 'growth', 'habit', 'self', 'routin']
      : key === 'creative' ? ['creativ', 'art', 'music', 'writ', 'design']
      : key === 'social' ? ['relation', 'social', 'friend', 'family', 'connect']
      : [];

    const matchingGoal = (statedGoals || []).find(g =>
      domainKeywords.some(kw => g.toLowerCase().includes(kw))
    );

    const title = matchingGoal
      ? capitalize(matchingGoal)
      : `${personalPrefix}${template.goalTitle}`;

    goalDetails.push({
      title,
      type: key === 'health' ? 'short' : 'medium',
      description: template.goalDescription,
      category: template.name,
      actions: template.milestones.slice(0, 3).map(m => m.title),
      milestones: template.milestones.map(m => m.title),
    });

    for (const h of template.habits) {
      allHabits.add(h);
    }
  }

  // If user stated goals that didn't match any domain, add them as additional goals
  for (const g of (statedGoals || [])) {
    const gLower = g.toLowerCase();
    const alreadyCovered = goalDetails.some(gd =>
      gd.title.toLowerCase().includes(gLower) || gLower.includes(gd.title.toLowerCase().split(' ')[0])
    );
    if (!alreadyCovered && goalDetails.length < 6) {
      goalDetails.push({
        title: capitalize(g),
        type: 'medium',
        description: `Working towards: ${g}`,
        category: 'Personal',
        actions: [
          `Research approaches for: ${g}`,
          `Take first concrete step: ${g}`,
          `Review progress on: ${g}`,
        ],
        milestones: [
          `Plan: ${g}`,
          `Execute: ${g}`,
          `Review: ${g}`,
        ],
      });
    }
  }

  return {
    goalDetails,
    goals: goalDetails.map(g => g.title),
    focusAreas: resolvedKeys.map(k => TEMPLATES[k]?.name || k),
    goodHabits: [...allHabits].slice(0, 8),
    morningRoutine: [{ activity: 'Morning review' }, { activity: 'Plan the day' }],
    eveningRoutine: [{ activity: 'Evening reflection' }, { activity: 'Review accomplishments' }],
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}