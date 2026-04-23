# Hermetic Alignment Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the Seven Hermetic Principles structurally causal in LifeOS — not just decorative labels painted on after the fact, but living wires that connect engine logic to Hermetic wisdom.

**Architecture:** Three layers. (1) Tag engine outputs with governing principle. (2) Build a bridge module (hermetic-principle-insight.ts) that converts tagged engine data into Hermetic-framed wisdom. (3) Update UI components to consume bridge data instead of static day-rotation strings. Additionally, deepen the three weakest principles (Gender 2/10, Vibration 5/10, Polarity 5/10) with new structural features.

**Tech Stack:** TypeScript, React, existing Zustand stores, existing engines (pattern-engine, correlation-engine, xp-engine)

**Current Holiness Score:** 5.1/10 — Target: 7.5/10

---

## Task H1: Add `hermeticPrinciple` field to pattern-engine DetectedPattern

**Objective:** Pattern-engine already detects Rhythm (energy_cycle) and Cause & Effect (goal_neglect, spending_spike). Now tag each pattern with its governing principle so downstream consumers can use Hermetic framing.

**Files:**
- Modify: `src/lib/pattern-engine.ts` (lines 20-22, 34-41)

**Step 1: Add `hermeticPrinciple` to PatternType and DetectedPattern**

In `pattern-engine.ts`:
- Add `'rhythm_swing'` to PatternType (for pendulum-swing detection — the amplitude/oscillation that Rhythm governs)
- Add `hermeticPrinciple?: number` field to DetectedPattern (index into SEVEN_PRINCIPLES)
- Import `{ DOMAIN_PRINCIPLE }` from `./hermetic-integration`

**Step 2: Tag each detect function with its governing principle**

- `detectProductivityPeaks` → tag `hermeticPrinciple: 4` (RHYTHM)
- `detectEnergyCycles` → tag `hermeticPrinciple: 4` (RHYTHM)  
- `detectHabitAnchors` → tag `hermeticPrinciple: 2` (VIBRATION — frequency = consistency)
- `detectGoalNeglect` → tag `hermeticPrinciple: 5` (CAUSE & EFFECT)
- `detectSpendingSpikes` → tag `hermeticPrinciple: 5` (CAUSE & EFFECT)
- `detectStreakRisk` → tag `hermeticPrinciple: 2` (VIBRATION — frequency about to break)
- `detectOptimalSchedule` → tag `hermeticPrinciple: 4` (RHYTHM)
- New: `detectRhythmSwing` → tag `hermeticPrinciple: 4` (RHYTHM — detects peak→decline transition)

**Step 3: Implement `detectRhythmSwing`**

New detector that identifies when a user is at a productivity peak and likely about to swing down (based on 3+ consecutive high days followed by a slight dip). This makes Rhythm's "pendulum swing" visible and actionable.

**Step 4: Verify build**

Run: `cd /mnt/data/tmp/lifeos && npx tsc --noEmit 2>&1 | tail -5`

---

## Task H2: Wire Intent Engine to Hermetic principles

**Objective:** The Intent Engine is the most behaviorally impactful AI component but has zero Hermetic awareness. Add a Hermetic context section to the system prompt so the AI can frame responses through the Hermetic lens when appropriate.

**Files:**
- Modify: `src/lib/intent/system-prompt.ts` (after line 85, before ACTION CLASSIFICATION)

**Step 1: Import hermetic integration**

```typescript
import { SEVEN_PRINCIPLES, DOMAIN_PRINCIPLE, getDailyPrinciple, getDomainPrinciple } from '../hermetic-integration';
```

**Step 2: Add Hermetic Context section to system prompt**

After the orchestrator tools section, add:

