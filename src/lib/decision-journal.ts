/**
 * Decision Journal + Cognitive Bias Detection
 *
 * Thinking Fast and Slow-inspired decision tracking with
 * automatic bias detection via pattern matching.
 * Pure functions — no React imports.
 */

// ── TYPES ──

export type CognitiveBias =
  | 'confirmation_bias'
  | 'sunk_cost'
  | 'availability_heuristic'
  | 'anchoring'
  | 'overconfidence'
  | 'present_bias';

export interface DecisionEntry {
  id: string;
  date: string;
  decision: string;
  context: string;
  expectedOutcome: string;
  actualOutcome?: string;
  biasesDetected: CognitiveBias[];
  revisitDate?: string;
}

// ── BIAS DESCRIPTIONS ──

export const BIAS_DESCRIPTIONS: Record<CognitiveBias, { name: string; description: string; reframe: string }> = {
  confirmation_bias: {
    name: 'Confirmation Bias',
    description: 'Searching for or interpreting information in a way that confirms your preexisting beliefs.',
    reframe: 'Actively seek evidence that contradicts your assumption. Ask: what would change my mind?',
  },
  sunk_cost: {
    name: 'Sunk Cost Fallacy',
    description: 'Continuing a behavior because of previously invested resources (time, money, effort) rather than future value.',
    reframe: 'Ignore past investment. Ask only: if I were starting fresh today, would I choose this path?',
  },
  availability_heuristic: {
    name: 'Availability Heuristic',
    description: 'Overweighting information that comes to mind easily, often recent or emotionally charged events.',
    reframe: 'Look at base rates and data, not just vivid examples. What does the full picture show?',
  },
  anchoring: {
    name: 'Anchoring Bias',
    description: 'Relying too heavily on the first piece of information encountered when making decisions.',
    reframe: 'Generate multiple reference points before deciding. What would someone with no prior context think?',
  },
  overconfidence: {
    name: 'Overconfidence Bias',
    description: 'Excessive confidence in your own answers, predictions, or abilities.',
    reframe: 'Assign probability ranges instead of point estimates. What are the odds you are wrong?',
  },
  present_bias: {
    name: 'Present Bias',
    description: 'Overvaluing immediate rewards at the expense of long-term outcomes.',
    reframe: 'Project forward: how will you feel about this decision in 1 year? 5 years? Decide from there.',
  },
};

// ── BIAS DETECTION PATTERNS ──

interface BiasPattern {
  bias: CognitiveBias;
  patterns: string[];
}

const BIAS_PATTERNS: BiasPattern[] = [
  {
    bias: 'confirmation_bias',
    patterns: [
      'i always', 'i never', 'everyone knows', 'obviously', 'clearly',
      'proves my point', 'as i expected', 'i knew it', 'see i was right',
      'of course', 'this confirms',
    ],
  },
  {
    bias: 'sunk_cost',
    patterns: [
      'already invested', 'already spent', 'come this far', 'too late to',
      'put so much into', 'wasted if i stop', 'can\'t give up now',
      'after all the effort', 'money already spent', 'time already invested',
    ],
  },
  {
    bias: 'availability_heuristic',
    patterns: [
      'just saw', 'just heard', 'recently', 'in the news',
      'happened to someone', 'i read that', 'everyone is',
      'trending', 'viral', 'just happened',
    ],
  },
  {
    bias: 'anchoring',
    patterns: [
      'the first', 'originally', 'started at', 'initial',
      'compared to the original', 'from the beginning', 'the base',
      'at first', 'was originally',
    ],
  },
  {
    bias: 'overconfidence',
    patterns: [
      'i\'m certain', 'definitely will', 'guaranteed', 'no way it fails',
      'can\'t go wrong', 'absolutely', 'hundred percent', '100%',
      'impossible to fail', 'no doubt', 'for sure', 'slam dunk',
    ],
  },
  {
    bias: 'present_bias',
    patterns: [
      'just this once', 'start tomorrow', 'one more time', 'deserve it now',
      'worry later', 'deal with it later', 'right now i need', 'treat myself',
      'can\'t wait', 'need it now', 'yolo',
    ],
  },
];

// ── PUBLIC API ──

/**
 * Detect cognitive biases in decision text and context via pattern matching.
 */
export function detectBiases(decisionText: string, context: string): CognitiveBias[] {
  const combined = (decisionText + ' ' + context).toLowerCase();
  const detected = new Set<CognitiveBias>();

  for (const bp of BIAS_PATTERNS) {
    for (const pattern of bp.patterns) {
      if (combined.includes(pattern)) {
        detected.add(bp.bias);
        break;
      }
    }
  }

  return Array.from(detected);
}

// ── LOCAL STORAGE ──

const LS_KEY = 'lifeos_decision_journal';

function genId(): string {
  return 'dec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

/**
 * Save a new decision, auto-detecting biases.
 */
export function saveDecision(
  entry: Omit<DecisionEntry, 'id' | 'biasesDetected'>,
): DecisionEntry {
  const biasesDetected = detectBiases(entry.decision, entry.context);
  const full: DecisionEntry = {
    ...entry,
    id: genId(),
    biasesDetected,
  };

  const existing = getDecisions();
  existing.push(full);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }

  return full;
}

/**
 * Update an existing decision (e.g. record actual outcome).
 */
export function updateDecision(id: string, updates: Partial<DecisionEntry>): void {
  const decisions = getDecisions();
  const idx = decisions.findIndex(d => d.id === id);
  if (idx < 0) return;
  decisions[idx] = { ...decisions[idx], ...updates };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(decisions));
  } catch { /* ignore */ }
}

/**
 * Get all saved decisions.
 */
export function getDecisions(): DecisionEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get decisions past their revisitDate with no actualOutcome recorded.
 */
export function getOutstandingDecisions(): DecisionEntry[] {
  const today = new Date().toISOString().split('T')[0];
  return getDecisions().filter(d =>
    d.revisitDate && d.revisitDate <= today && !d.actualOutcome
  );
}

/**
 * Get a pattern report of bias frequency across all decisions.
 */
export function getPatternReport(): {
  mostCommonBias: CognitiveBias | null;
  biasCount: Record<CognitiveBias, number>;
} {
  const decisions = getDecisions();
  const biasCount: Record<CognitiveBias, number> = {
    confirmation_bias: 0,
    sunk_cost: 0,
    availability_heuristic: 0,
    anchoring: 0,
    overconfidence: 0,
    present_bias: 0,
  };

  for (const d of decisions) {
    for (const b of d.biasesDetected) {
      biasCount[b]++;
    }
  }

  let mostCommonBias: CognitiveBias | null = null;
  let maxCount = 0;
  for (const [bias, count] of Object.entries(biasCount) as [CognitiveBias, number][]) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonBias = bias;
    }
  }

  return { mostCommonBias, biasCount };
}
