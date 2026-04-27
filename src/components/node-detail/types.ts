// ── Types for NodeDetail ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GoalRecord = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskRecord = Record<string, any>;

export interface Business {
  id: string;
  name: string;
}

export interface KeyResult {
  text: string;
  done: boolean;
}

export interface Resource {
  name: string;
  cost: number;
  status: string;
}

export interface NodeDetailProps {
  nodeId: string;
  allGoals: GoalRecord[];
  allTasks: TaskRecord[];
  onClose: () => void;
  onNavigate?: (nodeId: string) => void;
  onViewInList?: (nodeId: string) => void;
}