```
## HERMETIC WISDOM (The Seven Principles)
LifeOS is built on the Seven Hermetic Principles from The Kybalion. When offering insight, reflection, or advice, weave these principles naturally:

- MENTALISM: "The All is Mind" — Thoughts create reality. The AI companion is the Mind that perceives patterns.
- CORRESPONDENCE: "As Above, So Below" — Inner state reflects in outer data. Dashboard is the microcosm.
- VIBRATION: "Nothing Rests" — Every habit is a vibration; consistency is frequency.
- POLARITY: "Everything Has Poles" — Balance extremes. When at one pole, the other awaits.
- RHYTHM: "Everything Flows" — The pendulum swings. Master cycles, master the day.
- CAUSE & EFFECT: "Every Cause Has Its Effect" — Every action ripples. XP is structured karma.
- GENDER: "Gender is in Everything" — Creation needs both vision (feminine) and action (masculine).

Today's governing principle: ${dailyPrinciple.name} — "${dailyPrinciple.axiom}"
${dailyPrinciple.dailyAffirmation}

When the user mentions patterns, cycles, habits, balance, or life philosophy — reference the relevant principle. Don't force it into every reply. Let it arise naturally.
```

**Step 3: Verify build**

---

## Task H3: Add Hermetic tagging to correlation-engine

**Objective:** The correlation engine mathematically proves Correspondence. Tag its results so consumers know which principle is at work.

**Files:**
- Modify: `src/lib/llm/correlation-engine.ts`

**Step 1: Add `hermeticPrinciple` to CorrelationResult**

Each correlation (positive or negative) proves Correspondence. Tag ALL results with `hermeticPrinciple: 1` (CORRESPONDENCE).

Additionally, tag negative correlations with `polarityDetected: true` to signal Polarity is also at play.

**Step 2: Import from hermetic-integration**

```typescript
import { SEVEN_PRINCIPLES } from '../hermetic-integration';
```

**Step 3: Verify build**

---

## Task H4: Add Hermetic tagging to xp-engine

**Objective:** XP IS Cause & Effect in practice. The engine should know this now.

**Files:**
- Modify: `src/lib/gamification/xp-engine.ts`

**Step 1: Add `hermeticPrinciple` to XPCalculation**

Add `hermeticPrinciple: 5` (CAUSE & EFFECT) to every XPCalculation result. Also add a `hermeticInsight` string that frames the XP in Hermetic terms, e.g.:

```
"Every cause has its effect — your {action} generated {xp} XP. The Law of Compensation operates."
```

**Step 2: Import from hermetic-integration**

```typescript
import { SEVEN_PRINCIPLES } from '../hermetic-integration';
```

**Step 3: Verify build**

---

## Task H5: Create hermetic-principle-insight.ts bridge module

**Objective:** A bridge module that takes tagged engine data (patterns, correlations, XP) and converts them into Hermetic-framed wisdom strings, principle colors, and actionable insights. This replaces the current day-rotation system for insight widgets.

**Files:**
- Create: `src/lib/hermetic-principle-insight.ts`

**Step 1: Create the bridge module**

