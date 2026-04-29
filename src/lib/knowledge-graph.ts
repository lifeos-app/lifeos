/**
 * knowledge-graph.ts — Knowledge Graph Engine for LifeOS
 *
 * A local-first knowledge graph that connects user data across domains
 * (habits, goals, health, finances, journal) into a queryable graph structure.
 * Enables cross-domain insights like "when I exercise, my sleep improves".
 *
 * All data sourced from Zustand stores + local-db. No direct Supabase calls.
 * localStorage cache with 15-min TTL for performance.
 */

import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useJournalStore } from '../stores/useJournalStore';
import { localGetAll } from '../lib/local-db';
import { logger } from '../utils/logger';

// ── Node & Edge Types ────────────────────────────────────────────

export type NodeType =
  | 'HABIT'
  | 'GOAL'
  | 'HEALTH_METRIC'
  | 'FINANCE_EVENT'
  | 'JOURNAL_ENTRY'
  | 'CATEGORY'
  | 'TAG'
  | 'TIME_PERIOD';

export type EdgeType =
  | 'INFLUENCES'
  | 'CORRELATES_WITH'
  | 'BELONGS_TO'
  | 'TAGGED_WITH'
  | 'OCCURS_DURING'
  | 'DEPENDS_ON';

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: EdgeType;
  strength: number; // 0-1
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  builtAt: number;
}

export interface QueryOptions {
  type?: NodeType;
  types?: NodeType[];
  tags?: string[];
  timeFrom?: string;
  timeTo?: string;
  connectedTo?: string; // node ID — only return nodes connected to this one
  labelContains?: string;
  limit?: number;
}

interface VizNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
}

interface VizEdge {
  source: string;
  target: string;
  type: EdgeType;
  strength: number;
}

// ── Constants ─────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, string> = {
  HABIT: '#00D4FF',
  GOAL: '#FFD700',
  HEALTH_METRIC: '#39FF14',
  FINANCE_EVENT: '#FF6B35',
  JOURNAL_ENTRY: '#A855F7',
  CATEGORY: '#FF69B4',
  TAG: '#888',
  TIME_PERIOD: '#5B9BD5',
};

const CACHE_KEY = 'lifeos_knowledge_graph';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEBOUNCE_MS = 5000; // 5 seconds

