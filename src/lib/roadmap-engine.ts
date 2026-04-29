// ============================================================================
// LifeOS Roadmap Engine
// Interactive learning path system inspired by developer-roadmap
// ============================================================================

export type RoadmapNodeType = 'section' | 'topic' | 'subtopic' | 'resource';
export type EdgeType = 'prerequisite' | 'related' | 'next';

export interface RoadmapNode {
  id: string;
  type: RoadmapNodeType;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  children?: string[];
  parentIds?: string[];
  challengeIds?: string[];
  knowledgeCardIds?: string[];
  hermeticPrinciple?: number;
  estimatedHours?: number;
  tags?: string[];
}

export interface RoadmapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: EdgeType;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  hermeticPrinciple?: number;
  nodes: Record<string, RoadmapNode>;
  edges: RoadmapEdge[];
  rootNodeIds: string[];
  totalChallenges: number;
  totalHours: number;
  version: string;
}

export interface PathProgress {
  pathId: string;
  completedNodes: string[];
  currentNodeId: string | null;
  startedAt: string;
  lastActivityAt: string;
  totalXPEarned: number;
  percentComplete: number;
}

// ---------------------------------------------------------------------------
// getAvailableNodes
// ---------------------------------------------------------------------------
// Returns node IDs for nodes whose prerequisites are all completed.
// A node is "available" if all prerequisite edges point to completed nodes
// and the node itself is not yet completed.

export function getAvailableNodes(
  path: LearningPath,
  completedNodes: string[],
): string[] {
  const completedSet = new Set(completedNodes);
  const available: string[] = [];

  for (const [nodeId, node] of Object.entries(path.nodes)) {
    if (completedSet.has(nodeId)) continue;

    if (isNodeUnlocked(path, nodeId, completedNodes)) {
      available.push(nodeId);
    }
  }

  // Sort by: root nodes first, then by order in edges
  const rootSet = new Set(path.rootNodeIds);
  available.sort((a, b) => {
    const aIsRoot = rootSet.has(a) ? 0 : 1;
    const bIsRoot = rootSet.has(b) ? 0 : 1;
    if (aIsRoot !== bIsRoot) return aIsRoot - bIsRoot;
    return a.localeCompare(b);
  });

  return available;
}

// ---------------------------------------------------------------------------
// getPathProgress
// ---------------------------------------------------------------------------
// Returns percentage of nodes completed (0-100).

export function getPathProgress(
  path: LearningPath,
  completedNodes: string[],
): number {
  const total = Object.keys(path.nodes).length;
  if (total === 0) return 0;
  return Math.round((completedNodes.length / total) * 100);
}

// ---------------------------------------------------------------------------
// getNodeDependencies
// ---------------------------------------------------------------------------
// Returns the full prerequisite chain for a node (transitive dependencies).

export function getNodeDependencies(
  path: LearningPath,
  nodeId: string,
): string[] {
  const visited = new Set<string>();
  const stack: string[] = [nodeId];
  const deps: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = path.nodes[current];
    if (!node) continue;

    // Check prerequisite edges pointing TO this node
    const prereqEdges = path.edges.filter(
      (e) => e.target === current && e.type === 'prerequisite',
    );

    for (const edge of prereqEdges) {
      if (!visited.has(edge.source) && edge.source !== nodeId) {
        deps.push(edge.source);
        stack.push(edge.source);
      }
    }

    // Also check parentIds
    if (node.parentIds) {
      for (const parentId of node.parentIds) {
        if (!visited.has(parentId) && parentId !== nodeId) {
          deps.push(parentId);
          stack.push(parentId);
        }
      }
    }
  }

  // Return unique, maintain order
  const unique = [...new Set(deps)];
  return unique;
}

// ---------------------------------------------------------------------------
// isNodeUnlocked
// ---------------------------------------------------------------------------
// A node is unlocked if ALL prerequisite edges point to completed nodes
// and ALL parent nodes are completed.

export function isNodeUnlocked(
  path: LearningPath,
  nodeId: string,
  completedNodes: string[],
): boolean {
  const completedSet = new Set(completedNodes);
  const node = path.nodes[nodeId];

  if (!node) return false;

  // Check prerequisite edges: all sources must be completed
  const prereqEdges = path.edges.filter(
    (e) => e.target === nodeId && e.type === 'prerequisite',
  );

  for (const edge of prereqEdges) {
    if (!completedSet.has(edge.source)) {
      return false;
    }
  }

  // Check parentIds: all parents must be completed
  if (node.parentIds) {
    for (const parentId of node.parentIds) {
      if (!completedSet.has(parentId)) {
        return false;
      }
    }
  }

  // Root nodes are always unlocked
  if (path.rootNodeIds.includes(nodeId) && prereqEdges.length === 0) {
    return true;
  }

  // If no prerequisites/parents at all, it's unlocked
  if (prereqEdges.length === 0 && (!node.parentIds || node.parentIds.length === 0)) {
    return true;
  }

  return true;
}

// ---------------------------------------------------------------------------
// getEstimatedHoursRemaining
// ---------------------------------------------------------------------------
// Calculates remaining estimated hours based on incomplete nodes.