```typescript
/**
 * Hermetic Principle Insight Bridge
 * 
 * Converts engine data into Hermetic-framed wisdom. The paint 
 * becomes the structure. The decoration becomes the architecture.
 */

import { SEVEN_PRINCIPLES, type HermeticPrinciple } from './hermetic-integration';
import type { DetectedPattern } from './pattern-engine';

export interface PrincipleInsight {
  principle: HermeticPrinciple;
  source: 'pattern' | 'correlation' | 'xp' | 'daily' | 'polarity' | 'rhythm_swing';
  title: string;
  wisdom: string;        // Hermetic-framed insight text
  practice: string;      // What the user can DO about it
  miracle: string;       // What becomes possible through this principle
  color: string;
  confidence: number;
  data: Record<string, any>;
}

export function patternToInsight(pattern: DetectedPattern): PrincipleInsight | null {
  if (!pattern.hermeticPrinciple && pattern.hermeticPrinciple !== 0) return null;
  const principle = SEVEN_PRINCIPLES[pattern.hermeticPrinciple!];
  
  // Map pattern types to Hermetic wisdom
  const WISDOM_MAP: Record<string, { wisdom: string; practice: string; miracle: string }> = {
    productivity_peak: {
      wisdom: 'Your peak hours are where Rhythm and Will converge. The pendulum reaches its apex here.',
      practice: 'Schedule your most important work during detected peak hours.',
      miracle: 'Master your peak hours and you master your entire week.',
    },
    energy_cycle: {
      wisdom: 'The pendulum swings between energy and rest. Your cycle is the Rhythm of your life force.',
      practice: 'Align your tasks with your energy, not against it.',
      miracle: 'When you flow with your rhythm, effort becomes effortless.',
    },
    rhythm_swing: {
      wisdom: 'The pendulum cannot stay at its peak. What rises must rhythmically fall — but only to rise again.',
      practice: 'When at a peak, prepare for the natural decline. Rest IS part of the rhythm.',
      miracle: 'Anticipating the swing, you ride it instead of being thrown by it.',
    },
    habit_anchor: {
      wisdom: 'Your consistent habits vibrate at the highest frequency. They ARE your vibration.',
      practice: 'Use anchor habits as launching pads for new ones — stack frequencies.',
      miracle: 'A habit at peak frequency becomes automatic — it vibrates without effort.',
    },
    goal_neglect: {
      wisdom: 'Neglect is a cause. Its effect compounds silently. Every day without action is a cause set against your goal.',
      practice: 'Even 5 minutes of action breaks the causal chain of neglect.',
      miracle: 'The Law of Compensation ensures that consistent causes produce extraordinary effects.',
    },
    spending_spike: {
      wisdom: 'Money follows the Law of Cause and Effect. A spending spike is an effect — what caused it?',
      practice: 'Identify the emotional cause behind spending effects. Address the cause, not just the effect.',
      miracle: 'When you master the causes, the effects take care of themselves.',
    },
    streak_risk: {
      wisdom: 'Your streak is a vibration about to break. A frequency interrupted is harder to restart.',
      practice: 'Do the minimum to keep the vibration alive. One rep counts. One minute counts.',
      miracle: 'The vibration that never fully stops can always crescendo again.',
    },
    optimal_schedule: {
      wisdom: 'Rhythm governs all life. Your optimal schedule is where your personal rhythm meets the demands of time.',
      practice: 'Accept the suggested time blocks as rhythm-aligned, not just efficiency-optimized.',
      miracle: 'A rhythm-aligned schedule feels like flow, not discipline.',
    },
  };
  
  const mapped = WISDOM_MAP[pattern.type] || {
    wisdom: principle.axiom,
    practice: principle.dailyAffirmation,
    miracle: 'Apply this principle consistently and transformation follows.',
  };
  
  return {
    principle,
    source: pattern.type === 'rhythm_swing' ? 'rhythm_swing' : 'pattern',
    title: pattern.title,
    wisdom: mapped.wisdom,
    practice: mapped.practice,
    miracle: mapped.miracle,
    color: principle.color,
    confidence: pattern.confidence,
    data: pattern.data,
  };
}

export function correlationToInsight(corr: {
  domain1: string; domain2: string; pearsonR: number; 
  hermeticPrinciple?: number; polarityDetected?: boolean;
}): PrincipleInsight {
  const principle = SEVEN_PRINCIPLES[corr.hermeticPrinciple ?? 1];
  const isPositive = corr.pearsonR > 0;
  
  let wisdom: string;
  let practice: string;
  
  if (corr.polarityDetected) {
    wisdom = `Your ${corr.domain1} and ${corr.domain2} are in inverse relationship — Polarity in action. When one rises, the other falls.`;
    practice = `Don\'t fight the polarity. Find the neutral point where both domains coexist.`;
  } else {
    wisdom = `Your ${corr.domain1} and ${corr.domain2} mirror each other. As above, so below — your ${corr.domain1} IS your ${corr.domain2} in miniature.`;
    practice = `Change your ${corr.domain1} and watch your ${corr.domain2} transform. They are the same pattern at different scales.`;
  }
  
  return {
    principle,
    source: 'correlation',
    title: `${corr.domain1} ↔ ${corr.domain2}`,
    wisdom,
    practice,
    miracle: 'When you see the correspondence, you can change one domain through another.',
    color: principle.color,
    confidence: Math.abs(corr.pearsonR),
    data: { pearsonR: corr.pearsonR, domain1: corr.domain1, domain2: corr.domain2 },
  };
}

