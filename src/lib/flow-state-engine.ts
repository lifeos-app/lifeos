/**
 * flow-state-engine.ts — Flow State Detection & Optimization Engine
 *
 * Based on Csikszentmihalyi's flow model:
 *   Flow = high challenge + high skill + deep focus + clear goals + immediate feedback
 *
 * Detects when the user is likely in a flow state based on behavioral patterns
 * from journal entries, habit logs, and task completions. Provides insights
 * using the ultradian rhythm (90-min cycles) and the Hermetic Principle of Rhythm.
 *
 * "Everything flows, out and in; the pendulum swing manifests in everything."
 * — The Kybalion, Principle of Rhythm
 */

// ── Types ────────────────────────────────────────────────────────────

export type FlowActivity =
  | 'coding' | 'writing' | 'studying' | 'cleaning' | 'exercise' | 'other';

export interface FlowStateRecord {
  id: string;
  startedAt: string;       // ISO timestamp
  endedAt?: string;        // ISO timestamp
  duration_minutes: number;
  activity: FlowActivity;
  depth_score: number;     // 0–1, how deep the flow state was
  challenge_level: number; // 1–10, self-reported or inferred
  skill_level: number;     // 1–10, self-reported or inferred
}

export interface FlowInsight {
  peakFlowHours: number[];          // e.g. [9, 10, 22, 23]
  avgFlowDuration: number;          // minutes
  optimalConditions: string[];      // e.g. ['morning', 'no_interruptions']
  flowToInterruptionRatio: number;  // deep focus time vs interrupted time
  weeklyFlowHours: number;          // total hours in flow this week
  recommendation: string;           // actionable recommendation
}

/** Minimal shape expected from activity logs for detection */
export interface ActivityEntry {
  id: string;
  timestamp: string;    // ISO timestamp
  tag?: string;          // activity tag/category
  type: 'journal' | 'task' | 'habit';
}

// ── Constants ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeos:flow-states';
const MAX_RECORDS = 200;

/** Ultradian rhythm: 90-min focus cycle */
const ULTRADIAN_FOCUS_MIN = 90;
const ULTRADIAN_BREAK_MIN = 20;

/** Detection thresholds */
const MIN_ACTIVITIES_FOR_FLOW = 3;
const MAX_GAP_BETWEEN_ACTIVITIES_MIN = 15;
const FLOW_WINDOW_HOURS = 2;

// ── Storage helpers ───────────────────────────────────────────────────

function loadFlowStates(): FlowStateRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FlowStateRecord[];
  } catch {
    return [];
  }
}