// ── KnowledgeGraph Class ─────────────────────────────────────────

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // nodeId -> Set of connected nodeIds
  private rebuildTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeningStores: (() => void)[] = [];

  constructor() {
    this.loadFromCache();
  }

  // ── Node Operations ──

  addNode(node: KnowledgeNode): KnowledgeNode {
    const existing = this.nodes.get(node.id);
    if (existing) {
      // Merge data: new data overwrites old data
      this.nodes.set(node.id, {
        ...existing,
        ...node,
        data: { ...existing.data, ...node.data },
        timestamp: node.timestamp || existing.timestamp,
      });
    } else {
      this.nodes.set(node.id, node);
    }
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
    return this.nodes.get(node.id)!;
  }

  // ── Edge Operations ──

  addEdge(edge: KnowledgeEdge): KnowledgeEdge {
    const key = `${edge.source}->${edge.target}->${edge.type}`;
    this.edges.set(key, edge);

    // Maintain adjacency
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    if (!this.adjacency.has(edge.target)) {
      this.adjacency.set(edge.target, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);
    this.adjacency.get(edge.target)!.add(edge.source);

    return edge;
  }

  // ── Query ──

  query(options: QueryOptions = {}): KnowledgeNode[] {
    let results = Array.from(this.nodes.values());

    if (options.type) {
      results = results.filter(n => n.type === options.type);
    }

    if (options.types && options.types.length > 0) {
      const typeSet = new Set(options.types);
      results = results.filter(n => typeSet.has(n.type));
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(n => {
        const nodeTags = n.data?.tags;
        if (Array.isArray(nodeTags)) {
          return options.tags!.some(t => nodeTags.includes(t));
        }
        return false;
      });
    }

    if (options.timeFrom) {
      results = results.filter(n => n.timestamp >= options.timeFrom!);
    }

    if (options.timeTo) {
      results = results.filter(n => n.timestamp <= options.timeTo!);
    }

    if (options.labelContains) {
      const q = options.labelContains.toLowerCase();
      results = results.filter(n => n.label.toLowerCase().includes(q));
    }

    if (options.connectedTo) {
      const neighbors = this.adjacency.get(options.connectedTo);
      if (neighbors) {
        const neighborSet = neighbors;
        results = results.filter(n => neighborSet.has(n.id));
      } else {
        results = [];
      }
    }

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  // ── Neighbors ──

  getNeighbors(nodeId: string): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const neighborIds = this.adjacency.get(nodeId);
    if (!neighborIds) return { nodes: [], edges: [] };

    const nodes: KnowledgeNode[] = [];
    for (const id of neighborIds) {
      const node = this.nodes.get(id);
      if (node) nodes.push(node);
    }

    const edges: KnowledgeEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        edges.push(edge);
      }
    }

    return { nodes, edges };
  }

  // ── Shortest Path (BFS) ──

  getPath(fromId: string, toId: string): KnowledgeNode[] {
    if (fromId === toId) {
      const node = this.nodes.get(fromId);
      return node ? [node] : [];
    }

    const visited = new Set<string>();
    const queue: string[][] = [[fromId]];
    visited.add(fromId);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      const neighbors = this.adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (neighbor === toId) {
          const fullPath = [...path, neighbor];
          return fullPath
            .map(id => this.nodes.get(id))
            .filter((n): n is KnowledgeNode => n !== undefined);
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return []; // No path found
  }

  // ── Subgraph ──

  getSubgraph(centerId: string, depth: number): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const visited = new Set<string>();
    const frontier = [centerId];

    for (let d = 0; d <= depth; d++) {
      const nextFrontier: string[] = [];
      for (const id of frontier) {
        if (visited.has(id)) continue;
        visited.add(id);

        const neighbors = this.adjacency.get(id);
        if (neighbors) {
          for (const n of neighbors) {
            if (!visited.has(n)) {
              nextFrontier.push(n);
            }
          }
        }
      }
      frontier.length = 0;
      frontier.push(...nextFrontier);
    }

    const nodes: KnowledgeNode[] = [];
    for (const id of visited) {
      const node = this.nodes.get(id);
      if (node) nodes.push(node);
    }

    const edges: KnowledgeEdge[] = [];
    for (const edge of this.edges.values()) {
      if (visited.has(edge.source) && visited.has(edge.target)) {
        edges.push(edge);
      }
    }

    return { nodes, edges };
  }

  // ── Visualization Format ──

  toVisualization(): { nodes: VizNode[]; edges: VizEdge[] } {
    // Simple force-directed layout
    const nodeList = Array.from(this.nodes.values());
    const nodePositions = this.computeLayout(nodeList);

    const vizNodes: VizNode[] = nodeList.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      color: NODE_COLORS[n.type] || '#888',
      x: nodePositions.get(n.id)?.x ?? 0,
      y: nodePositions.get(n.id)?.y ?? 0,
      data: n.data,
    }));

    const vizEdges: VizEdge[] = Array.from(this.edges.values()).map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      strength: e.strength,
    }));

    return { nodes: vizNodes, edges: vizEdges };
  }

  /** Simple force-directed layout using attraction to center + repulsion between nodes */
  private computeLayout(nodes: KnowledgeNode[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    if (nodes.length === 0) return positions;

    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize positions in a circle
    const radius = Math.min(width, height) * 0.35;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      positions.set(n.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // Group by type for clustering
    const typeGroups = new Map<NodeType, string[]>();
    nodes.forEach(n => {
      const group = typeGroups.get(n.type) || [];
      group.push(n.id);
      typeGroups.set(n.type, group);
    });

    // Type-based cluster centers (arranged in a circle)
    const typeAngles = new Map<NodeType, number>();
    const types = Array.from(typeGroups.keys());
    types.forEach((type, i) => {
      typeAngles.set(type, (2 * Math.PI * i) / types.length - Math.PI / 2);
    });

    // Simulate force-directed layout (50 iterations)
    const attractionStrength = 0.01;
    const repulsionStrength = 5000;
    const typeClusterStrength = 0.05;
    const damping = 0.9;

    const velocities = new Map<string, { vx: number; vy: number }>();
    nodes.forEach(n => velocities.set(n.id, { vx: 0, vy: 0 }));

    for (let iter = 0; iter < 50; iter++) {
      // Type cluster attraction — pull nodes toward their type cluster center
      for (const [type, ids] of typeGroups) {
        const angle = typeAngles.get(type) || 0;
        const clusterX = centerX + radius * 0.6 * Math.cos(angle);
        const clusterY = centerY + radius * 0.6 * Math.sin(angle);

        for (const id of ids) {
          const pos = positions.get(id)!;
          const vel = velocities.get(id)!;
          vel.vx += (clusterX - pos.x) * typeClusterStrength;
          vel.vy += (clusterY - pos.y) * typeClusterStrength;
        }
      }

      // Center attraction
      for (const n of nodes) {
        const pos = positions.get(n.id)!;
        const vel = velocities.get(n.id)!;
        vel.vx += (centerX - pos.x) * attractionStrength;
        vel.vy += (centerY - pos.y) * attractionStrength;
      }

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = positions.get(nodes[i].id)!;
          const b = positions.get(nodes[j].id)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = Math.max(dx * dx + dy * dy, 100); // min distance squared
          const force = repulsionStrength / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          velocities.get(nodes[i].id)!.vx += fx;
          velocities.get(nodes[i].id)!.vy += fy;
          velocities.get(nodes[j].id)!.vx -= fx;
          velocities.get(nodes[j].id)!.vy -= fy;
        }
      }

      // Edge attraction — connected nodes attract each other
      for (const edge of this.edges.values()) {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);
        if (!sourcePos || !targetPos) continue;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;

        const attractionForce = 0.03 * edge.strength;
        velocities.get(edge.source)!.vx += dx * attractionForce;
        velocities.get(edge.source)!.vy += dy * attractionForce;
        velocities.get(edge.target)!.vx -= dx * attractionForce;
        velocities.get(edge.target)!.vy -= dy * attractionForce;
      }

      // Apply velocities with damping
      for (const n of nodes) {
        const pos = positions.get(n.id)!;
        const vel = velocities.get(n.id)!;
        vel.vx *= damping;
        vel.vy *= damping;
        pos.x += vel.vx;
        pos.y += vel.vy;

        // Keep within bounds
        pos.x = Math.max(40, Math.min(width - 40, pos.x));
        pos.y = Math.max(40, Math.min(height - 40, pos.y));
      }
    }

    return positions;
  }

  // ── Build from Stores ──

  async fromStores(): Promise<void> {
    logger.info('[knowledge-graph] Building graph from stores...');
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();

    try {
      // Fetch data from stores (they read from local-db)
      const habitsState = useHabitsStore.getState();
      const healthState = useHealthStore.getState();
      const financeState = useFinanceStore.getState();
      const goalsState = useGoalsStore.getState();
      const journalState = useJournalStore.getState();

      // Ensure stores are loaded
      if (habitsState.habits.length === 0 && !habitsState.loading) {
        await habitsState.fetchAll({ skipSync: true });
      }
      if (financeState.transactions.length === 0 && !financeState.loading) {
        await financeState.fetchAll({ skipSync: true });
      }
      if (goalsState.goals.length === 0 && !goalsState.loading) {
        await goalsState.fetchAll({ skipSync: true });
      }
      if (journalState.entries.length === 0 && !journalState.loading) {
        await journalState.fetchRecent(100, { skipSync: true });
      }

      // Load health metrics from local-db directly for historical data
      const healthMetrics = await localGetAll<Record<string, unknown>>('health_metrics');

      // ── Add Habit Nodes ──

      for (const habit of habitsState.habits) {
        this.addNode({
          id: `habit:${habit.id}`,
          type: 'HABIT',
          label: habit.title || 'Unnamed Habit',
          data: {
            streak: habit.streak_current,
            bestStreak: habit.streak_best,
            frequency: habit.frequency,
            category: habit.category,
            timeOfDay: habit.time_of_day,
            targetCount: habit.target_count,
          },
          timestamp: habit.created_at || new Date().toISOString(),
        });
      }

      // ── Add Habit Category Nodes & Edges ──
      const habitCategories = new Set<string>();
      for (const habit of habitsState.habits) {
        if (habit.category) {
          habitCategories.add(habit.category);
        }
      }
      for (const cat of habitCategories) {
        this.addNode({
          id: `category:habit:${cat}`,
          type: 'CATEGORY',
          label: cat,
          data: { domain: 'habits' },
          timestamp: new Date().toISOString(),
        });
      }
      for (const habit of habitsState.habits) {
        if (habit.category) {
          this.addEdge({
            source: `habit:${habit.id}`,
            target: `category:habit:${habit.category}`,
            type: 'BELONGS_TO',
            strength: 0.8,
            metadata: { relation: 'habit-category' },
          });
        }
      }

      // ── Add Habit → Goal Edges ──
      for (const habit of habitsState.habits) {
        if (habit.goal_id) {
          this.addEdge({
            source: `habit:${habit.id}`,
            target: `goal:${habit.goal_id}`,
            type: 'BELONGS_TO',
            strength: 0.9,
          });
        }
      }

      // ── Add Habit Co-occurrence Edges (CORRELATES_WITH) ──
      // Habits done on the same day are correlated
      const habitDays = new Map<string, Set<string>>(); // habitId -> Set of dates
      for (const log of habitsState.logs) {
        if (!habitDays.has(log.habit_id)) {
          habitDays.set(log.habit_id, new Set());
        }
        habitDays.get(log.habit_id)!.add(log.date);
      }

      const habitIds = Array.from(habitDays.keys());
      for (let i = 0; i < habitIds.length; i++) {
        for (let j = i + 1; j < habitIds.length; j++) {
          const a = habitDays.get(habitIds[i])!;
          const b = habitDays.get(habitIds[j])!;
          const intersection = new Set([...a].filter(d => b.has(d)));
          const minDays = Math.min(a.size, b.size);
          if (minDays > 0 && intersection.size > 0) {
            const strength = Math.min(intersection.size / minDays, 1);
            if (strength > 0.3) {
              this.addEdge({
                source: `habit:${habitIds[i]}`,
                target: `habit:${habitIds[j]}`,
                type: 'CORRELATES_WITH',
                strength: Math.round(strength * 100) / 100,
                metadata: { coDays: intersection.size, relation: 'same-day-completion' },
              });
            }
          }
        }
      }

      // ── Add Goal Nodes ──
      for (const goal of goalsState.goals) {
        this.addNode({
          id: `goal:${goal.id}`,
          type: 'GOAL',
          label: goal.title || 'Unnamed Goal',
          data: {
            status: goal.status,
            domain: goal.domain,
            category: goal.category,
            progress: goal.progress,
            targetDate: goal.target_date,
            parentGoalId: goal.parent_goal_id,
          },
          timestamp: goal.created_at || new Date().toISOString(),
        });

        // Goal hierarchy edges
        if (goal.parent_goal_id) {
          this.addEdge({
            source: `goal:${goal.id}`,
            target: `goal:${goal.parent_goal_id}`,
            type: 'DEPENDS_ON',
            strength: 0.9,
            metadata: { relation: 'sub-goal' },
          });
        }
      }

      // ── Add Goal → Habit INFLUENCES edges ──
      // Goals influence the habits that belong to them
      for (const habit of habitsState.habits) {
        if (habit.goal_id) {
          this.addEdge({
            source: `goal:${habit.goal_id}`,
            target: `habit:${habit.id}`,
            type: 'INFLUENCES',
            strength: 0.7,
          });
        }
      }

      // ── Add Health Metric Nodes ──
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

      const recentMetrics = healthMetrics
        .filter((m: any) => m.date && m.date >= thirtyStr && !m.is_deleted)
        .sort((a: any, b: any) => b.date.localeCompare(a.date))
        .slice(0, 30);

      for (const metric of recentMetrics) {
        const m = metric as any;
        this.addNode({
          id: `health:${m.id}`,
          type: 'HEALTH_METRIC',
          label: `Health: ${m.date}`,
          data: {
            date: m.date,
            mood: m.mood_score,
            energy: m.energy_score,
            stress: m.stress_score,
            sleepHours: m.sleep_hours,
            sleepQuality: m.sleep_quality,
            exerciseMinutes: m.exercise_minutes,
            waterGlasses: m.water_glasses,
          },
          timestamp: m.created_at || m.date,
        });

        // Link health metric date to time period
        this.addNode({
          id: `period:${m.date}`,
          type: 'TIME_PERIOD',
          label: m.date,
          data: { date: m.date },
          timestamp: m.date,
        });
        this.addEdge({
          source: `health:${m.id}`,
          target: `period:${m.date}`,
          type: 'OCCURS_DURING',
          strength: 1.0,
        });
      }

      // ── Add Health → Habit CORRELATES_WITH edges ──
      // Exercise habits correlate with health metrics on the same day
      const exerciseHabitIds = habitsState.habits
        .filter(h => {
          const title = (h.title || '').toLowerCase();
          return title.includes('exercise') || title.includes('workout') ||
            title.includes('run') || title.includes('gym') || title.includes('walk') ||
            title.includes('yoga') || title.includes('stretch');
        })
        .map(h => h.id);

      for (const metric of recentMetrics) {
        const m = metric as any;
        if (m.sleep_hours && m.sleep_hours > 0) {
          // Sleep correlations with previous day's exercise
          const prevDate = new Date(m.date);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevStr = prevDate.toISOString().split('T')[0];

          for (const habitId of exerciseHabitIds) {
            const logsOnPrevDay = habitsState.logs.filter(
              l => l.habit_id === habitId && l.date === prevStr
            );
            if (logsOnPrevDay.length > 0) {
              this.addEdge({
                source: `habit:${habitId}`,
                target: `health:${m.id}`,
                type: 'INFLUENCES',
                strength: 0.6,
                metadata: { relation: 'exercise-sleep', sleepHours: m.sleep_hours },
              });
            }
          }
        }
      }

      // ── Add Finance Event Nodes ──
      const recentTransactions = financeState.transactions
        .filter(t => t.date >= thirtyStr)
        .slice(0, 50);

      for (const tx of recentTransactions) {
        this.addNode({
          id: `finance:${tx.id}`,
          type: 'FINANCE_EVENT',
          label: `${tx.type === 'income' ? 'Income' : 'Expense'}: ${tx.title || tx.type} ($${tx.amount})`,
          data: {
            amount: tx.amount,
            type: tx.type,
            date: tx.date,
            category: tx.category_id,
            recurring: tx.recurring,
          },
          timestamp: tx.created_at || tx.date,
        });

        // Finance events occur during time periods
        this.addNode({
          id: `period:${tx.date}`,
          type: 'TIME_PERIOD',
          label: tx.date,
          data: { date: tx.date },
          timestamp: tx.date,
        });
        this.addEdge({
          source: `finance:${tx.id}`,
          target: `period:${tx.date}`,
          type: 'OCCURS_DURING',
          strength: 1.0,
        });
      }

      // ── Add Finance Category Nodes ──
      for (const cat of financeState.categories) {
        this.addNode({
          id: `category:finance:${cat.id}`,
          type: 'CATEGORY',
          label: cat.name || 'Uncategorized',
          data: { domain: 'finance', sort: cat.sort_order },
          timestamp: new Date().toISOString(),
        });
      }

      // ── Finance → Category edges ──
      for (const tx of recentTransactions) {
        if (tx.category_id) {
          this.addEdge({
            source: `finance:${tx.id}`,
            target: `category:finance:${tx.category_id}`,
            type: 'BELONGS_TO',
            strength: 0.9,
          });
        }
      }

      // ── Finance → Goal INFLUENCES edges ──
      // Financial goals are influenced by income/expense patterns
      const financialGoals = goalsState.goals.filter(g =>
        g.domain === 'finance' || g.financial_type || g.category === 'financial'
      );
      for (const tx of recentTransactions) {
        for (const goal of financialGoals) {
          this.addEdge({
            source: `finance:${tx.id}`,
            target: `goal:${goal.id}`,
            type: 'INFLUENCES',
            strength: 0.3,
            metadata: { relation: 'financial-goal-progress' },
          });
        }
      }

      // ── Add Journal Entry Nodes ──
      for (const entry of journalState.entries) {
        const tags = Array.isArray(entry.tags) ? entry.tags :
          (typeof entry.tags === 'string' ? (entry.tags as string).split(',').map(t => t.trim()).filter(Boolean) : []);

        this.addNode({
          id: `journal:${entry.id}`,
          type: 'JOURNAL_ENTRY',
          label: entry.title || `Journal: ${entry.date}`,
          data: {
            date: entry.date,
            mood: entry.mood,
            energy: entry.energy,
            tags,
            contentPreview: (entry.content || '').slice(0, 200),
          },
          timestamp: entry.created_at || entry.date,
        });

        // Journal TAG nodes
        for (const tag of tags) {
          const tagId = `tag:${tag.toLowerCase().replace(/\s+/g, '-')}`;
          this.addNode({
            id: tagId,
            type: 'TAG',
            label: tag,
            data: { raw: tag },
            timestamp: new Date().toISOString(),
          });
          this.addEdge({
            source: `journal:${entry.id}`,
            target: tagId,
            type: 'TAGGED_WITH',
            strength: 1.0,
          });
        }

        // Journal OCCURS_DURING time period
        this.addNode({
          id: `period:${entry.date}`,
          type: 'TIME_PERIOD',
          label: entry.date,
          data: { date: entry.date },
          timestamp: entry.date,
        });
        this.addEdge({
          source: `journal:${entry.id}`,
          target: `period:${entry.date}`,
          type: 'OCCURS_DURING',
          strength: 1.0,
        });

        // Journal mood → health correlation
        if (entry.mood && entry.mood > 0) {
          const matchingHealth = recentMetrics.find((m: any) => m.date === entry.date);
          if (matchingHealth) {
            this.addEdge({
              source: `journal:${entry.id}`,
              target: `health:${(matchingHealth as any).id}`,
              type: 'CORRELATES_WITH',
              strength: 0.7,
              metadata: { relation: 'mood-health-same-day' },
            });
          }
        }
      }

      // ── Cross-domain: Habit → Journal mood correlations ──
      // If a habit is done on the same day as a journal entry with mood, create an edge
      for (const habit of habitsState.habits) {
        const habitLogDates = new Set(
          habitsState.logs
            .filter(l => l.habit_id === habit.id)
            .map(l => l.date)
        );

        for (const entry of journalState.entries) {
          if (habitLogDates.has(entry.date)) {
            this.addEdge({
              source: `habit:${habit.id}`,
              target: `journal:${entry.id}`,
              type: 'CORRELATES_WITH',
              strength: 0.4,
              metadata: { relation: 'same-day-activity' },
            });
          }
        }
      }

      // ── Cross-domain: Habit → Health on same day ──
      for (const habit of habitsState.habits) {
        const habitLogDates = new Set(
          habitsState.logs.filter(l => l.habit_id === habit.id).map(l => l.date)
        );
        for (const metric of recentMetrics) {
          const m = metric as any;
          if (habitLogDates.has(m.date)) {
            this.addEdge({
              source: `habit:${habit.id}`,
              target: `health:${m.id}`,
              type: 'CORRELATES_WITH',
              strength: 0.5,
              metadata: { relation: 'same-day-activity' },
            });
          }
        }
      }

      // ── Cross-domain: Finance → Journal mood ──
      // Large expenses correlate with mood on same day
      const avgExpense = recentTransactions.length > 0
        ? recentTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) /
          Math.max(recentTransactions.filter(t => t.type === 'expense').length, 1)
        : 0;

      for (const tx of recentTransactions) {
        if (tx.type === 'expense' && avgExpense > 0 && tx.amount > avgExpense * 1.5) {
          const matchingEntry = journalState.entries.find(e => e.date === tx.date);
          if (matchingEntry) {
            this.addEdge({
              source: `finance:${tx.id}`,
              target: `journal:${matchingEntry.id}`,
              type: 'INFLUENCES',
              strength: 0.5,
              metadata: { relation: 'spending-mood', amount: tx.amount, avg: avgExpense },
            });
          }
        }
      }

    } catch (err) {
      logger.error('[knowledge-graph] Error building graph:', err);
    }

    // Cache the result
    this.saveToCache();
    logger.info(`[knowledge-graph] Built graph: ${this.nodes.size} nodes, ${this.edges.size} edges`);
  }

  // ── Cache ──

  private loadFromCache(): boolean {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;

      const data: KnowledgeGraphData = JSON.parse(raw);
      const age = Date.now() - data.builtAt;
      if (age > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return false;
      }

      this.nodes.clear();
      this.edges.clear();
      this.adjacency.clear();

      for (const node of data.nodes) {
        this.nodes.set(node.id, node);
      }
      for (const edge of data.edges) {
        const key = `${edge.source}->${edge.target}->${edge.type}`;
        this.edges.set(key, edge);

        if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Set());
        if (!this.adjacency.has(edge.target)) this.adjacency.set(edge.target, new Set());
        this.adjacency.get(edge.source)!.add(edge.target);
        this.adjacency.get(edge.target)!.add(edge.source);
      }

      logger.info(`[knowledge-graph] Loaded from cache: ${this.nodes.size} nodes, ${this.edges.size} edges`);
      return true;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }
  }

  private saveToCache(): void {
    try {
      const data: KnowledgeGraphData = {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
        builtAt: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      logger.warn('[knowledge-graph] Failed to save cache:', err);
    }
  }

  // ── Auto-Sync ──

  /** Subscribe to store changes and rebuild graph (debounced 5s) */
  startAutoSync(): () => void {
    const scheduleRebuild = () => {
      if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);
      this.rebuildTimeout = setTimeout(() => {
        this.fromStores();
      }, DEBOUNCE_MS);
    };

    // Subscribe to Zustand stores
    const unsubHabits = useHabitsStore.subscribe(scheduleRebuild);
    const unsubHealth = useHealthStore.subscribe(scheduleRebuild);
    const unsubFinance = useFinanceStore.subscribe(scheduleRebuild);
    const unsubGoals = useGoalsStore.subscribe(scheduleRebuild);
    const unsubJournal = useJournalStore.subscribe(scheduleRebuild);

    this.listeningStores = [unsubHabits, unsubHealth, unsubFinance, unsubGoals, unsubJournal];

    // Return cleanup function
    return () => {
      this.listeningStores.forEach(unsub => unsub());
      this.listeningStores = [];
      if (this.rebuildTimeout) {
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = null;
      }
    };
  }

  /** Stop auto-sync */
  stopAutoSync(): void {
    this.listeningStores.forEach(unsub => unsub());
    this.listeningStores = [];
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
      this.rebuildTimeout = null;
    }
  }

  // ── Stats ──

  getStats(): { nodeCount: number; edgeCount: number; nodeTypes: Record<NodeType, number>; edgeTypes: Record<EdgeType, number> } {
    const nodeTypes: Record<string, number> = {};
    const edgeTypes: Record<string, number> = {};

    for (const node of this.nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }
    for (const edge of this.edges.values()) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodeTypes: nodeTypes as Record<NodeType, number>,
      edgeTypes: edgeTypes as Record<EdgeType, number>,
    };
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): KnowledgeEdge[] {
    return Array.from(this.edges.values());
  }

  clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
  }
}

// ── Singleton ─────────────────────────────────────────────────────

let _instance: KnowledgeGraph | null = null;

export function getKnowledgeGraph(): KnowledgeGraph {
  if (!_instance) {
    _instance = new KnowledgeGraph();
  }
  return _instance;
}

export { NODE_COLORS };