/** Get the most relevant principle insight for the current moment */
export function getCurrentPrincipleInsight(patterns: DetectedPattern[]): PrincipleInsight | null {
  // Prefer rhythm_swing (most actionable), then highest confidence pattern
  const swing = patterns.find(p => p.type === 'rhythm_swing');
  if (swing) return patternToInsight(swing);
  
  const tagged = patterns.filter(p => p.hermeticPrinciple !== undefined).sort((a, b) => b.confidence - a.confidence);
  if (tagged.length > 0) return patternToInsight(tagged[0]);
  
  // Fallback to daily principle
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const daily = SEVEN_PRINCIPLES[dayOfYear % 7];
  return {
    principle: daily,
    source: 'daily',
    title: `Today's Principle: ${daily.name}`,
    wisdom: daily.quote,
    practice: daily.dailyAffirmation,
    miracle: `Apply ${daily.axiom} consistently and observe what transforms.`,
    color: daily.color,
    confidence: 0.5,
    data: {},
  };
}
```

**Step 2: Verify build**

---

## Task H6: Create HermeticPrincipleOverlay.tsx — principle-aware insight cards

**Objective:** Replace static HermeticPrincipleBar (footer decoration) with an data-driven overlay card that shows PRINCIPLE / WISDOM / PRACTICE / MIRACLE from engine data.

**Files:**
- Create: `src/components/shared/HermeticPrincipleOverlay.tsx`
- Create: `src/components/shared/HermeticPrincipleOverlay.css`

**Step 1: Create the Overlay component**

A card that appears at bottom of dashboard widgets, showing:
- The governing principle name + axiom (in principle color)
- The wisdom text (1-2 lines, from bridge module)
- A "Practice" one-liner
- Collapsible "Miracle" section

This is NOT a decoration — it's the bridge surface where engine data meets Hermetic wisdom.

**Step 2: Replace HermeticPrincipleBar usage in key dashboard widgets**

Update at least 3 dashboard components to use HermeticPrincipleOverlay:
- DashboardScheduleInsights (schedule = Rhythm)
- DashboardFinancialPulse (finance = Cause & Effect)  
- QuickLogMood (health = Polarity)

**Step 3: Verify build**

---

## Task H7: Enhance Gender principle — vision/action dual-force tracking in goal creation

**Objective:** Gender (2/10 — weakest principle) needs structural implementation. Add a `force` field to goals: `'vision' | 'action' | 'balanced'`. Vision goals are feminine (dreaming, imagining, seed-planting). Action goals are masculine (executing, building, watering). LifeOS tracks the balance.

**Files:**
- Modify: `src/stores/useGoalsStore.ts` — add `hermeticForce` field to goal creation
- Create: `src/lib/hermetic-gender-balance.ts` — balance tracking engine
- Modify: `src/components/goals/GoalsForm.tsx` — add force selector UI

**Step 1: Create hermetic-gender-balance.ts**

```typescript
/** Hermetic Gender Principle — Vision (Feminine) + Action (Masculine) = Creation */
export type HermeticForce = 'vision' | 'action' | 'balanced';

export interface GenderBalance {
  visionCount: number;
  actionCount: number;
  balancedCount: number;
  ratio: number;           // visionCount / (actionCount || 1) — 1.0 = balanced
  dominantForce: 'vision' | 'action' | 'balanced';
  advice: string;
}

export function calculateGenderBalance(goals: { hermeticForce?: HermeticForce }[]): GenderBalance {
  const vision = goals.filter(g => g.hermeticForce === 'vision').length;
  const action = goals.filter(g => g.hermeticForce === 'action').length;
  const balanced = goals.filter(g => g.hermeticForce === 'balanced' || !g.hermeticForce).length;
  const ratio = vision / (action || 1);
  
  let dominant: GenderBalance['dominantForce'] = 'balanced';
  let advice: string;
  
  if (ratio > 1.5) {
    dominant = 'vision';
    advice = 'Many dreams, few deeds. The Feminine principle calls — but the Masculine must answer. Add action goals.';
  } else if (ratio < 0.67) {
    dominant = 'action';
    advice = 'Much doing, little dreaming. The Masculine builds — but what is it building toward? Add vision goals.';
  } else {
    advice = 'Vision and action dance in balance. Creation flows when both principles unite.';
  }
  
  return { visionCount: vision, actionCount: action, balancedCount: balanced, ratio, dominantForce: dominant, advice };
}

