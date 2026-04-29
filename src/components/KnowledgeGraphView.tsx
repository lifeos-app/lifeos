/**
 * KnowledgeGraphView.tsx — Force-directed graph visualization for LifeOS
 *
 * Renders the knowledge graph as an interactive node-link diagram using
 * HTML/CSS (no external viz library). Nodes are absolutely positioned divs
 * with CSS transitions for smooth movement.
 *
 * Dark theme: bg #050E1A, node glow via box-shadow, Lucide icons (Brain).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Brain, RefreshCw, Search, X, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import {
  getKnowledgeGraph,
  NODE_COLORS,
  type KnowledgeNode,
  type KnowledgeEdge,
  type NodeType,
  type EdgeType,
} from '../lib/knowledge-graph';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────

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

type FilterState = Partial<Record<NodeType, boolean>>;

const ALL_NODE_TYPES: NodeType[] = [
  'HABIT', 'GOAL', 'HEALTH_METRIC', 'FINANCE_EVENT',
  'JOURNAL_ENTRY', 'CATEGORY', 'TAG', 'TIME_PERIOD',
];

const EDGE_LABELS: Record<EdgeType, string> = {
  INFLUENCES: 'influences',
  CORRELATES_WITH: 'correlates with',
  BELONGS_TO: 'belongs to',
  TAGGED_WITH: 'tagged with',
  OCCURS_DURING: 'occurs during',
  DEPENDS_ON: 'depends on',
};

// ── Component ────────────────────────────────────────────────────

export function KnowledgeGraphView() {
  const kg = getKnowledgeGraph();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [vizData, setVizData] = useState<{ nodes: VizNode[]; edges: VizEdge[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ edge: VizEdge; x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(() => {
    const f: FilterState = {};
    ALL_NODE_TYPES.forEach(t => f[t] = true);
    return f;
  });
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  // ── Build graph on mount ──

  const buildGraph = useCallback(async () => {
    setLoading(true);
    try {
      await kg.fromStores();
      const data = kg.toVisualization();
      setVizData(data);

      // Initialize positions from visualization
      const positions = new Map<string, { x: number; y: number }>();
      data.nodes.forEach(n => positions.set(n.id, { x: n.x, y: n.y }));
      setNodePositions(positions);
    } catch (err) {
      logger.error('[KnowledgeGraphView] build error:', err);
    } finally {
      setLoading(false);
    }
  }, [kg]);

  useEffect(() => {
    buildGraph();

    // Auto-sync: subscribe to store changes
    const cleanup = kg.startAutoSync();
    return cleanup;
  }, [kg, buildGraph]);

  // ── Filtering ──

  const filteredNodes = useMemo(() => {
    return vizData.nodes.filter(n => filters[n.type] !== false);
  }, [vizData.nodes, filters]);

  const filteredNodeIds = useMemo(() => {
    return new Set(filteredNodes.map(n => n.id));
  }, [filteredNodes]);

  const filteredEdges = useMemo(() => {
    let edges = vizData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchingIds = new Set(
        filteredNodes.filter(n => n.label.toLowerCase().includes(q)).map(n => n.id)
      );
      // Keep edges connected to matching nodes
      edges = edges.filter(e => matchingIds.has(e.source) || matchingIds.has(e.target));
    }

    return edges;
  }, [vizData.edges, filteredNodeIds, filteredNodes, searchQuery]);

  const highlightedNodes = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(
      filteredNodes.filter(n => n.label.toLowerCase().includes(q)).map(n => n.id)
    );
  }, [filteredNodes, searchQuery]);

  // ── Selected node info ──

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const node = vizData.nodes.find(n => n.id === selectedNode);
    if (!node) return null;
    const neighbors = kg.getNeighbors(selectedNode);
    return { node, neighbors };
  }, [selectedNode, vizData.nodes, kg]);

  // ── Force simulation (runs in animation loop) ──

  useEffect(() => {
    if (filteredNodes.length === 0) return;

    const positions = new Map(nodePositions);
    const velocities = new Map<string, { vx: number; vy: number }>();
    filteredNodes.forEach(n => {
      if (!positions.has(n.id)) {
        positions.set(n.id, { x: n.x, y: n.y });
      }
      velocities.set(n.id, { vx: 0, vy: 0 });
    });

    let running = true;
    const width = canvasRef.current?.clientWidth || 800;
    const height = canvasRef.current?.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const attractionStrength = 0.005;
    const repulsionStrength = 3000;
    const damping = 0.85;
    const maxIterations = 100;
    let iteration = 0;

    const tick = () => {
      if (!running || iteration >= maxIterations) return;
      iteration++;

      // Center gravity
      for (const n of filteredNodes) {
        const pos = positions.get(n.id);
        const vel = velocities.get(n.id);
        if (!pos || !vel) continue;
        vel.vx += (centerX - pos.x) * attractionStrength;
        vel.vy += (centerY - pos.y) * attractionStrength;
      }

      // Repulsion
      for (let i = 0; i < filteredNodes.length; i++) {
        for (let j = i + 1; j < filteredNodes.length; j++) {
          const a = positions.get(filteredNodes[i].id);
          const b = positions.get(filteredNodes[j].id);
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = Math.max(dx * dx + dy * dy, 100);
          const force = repulsionStrength / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          velocities.get(filteredNodes[i].id)!.vx += fx;
          velocities.get(filteredNodes[i].id)!.vy += fy;
          velocities.get(filteredNodes[j].id)!.vx -= fx;
          velocities.get(filteredNodes[j].id)!.vy -= fy;
        }
      }

      // Edge attraction
      for (const edge of filteredEdges) {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);
        if (!sourcePos || !targetPos) continue;
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const attractionForce = 0.02 * edge.strength;
        if (positions.has(edge.source) && velocities.has(edge.source)) {
          velocities.get(edge.source)!.vx += dx * attractionForce;
          velocities.get(edge.source)!.vy += dy * attractionForce;
        }
        if (positions.has(edge.target) && velocities.has(edge.target)) {
          velocities.get(edge.target)!.vx -= dx * attractionForce;
          velocities.get(edge.target)!.vy -= dy * attractionForce;
        }
      }

      // Apply
      for (const n of filteredNodes) {
        if (dragging === n.id) continue;
        const pos = positions.get(n.id)!;
        const vel = velocities.get(n.id)!;
        vel.vx *= damping;
        vel.vy *= damping;
        pos.x += vel.vx;
        pos.y += vel.vy;
        pos.x = Math.max(30, Math.min(width - 30, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      }

      if (iteration < maxIterations) {
        setNodePositions(new Map(positions));
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [filteredNodes, filteredEdges, dragging]);

  // ── Drag handlers ──

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = nodePositions.get(nodeId);
    if (!pos) return;
    setDragging(nodeId);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    setSelectedNode(nodeId);
  }, [nodePositions]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setNodePositions(prev => {
        const next = new Map(prev);
        next.set(dragging, { x, y });
        return next;
      });
    };

    const handleUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  // ── Edge hover (SVG) ──

  const getEdgeMidpoint = useCallback((edge: VizEdge): { x: number; y: number } | null => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) return null;
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  }, [nodePositions]);

  // ── Render ──

  const stats = kg.getStats();

  return (
    <div style={{ minHeight: '100vh', background: '#050E1A', color: '#C8D6E5', fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid rgba(0,212,255,0.1)',
        background: 'rgba(5,14,26,0.95)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Brain size={24} color="#00D4FF" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#00D4FF', margin: 0 }}>
              Knowledge Graph
            </h1>
            <p style={{ fontSize: 12, color: '#5A7A9A', margin: 0 }}>
              {stats.nodeCount} nodes, {stats.edgeCount} edges
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => buildGraph()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8,
              color: '#00D4FF', cursor: loading ? 'wait' : 'pointer', fontSize: 13,
              fontFamily: 'inherit',
            }}
            aria-label="Refresh Graph"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh Graph
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', background: 'rgba(5,14,26,0.8)',
        borderBottom: '1px solid rgba(0,212,255,0.05)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flex: 1, maxWidth: 320, padding: '6px 12px',
          background: 'rgba(15,45,74,0.5)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 8,
        }}>
          <Search size={14} color="#5A7A9A" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#C8D6E5', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={14} color="#5A7A9A" />
            </button>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', background: 'rgba(15,45,74,0.5)',
              border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
              color: '#C8D6E5', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            }}
          >
            <Filter size={14} />
            Filter
            <ChevronDown size={12} />
          </button>

          {filterOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: '#0F2D4A', border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 8, padding: 8, zIndex: 40, minWidth: 220,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {ALL_NODE_TYPES.map(type => (
                <label
                  key={type}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                    color: '#C8D6E5', borderRadius: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters[type] !== false}
                    onChange={() => {
                      setFilters(prev => ({ ...prev, [type]: prev[type] === false }));
                    }}
                    style={{ accentColor: NODE_COLORS[type] }}
                  />
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: NODE_COLORS[type],
                    boxShadow: `0 0 6px ${NODE_COLORS[type]}`,
                  }} />
                  {type.replace(/_/g, ' ')}
                  <span style={{ marginLeft: 'auto', color: '#5A7A9A', fontSize: 11 }}>
                    {stats.nodeTypes[type] || 0}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph Area */}
      <div style={{ position: 'relative', height: 'calc(100vh - 160px)' }}>
        {loading && vizData.nodes.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: 12,
          }}>
            <Brain size={48} color="#00D4FF" style={{ animation: 'pulse 2s infinite' }} />
            <p style={{ color: '#5A7A9A', fontSize: 14 }}>Building knowledge graph...</p>
          </div>
        ) : vizData.nodes.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: 12,
          }}>
            <Brain size={48} color="#5A7A9A" />
            <p style={{ color: '#5A7A9A', fontSize: 14 }}>No data yet. Add habits, goals, or journal entries to populate the graph.</p>
          </div>
        ) : (
          <>
            {/* SVG layer for edges */}
            <svg
              style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 1,
              }}
            >
              {filteredEdges.map((edge, i) => {
                const source = nodePositions.get(edge.source);
                const target = nodePositions.get(edge.target);
                if (!source || !target) return null;

                const isHighlighted = selectedNode === edge.source || selectedNode === edge.target;
                const opacity = isHighlighted ? 0.8 : (searchQuery && !highlightedNodes.has(edge.source) && !highlightedNodes.has(edge.target) ? 0.05 : 0.2 * edge.strength);

                return (
                  <g key={i}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={isHighlighted ? '#00D4FF' : '#1A3A5C'}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeOpacity={opacity}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onMouseEnter={(e) => {
                        const mid = getEdgeMidpoint(edge);
                        if (mid) setHoveredEdge({ edge, x: mid.x, y: mid.y });
                      }}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Node layer */}
            <div
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                zIndex: 2,
              }}
              onClick={() => {
                if (!dragging) setSelectedNode(null);
              }}
            >
              {filteredNodes.map(node => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;

                const isSelected = selectedNode === node.id;
                const isSearched = highlightedNodes.has(node.id);
                const isConnectedToSelected = selectedNode
                  ? kg.getNeighbors(selectedNode).nodes.some(n => n.id === node.id)
                  : false;
                const dimmed = searchQuery && !isSearched && !highlightedNodes.has(node.id);
                const isConnected = isSelected || isConnectedToSelected;

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: pos.x - 20,
                      top: pos.y - 20,
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: isConnected ? node.color : `${node.color}33`,
                      border: `2px solid ${isConnected ? node.color : `${node.color}66`}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      transition: dragging === node.id ? 'none' : 'box-shadow 0.3s, background 0.3s, border-color 0.3s',
                      boxShadow: isConnected
                        ? `0 0 12px ${node.color}88, 0 0 24px ${node.color}44`
                        : `0 0 6px ${node.color}33`,
                      opacity: dimmed ? 0.2 : 1,
                      zIndex: isSelected ? 20 : isConnected ? 10 : 1,
                      fontSize: 11,
                      fontWeight: 600,
                      color: isConnected ? '#050E1A' : node.color,
                      userSelect: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={node.label}
                  >
                    {node.label.slice(0, 2).toUpperCase()}
                  </div>
                );
              })}
            </div>

            {/* Node labels — shown only for selected/highlighted nodes */}
            {filteredNodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const isSelected = selectedNode === node.id;
              const isSearched = highlightedNodes.has(node.id);
              const isConnectedToSelected = selectedNode
                ? kg.getNeighbors(selectedNode).nodes.some(n => n.id === node.id)
                : false;
              if (!isSelected && !isSearched && !isConnectedToSelected) return null;

              return (
                <div
                  key={`label-${node.id}`}
                  style={{
                    position: 'absolute',
                    left: pos.x + 24,
                    top: pos.y - 8,
                    fontSize: 11,
                    color: node.color,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    zIndex: 15,
                    pointerEvents: 'none',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {node.label}
                </div>
              );
            })}

            {/* Edge tooltip */}
            {hoveredEdge && (
              <div
                style={{
                  position: 'absolute',
                  left: hoveredEdge.x + 12,
                  top: hoveredEdge.y - 24,
                  background: '#0F2D4A',
                  border: '1px solid rgba(0,212,255,0.3)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  color: '#C8D6E5',
                  zIndex: 30,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                {EDGE_LABELS[hoveredEdge.edge.type]} (strength: {hoveredEdge.edge.strength.toFixed(2)})
              </div>
            )}

            {/* Selected node detail panel */}
            {selectedNodeData && (
              <div
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 16,
                  width: 280,
                  background: '#0F2D4A',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 12,
                  padding: 16,
                  zIndex: 40,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  maxHeight: 'calc(100vh - 200px)',
                  overflowY: 'auto',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: selectedNodeData.node.color,
                      boxShadow: `0 0 8px ${selectedNodeData.node.color}`,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#C8D6E5' }}>
                      {selectedNodeData.node.label}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} color="#5A7A9A" />
                  </button>
                </div>

                <div style={{ fontSize: 11, color: '#5A7A9A', marginBottom: 8 }}>
                  Type: {selectedNodeData.node.type.replace(/_/g, ' ')}
                </div>

                {/* Data preview */}
                <div style={{
                  background: 'rgba(0,212,255,0.05)', borderRadius: 8,
                  padding: 8, marginBottom: 12, fontSize: 11, color: '#8BA4BE',
                }}>
                  {Object.entries(selectedNodeData.node.data).slice(0, 8).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ color: '#5A7A9A' }}>{key}</span>
                      <span style={{ color: '#C8D6E5', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {val === null ? '--' : String(val)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Connected nodes */}
                <div style={{ fontSize: 12, fontWeight: 600, color: '#00D4FF', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChevronRight size={12} />
                  {selectedNodeData.neighbors.nodes.length} connections
                </div>

                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {selectedNodeData.neighbors.edges.slice(0, 20).map((edge, i) => {
                    const otherNodeId = edge.source === selectedNode ? edge.target : edge.source;
                    const otherNode = kg.getNode(otherNodeId);
                    if (!otherNode) return null;

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedNode(otherNodeId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          width: '100%', padding: '4px 6px', marginBottom: 2,
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderRadius: 4, fontSize: 11, textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: NODE_COLORS[otherNode.type],
                          flexShrink: 0,
                        }} />
                        <span style={{ color: '#8BA4BE', flexShrink: 0, minWidth: 50 }}>
                          {EDGE_LABELS[edge.type]}
                        </span>
                        <span style={{ color: '#C8D6E5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {otherNode.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 16px', background: 'rgba(15,45,74,0.9)',
        border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
        fontSize: 10, color: '#5A7A9A', zIndex: 30,
      }}>
        {ALL_NODE_TYPES.filter(t => stats.nodeTypes[t]).map(type => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: NODE_COLORS[type],
              boxShadow: `0 0 4px ${NODE_COLORS[type]}`,
            }} />
            <span>{type.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>

      {/* Spin animation for refresh button */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default KnowledgeGraphView;