function saveFlowStates(records: FlowStateRecord[]): void {
  // Cap at MAX_RECORDS, dropping oldest
  const trimmed = records
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ── Core functions ────────────────────────────────────────────────────

/**
 * Generate a simple unique ID for flow records.
 */
function flowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Infer the activity type from a tag string.
 */
function inferActivity(tag?: string): FlowActivity {
  if (!tag) return 'other';
  const t = tag.toLowerCase();
  if (/code|dev|program|debug|implement|build|deploy/i.test(t)) return 'coding';
  if (/writ|draft|edit|blog|essay|doc|note/i.test(t)) return 'writing';
  if (/stud|learn|read|course|lesson|review|practice/i.test(t)) return 'studying';
  if (/clean|organ|tidy|declutter|sort/i.test(t)) return 'cleaning';
  if (/exerc|workout|run|gym|walk|yoga|stretch/i.test(t)) return 'exercise';
  return 'other';
}

/**
 * Compute depth score based on challenge vs skill alignment in the
 * Csikszentmihalyi model. Flow is highest when challenge ≈ skill and both
 * are high (channel theory).
 */
export function computeDepthScore(
  challengeLevel: number,
  skillLevel: number,
): number {
  // Flow is strongest when challenge ≈ skill + a small stretch
  // and both are high. Low skill + low challenge = apathy, not flow.
  const avgLevel = (challengeLevel + skillLevel) / 20; // 0–1
  const balance = 1 - Math.abs(challengeLevel - skillLevel) / 10; // closer = more flow
  return Math.min(avgLevel * 0.6 + balance * 0.4, 1);
}

/**
 * Detect flow state from a chronological activity log.
 *
 * Heuristic: if the user logs 3+ related activities within a 2-hour window
 * with no gaps >15 minutes between them, they were likely in a flow state.
 * Journal entries with the same tag and >30 min gap suggests continuous
 * deep work on that topic.
 */
export function detectFlowState(
  activityLog: ActivityEntry[],
): FlowStateRecord | null {
  if (activityLog.length < MIN_ACTIVITIES_FOR_FLOW) return null;

  // Sort chronologically
  const sorted = [...activityLog].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Find the longest contiguous cluster within a 2-hour window
  let bestCluster = { start: 0, end: 0, length: 0 };

  for (let start = 0; start < sorted.length; start++) {
    const startTime = new Date(sorted[start].timestamp).getTime();
    const startTag = sorted[start].tag?.toLowerCase();

    let clusterEnd = start;
    for (let j = start + 1; j < sorted.length; j++) {
      const entryTime = new Date(sorted[j].timestamp).getTime();
      const prevTime = new Date(sorted[clusterEnd].timestamp).getTime();

      // Check gap between consecutive entries
      const gapMin = (entryTime - prevTime) / 60000;
      if (gapMin > MAX_GAP_BETWEEN_ACTIVITIES_MIN) break;

      // Check total window (max 2 hours from start)
      const totalWindow = (entryTime - startTime) / 60000;
      if (totalWindow > FLOW_WINDOW_HOURS * 60) break;

      // Prefer related activities (same tag)
      const entryTag = sorted[j].tag?.toLowerCase();
      if (startTag && entryTag && startTag === entryTag) {
        clusterEnd = j;
      } else {
        // Unrelated activities can still cluster but are weaker
        clusterEnd = j;
      }
    }

    const clusterLength = clusterEnd - start + 1;
    // Bonus: count how many share the same tag
    let sameTagCount = 0;
    for (let k = start; k <= clusterEnd; k++) {
      const tag = sorted[k].tag?.toLowerCase();
      if (tag && tag === startTag) sameTagCount++;
    }

    // Score: cluster size + same-tag bonus
    const score = clusterLength + (sameTagCount > 1 ? sameTagCount * 0.5 : 0);

    if (clusterLength >= MIN_ACTIVITIES_FOR_FLOW && score > bestCluster.length) {
      bestCluster = {
        start,
        end: clusterEnd,
        length: clusterLength,
      };
    }
  }

  if (bestCluster.length < MIN_ACTIVITIES_FOR_FLOW) return null;

  // Build the flow record from the best cluster
  const clusterEntries = sorted.slice(bestCluster.start, bestCluster.end + 1);
  const startedAt = clusterEntries[0].timestamp;
  const endedAt = clusterEntries[clusterEntries.length - 1].timestamp;
  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const durationMin = Math.round(durationMs / 60000);

  if (durationMin < 10) return null; // Too short to be meaningful flow

  // Infer activity from dominant tag
  const dominantTag = clusterEntries
    .filter(e => e.tag)
    .map(e => e.tag!)
    .reduce<string | null>((best, tag, _i, arr) => {
      const count = arr.filter(t => t === tag).length;
      if (!best || count > arr.filter(t => t === best).length) return tag;
      return best;
    }, null);

  const activity = inferActivity(dominantTag || undefined);

  // Infer challenge & skill levels (heuristic: more activities + coherence = higher)
  const sameTagEntries = clusterEntries.filter(
    e => e.tag?.toLowerCase() === (dominantTag?.toLowerCase() ?? e.tag?.toLowerCase()),
  );
  const coherence = sameTagEntries.length / clusterEntries.length;

  // More intense flow if more coherent and longer
  const challengeLevel = Math.min(Math.round((4 + durationMin / 15 + coherence * 3) * 10) / 10, 10);
  const skillLevel = Math.min(Math.round((5 + coherence * 4) * 10) / 10, 10);
  const depthScore = computeDepthScore(challengeLevel, skillLevel);

  return {
    id: flowId(),
    startedAt,
    endedAt,
    duration_minutes: durationMin,
    activity,
    depth_score: Math.round(depthScore * 100) / 100,
    challenge_level: Math.round(challengeLevel * 10) / 10,
    skill_level: Math.round(skillLevel * 10) / 10,
  };
}

/**
 * Get flow insights by analyzing past flow records.
 *
 * Computes peak hours, average duration, optimal conditions,
 * flow-to-interruption ratio, and weekly flow hours.
 * Uses ultradian rhythm principle (90-min focus + 20-min rest).
 */
export function getFlowInsights(_userId?: string): FlowInsight {
  const records = loadFlowStates();
  const now = Date.now();

  // Default insight for no data
  if (records.length === 0) {
    return {
      peakFlowHours: [9, 10, 22],
      avgFlowDuration: 45,
      optimalConditions: ['morning', 'consistent_routine'],
      flowToInterruptionRatio: 0,
      weeklyFlowHours: 0,
      recommendation:
        'Start logging flow states to discover your rhythm. The Law of Rhythm says: everything flows. Your peak hours are waiting to be found.',
    };
  }

  // ── Peak Flow Hours ──
  const hourCounts: Record<number, number> = {};
  for (const r of records) {
    const hour = new Date(r.startedAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const maxHourCount = Math.max(...Object.values(hourCounts), 1);
  const peakFlowHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([h]) => Number(h))
    .sort((a, b) => a - b);

  // ── Average Duration ──
  const avgFlowDuration = Math.round(
    records.reduce((sum, r) => sum + r.duration_minutes, 0) / records.length,
  );

  // ── Optimal Conditions ──
  const conditions: string[] = [];

  // Time-of-day preference
  const morningPeaks = peakFlowHours.filter(h => h >= 5 && h < 12).length;
  const eveningPeaks = peakFlowHours.filter(h => h >= 17 || h < 5).length;
  if (morningPeaks > eveningPeaks) conditions.push('morning');
  else if (eveningPeaks > morningPeaks) conditions.push('evening');
  else conditions.push('afternoon');

  // Activity types with highest depth
  const activityDepth: Record<string, { total: number; count: number }> = {};
  for (const r of records) {
    if (!activityDepth[r.activity]) activityDepth[r.activity] = { total: 0, count: 0 };
    activityDepth[r.activity].total += r.depth_score;
    activityDepth[r.activity].count += 1;
  }
  const bestActivity = Object.entries(activityDepth)
    .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0];
  if (bestActivity) {
    conditions.push(`deep_${bestActivity[0]}`);
  }

  // Uninterrupted sessions (depth > 0.7 and duration > 45 min)
  const deepSessions = records.filter(r => r.depth_score > 0.7 && r.duration_minutes > 45);
  if (deepSessions.length > records.length * 0.3) {
    conditions.push('no_interruptions');
  }

  // Music tag (if any flow had "music" context — future extension point)
  if (records.some(r => r.activity === 'studying' || r.activity === 'coding')) {
    conditions.push('focused_environment');
  }

  // ── Flow-to-Interruption Ratio ──
  // Deep sessions (>45 min) vs shallow sessions (<45 min)
  const deepTime = records
    .filter(r => r.duration_minutes >= 45)
    .reduce((s, r) => s + r.duration_minutes, 0);
  const shallowTime = records
    .filter(r => r.duration_minutes < 45)
    .reduce((s, r) => s + r.duration_minutes, 0);
  const flowToInterruptionRatio = shallowTime > 0
    ? Math.round((deepTime / shallowTime) * 100) / 100
    : deepTime > 0 ? 10 : 0;

  // ── Weekly Flow Hours ──
  const weekAgo = new Date(now - 7 * 86400000).toISOString();
  const weeklyFlowMinutes = records
    .filter(r => r.startedAt >= weekAgo)
    .reduce((sum, r) => sum + r.duration_minutes, 0);
  const weeklyFlowHours = Math.round((weeklyFlowMinutes / 60) * 10) / 10;

  // ── Recommendation ──
  let recommendation: string;

  if (weeklyFlowHours < 2) {
    recommendation =
      'Your flow time is below 2 hours this week. Protect a 90-minute block tomorrow — the ultradian rhythm says your best work comes in 90-minute waves. Even one deep session changes everything.';
  } else if (avgFlowDuration < 30) {
    recommendation =
      `Your average flow session is ${avgFlowDuration} min. The Law of Rhythm reveals that deep flow needs at least 45 minutes to build momentum. Try silencing notifications and setting a 90-minute timer — one full ultradian cycle.`;
  } else if (avgFlowDuration > 120) {
    recommendation =
      `Your average flow is ${avgFlowDuration} min — impressive stamina. But Rhythm reminds us: every wave has a trough. Schedule 20-minute breaks between 90-minute blocks to sustain depth without burnout.`;
  } else {
    const peakStr = peakFlowHours.slice(0, 2).map(h => `${h}:00`).join(' and ');
    recommendation =
      `Your flow peaks around ${peakStr}. Align your most important work with these hours. The pendulum swings in your favor when you ride the rhythm, not fight it.`;
  }

  return {
    peakFlowHours,
    avgFlowDuration,
    optimalConditions: [...new Set(conditions)],
    flowToInterruptionRatio,
    weeklyFlowHours,
    recommendation,
  };
}

/**
 * Log a flow state record to localStorage.
 * Persists up to MAX_RECORDS (200) entries.
 */
export function logFlowState(record: FlowStateRecord): void {
  const records = loadFlowStates();
  records.push(record);
  saveFlowStates(records);
}

/**
 * Get flow state records since a given date.
 */
export function getFlowStates(since?: Date): FlowStateRecord[] {
  const records = loadFlowStates();
  if (!since) return records;
  const sinceStr = since.toISOString();
  return records.filter(r => r.startedAt >= sinceStr);
}

/**
 * Check if current activity patterns suggest the user is in flow RIGHT NOW.
 * Looks at recent activities within the last 2 hours.
 */
export function detectCurrentFlow(
  recentActivities: ActivityEntry[],
): FlowStateRecord | null {
  const now = Date.now();
  const twoHoursAgo = new Date(now - 120 * 60000).toISOString();
  const recent = recentActivities.filter(a => a.timestamp >= twoHoursAgo);
  if (recent.length < 2) return null;
  return detectFlowState(recent);
}

/**
 * Compute the ultradian rhythm phase for a given time.
 * Returns 'focus' or 'rest' and the minutes until phase change.
 */
export function getUltradianPhase(atTime: Date = new Date()): {
  phase: 'focus' | 'rest';
  minutesLeft: number;
} {
  // Ultradian rhythm: 90 min focus + 20 min rest = 110 min cycle
  const cycleMin = ULTRADIAN_FOCUS_MIN + ULTRADIAN_BREAK_MIN;
  const minutesIntoDay = atTime.getHours() * 60 + atTime.getMinutes();
  const cyclePosition = minutesIntoDay % cycleMin;

  if (cyclePosition < ULTRADIAN_FOCUS_MIN) {
    return { phase: 'focus', minutesLeft: ULTRADIAN_FOCUS_MIN - cyclePosition };
  } else {
    return { phase: 'rest', minutesLeft: cycleMin - cyclePosition };
  }
}

/**
 * Get a Hermetic Rhythm insight about the current ultradian phase.
 */
export function getUltradianInsight(): {
  phase: 'focus' | 'rest';
  minutesLeft: number;
  wisdom: string;
} {
  const { phase, minutesLeft } = getUltradianPhase();
  const wisdom = phase === 'focus'
    ? `You're in a focus phase (${minutesLeft} min left). The Law of Rhythm says: ride the wave while it crests. Protect this time — the pendulum will swing to rest soon enough.`
    : `You're in a rest phase (${minutesLeft} min left). The wise master rests by choice so the pendulum doesn't force it. Refresh now — the next focus wave is coming.`;
  return { phase, minutesLeft, wisdom };
}