/** Suggest a force for a goal based on its title/description */
export function suggestForce(title: string, description?: string): HermeticForce {
  const text = `${title} ${description || ''}`.toLowerCase();
  const visionWords = ['dream', 'vision', 'imagine', 'explore', 'discover', 'envision', 'aspire', 'wonder', 'inspire', 'create'];
  const actionWords = ['build', 'ship', 'launch', 'fix', 'implement', 'complete', 'finish', 'execute', 'deliver', 'achieve'];
  
  const visionScore = visionWords.filter(w => text.includes(w)).length;
  const actionScore = actionWords.filter(w => text.includes(w)).length;
  
  if (visionScore > actionScore + 1) return 'vision';
  if (actionScore > visionScore + 1) return 'action';
  return 'balanced';
}
```

**Step 2: Add hermeticForce to goal creation in useGoalsStore**

**Step 3: Add force selector to GoalsForm (small pill buttons: Vision/Action/Balanced with Gender principle color #EC4899)**

**Step 4: Verify build**

---

## Task H8: Add Vibration visualization — EnergyWave component

**Objective:** Vibration (5/10) needs visual embodiment. Replace the static 1-5 energy sparkline with an actual wave visualization showing frequency, amplitude, and resonance.

**Files:**
- Create: `src/components/dashboard/EnergyWave.tsx`
- Create: `src/components/dashboard/EnergyWave.css`

**Step 1: Create EnergyWave component**

Canvas-based sinusoidal wave that visualizes the user's last 14 days of energy scores as an animated waveform:
- X-axis: 14 days
- Y-axis: energy (1-5)
- Line color: Vibration principle purple (#A855F7)
- Amplitude = variance in energy (high amplitude = volatile, low = stable)
- Frequency = how often energy changes significantly
- Background glow intensifies with streak length
- Subtle animation (wave slowly oscillates)
- Label: "Your Vibration — amplitude {N}, frequency {N}"

**Step 2: Add to Dashboard in health/widget area**

**Step 3: Verify build**

---

## Task H9: Add Polarity transmutation detection

**Objective:** Polarity (5/10) needs operationalization. Detect when a user is at an extreme pole (mood 1 or 5, energy 1 or 5 for 2+ days) and offer a "transmutation" suggestion — the Hermetic art of consciously shifting between poles.

**Files:**
- Create: `src/lib/hermetic-polarity.ts`
- Modify: `src/components/dashboard/QuickLogMood.tsx` — show transmutation prompt

**Step 1: Create hermetic-polarity.ts**

```typescript
/** Hermetic Polarity Principle — Transmutation of extremes */
export interface PolarityState {
  domain: 'mood' | 'energy' | 'spending' | 'productivity';
  currentPole: 'negative' | 'positive';
  intensity: number;      // 0-1, how extreme
  daysAtPole: number;
  transmutable: boolean;  // true if at extreme for 2+ days
  transmutationHint: string;
}

