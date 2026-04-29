/**
 * KnowledgeGraph page — route-level component
 *
 * Thin wrapper that lazy-loads KnowledgeGraphView.
 */

import { KnowledgeGraphView } from '../components/KnowledgeGraphView';

export function KnowledgeGraph() {
  return <KnowledgeGraphView />;
}