export function getEstimatedHoursRemaining(
  path: LearningPath,
  completedNodes: string[],
): number {
  const completedSet = new Set(completedNodes);
  let hours = 0;

  for (const [nodeId, node] of Object.entries(path.nodes)) {
    if (!completedSet.has(nodeId)) {
      hours += node.estimatedHours ?? 1; // default 1 hour per node
    }
  }

  return hours;
}

// ---------------------------------------------------------------------------
// serializePath
// ---------------------------------------------------------------------------

export function serializePath(path: LearningPath): string {
  return JSON.stringify(path, null, 2);
}

// ---------------------------------------------------------------------------
// deserializePath
// ---------------------------------------------------------------------------

export function deserializePath(json: string): LearningPath {
  const parsed = JSON.parse(json) as LearningPath;

  // Basic validation
  if (!parsed.id || !parsed.slug || !parsed.nodes) {
    throw new Error('Invalid LearningPath JSON: missing required fields');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// getPathStats
// ---------------------------------------------------------------------------
// Returns detailed stats about a learning path.

export function getPathStats(path: LearningPath) {
  const nodes = Object.values(path.nodes);
  const sections = nodes.filter((n) => n.type === 'section');
  const topics = nodes.filter((n) => n.type === 'topic');
  const subtopics = nodes.filter((n) => n.type === 'subtopic');
  const resources = nodes.filter((n) => n.type === 'resource');

  const totalChallenges = nodes.reduce(
    (sum, n) => sum + (n.challengeIds?.length ?? 0),
    0,
  );
  const totalCards = nodes.reduce(
    (sum, n) => sum + (n.knowledgeCardIds?.length ?? 0),
    0,
  );

  return {
    totalNodes: nodes.length,
    sections: sections.length,
    topics: topics.length,
    subtopics: subtopics.length,
    resources: resources.length,
    totalChallenges,
    totalCards,
    totalEdges: path.edges.length,
    totalEstimatedHours: nodes.reduce(
      (sum, n) => sum + (n.estimatedHours ?? 1),
      0,
    ),
  };
}

// ---------------------------------------------------------------------------
// getNodeChildren
// ---------------------------------------------------------------------------
// Returns direct children node objects of a given node.

export function getNodeChildren(
  path: LearningPath,
  nodeId: string,
): RoadmapNode[] {
  const node = path.nodes[nodeId];
  if (!node || !node.children) return [];

  return node.children
    .map((cid) => path.nodes[cid])
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// createPathProgress
// ---------------------------------------------------------------------------
// Creates a new PathProgress object for starting a path.

export function createPathProgress(pathId: string): PathProgress {
  return {
    pathId,
    completedNodes: [],
    currentNodeId: null,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    totalXPEarned: 0,
    percentComplete: 0,
  };
}

// ---------------------------------------------------------------------------
// updatePathProgress
// ---------------------------------------------------------------------------
// Updates path progress after completing a node.

export function updatePathProgress(
  progress: PathProgress,
  path: LearningPath,
  completedNodeId: string,
  xpEarned: number,
): PathProgress {
  const completed = [...progress.completedNodes];
  if (!completed.includes(completedNodeId)) {
    completed.push(completedNodeId);
  }

  const percent = getPathProgress(path, completed);

  // Find next available node
  const available = getAvailableNodes(path, completed);
  const nextNodeId = available.length > 0 ? available[0] : null;

  return {
    ...progress,
    completedNodes: completed,
    currentNodeId: nextNodeId,
    lastActivityAt: new Date().toISOString(),
    totalXPEarned: progress.totalXPEarned + xpEarned,
    percentComplete: percent,
  };
}

// ---------------------------------------------------------------------------
// getNodesByTag
// ---------------------------------------------------------------------------
// Returns all nodes matching a given tag.

export function getNodesByTag(
  path: LearningPath,
  tag: string,
): RoadmapNode[] {
  return Object.values(path.nodes).filter(
    (n) => n.tags?.includes(tag),
  );
}

// ---------------------------------------------------------------------------
// getNodesByHermeticPrinciple
// ---------------------------------------------------------------------------

export function getNodesByHermeticPrinciple(
  path: LearningPath,
  principle: number,
): RoadmapNode[] {
  return Object.values(path.nodes).filter(
    (n) => n.hermeticPrinciple === principle,
  );
}

// ---------------------------------------------------------------------------
// getTopLevelNodes
// ---------------------------------------------------------------------------
// Returns the root/entry-point nodes of a path.

export function getTopLevelNodes(path: LearningPath): RoadmapNode[] {
  return path.rootNodeIds
    .map((id) => path.nodes[id])
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// getFullNodeOrder
// ---------------------------------------------------------------------------
// Returns a topologically sorted list of all node IDs.
// Useful for rendering a path linearly.

export function getFullNodeOrder(path: LearningPath): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    order.push(nodeId);

    const node = path.nodes[nodeId];
    if (node?.children) {
      for (const childId of node.children) {
        dfs(childId);
      }
    }

    // Also follow "next" edges
    const nextEdges = path.edges.filter(
      (e) => e.source === nodeId && e.type === 'next',
    );
    for (const edge of nextEdges) {
      if (!visited.has(edge.target)) {
        dfs(edge.target);
      }
    }
  }

  for (const rootId of path.rootNodeIds) {
    dfs(rootId);
  }

  // Add any remaining unvisited nodes
  for (const nodeId of Object.keys(path.nodes)) {
    if (!visited.has(nodeId)) {
      order.push(nodeId);
    }
  }

  return order;
}