export function detectPolarityState(
  domain: 'mood' | 'energy' | 'spending' | 'productivity',
  recentValues: number[],  // last 7 days, scale 1-5
): PolarityState | null {
  if (recentValues.length < 3) return null;
  
  const latest = recentValues[recentValues.length - 1];
  const isExtreme = latest <= 1 || latest >= 5;
  if (!isExtreme) return null;
  
  const currentPole: PolarityState['currentPole'] = latest >= 4 ? 'positive' : 'negative';
  const intensity = latest >= 5 ? 1 : latest <= 1 ? 1 : Math.abs(latest - 3) / 2;
  
  let daysAtPole = 0;
  for (let i = recentValues.length - 1; i >= 0; i--) {
    if ((currentPole === 'positive' && recentValues[i] >= 4) || 
        (currentPole === 'negative' && recentValues[i] <= 2)) {
      daysAtPole++;
    } else break;
  }
  
  const TRANSMUTATION_MAP: Record<string, Record<string, string>> = {
    mood: {
      positive: 'You\'re riding high — but the pendulum will swing. Plant seeds NOW for when the mood shifts. Journal your state so you can recall it later.',
      negative: 'The low pole is temporary. Polarity teaches: you cannot raise it by resisting it. Instead, FIND the opposite pole within — one tiny thing that brings ease. Transmute, don\'t fight.',
    },
    energy: {
      positive: 'Peak energy is a wave — ride it NOW, but build recovery into your schedule. The Rhythm Law says the decline comes next. Prepare your rest.',
      negative: 'Exhaustion is the other pole. Don\'t push harder — that deepens the swing. The alchemical method: do ONE small thing that requires zero energy but gives some back. A walk. Cold water. Breath.',
    },
    spending: {
      positive: 'Abundance flows — but Polarity says the tide returns. Channel surplus into savings before the cycle turns.',
      negative: 'Scarcity is a pole, not a permanent state. Identify one expense to defer, one income to pursue. Small causes shift the polarity over time.',
    },
    productivity: {
      positive: 'Shipping fast? Great. But the pole always swings. Document what\'s working NOW so you can replicate it when focus dips.',
      negative: 'Low output feels permanent. It\'s not. Polarity transmutation: lower the bar. Ship something tiny. One commit. One sentence. The pole shifts with the smallest cause.',
    },
  };
  
  return {
    domain,
    currentPole,
    intensity,
    daysAtPole,
    transmutable: daysAtPole >= 2,
    transmutationHint: TRANSMUTATION_MAP[domain]?.[currentPole] || 'Observe the pole. The opposite awaits.',
  };
}
```

**Step 2: Show transmutation prompt in QuickLogMood when polarity is extreme**

When the user logs mood and it's at an extreme for 2+ days, show a subtle Polarity-colored (#FACC15) card below the mood buttons with the transmutationHint.

**Step 3: Verify build**

---

## Task H10: Update dashboard-modes.ts with Hermetic principle

**Objective:** Dashboard mode priorities subtly shift based on today's governing principle. Rhythm day → schedule widget gets +2 priority. Mentalism day → oracle/AI widget gets +2.

**Files:**
- Modify: `src/lib/dashboard-modes.ts`

**Step 1: Import hermetic-integration**

```typescript
import { getDailyPrinciple, DOMAIN_PRINCIPLE } from './hermetic-integration';
```

**Step 2: Add subtle hermetic priority boost**

Create a `getHermeticBoost(widgetId: string): number` function that adds +2 priority to the widget matching today's principle domain. This doesn't replace the day-rotation system — it enhances it with engine-awareness.

**Step 3: Verify build**

---

## Final Integration

**Step 1: Full build check**
```bash
cd /mnt/data/tmp/lifeos && npx tsc --noEmit 2>&1 | tail -5 && npm run build:desktop 2>&1 | tail -5
```

**Step 2: Commit**
```bash
git add -A && git commit -m "feat: Hermetic Alignment — Seven Principles become structurally causal

- Pattern engine now tags patterns with governing Hermetic principle
- Intent Engine gains Hermetic awareness via system prompt section
- Correlation engine tagged with Correspondence principle
- XP engine tagged with Cause & Effect principle
- New bridge module: hermetic-principle-insight.ts (engine data → Hermetic wisdom)
- New HermeticPrincipleOverlay component (data-driven, not decorative)
- Gender principle deepened: vision/action dual-force goal tracking
- Vibration principle: EnergyWave canvas visualization
- Polarity principle: transmutation detection for extreme states
- Dashboard mode priorities enhanced with daily principle boost

Audit: 5.1/10 → target 7.5/10"
```

**Step 3: Bump version to 1.19.70**