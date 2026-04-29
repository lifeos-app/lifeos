/**
 * LearningPathView — interactive learning path visualization.
 * Inspired by developer-roadmap's interactive node graph.
 */
import { useState, useMemo } from 'react';
import { ArrowLeft, Lock, CheckCircle2, Circle, ChevronRight, Clock, BookOpen, Zap } from 'lucide-react';
import type { LearningPath, RoadmapNode } from '../../lib/roadmap-engine';
import { isNodeUnlocked, getPathProgress, getNodesByHermeticPrinciple } from '../../lib/roadmap-engine';
import { LEARNING_PATHS } from '../../data/learning-paths';

const PRINCIPLE_COLORS = ['#A855F7','#06B6D4','#F97316','#EC4899','#39FF14','#FACC15','#D4AF37'];
const PRINCIPLE_NAMES = ['Mentalism','Correspondence','Vibration','Polarity','Rhythm','Cause & Effect','Gender'];

const TYPE_ICONS: Record<string, string> = {
  section: '📂',
  topic: '📚',
  subtopic: '💡',
  resource: '🔗',
};

interface LearningPathViewProps {
  path: LearningPath;
  completedNodes: string[];
  onNodeSelect: (nodeId: string) => void;
  onBack: () => void;
}

export function LearningPathView({ path, completedNodes, onNodeSelect, onBack }: LearningPathViewProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const progress = getPathProgress(path, completedNodes);
  const principleColor = path.hermeticPrinciple != null ? PRINCIPLE_COLORS[path.hermeticPrinciple] : '#00D4FF';
  const principleName = path.hermeticPrinciple != null ? PRINCIPLE_NAMES[path.hermeticPrinciple] : null;

  const nodes = useMemo(() => {
    return Object.values(path.nodes).sort((a, b) => {
      // Section nodes first, then topics, then subtopics
      const typeOrder = { section: 0, topic: 1, subtopic: 2, resource: 3 };
      return (typeOrder[a.type] ?? 4) - (typeOrder[b.type] ?? 4);
    });
  }, [path.nodes]);

  const getNodeStatus = (nodeId: string): 'completed' | 'available' | 'locked' => {
    if (completedNodes.includes(nodeId)) return 'completed';
    if (isNodeUnlocked(path, nodeId, completedNodes)) return 'available';
    return 'locked';
  };

  const getTotalHours = useMemo(() => {
    return Object.values(path.nodes).reduce((sum, n) => sum + (n.estimatedHours || 0), 0);
  }, [path.nodes]);

  const getCompletedHours = useMemo(() => {
    return completedNodes.reduce((sum, id) => {
      const node = path.nodes[id];
      return sum + (node?.estimatedHours || 0);
    }, 0);
  }, [completedNodes, path.nodes]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1A3A5C]" style={{ background: `linear-gradient(135deg, ${principleColor}10, transparent)` }}>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="text-[#8BA4BE] hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="text-2xl">{path.icon}</div>
          <div>
            <h2 className="text-lg font-bold text-white">{path.title}</h2>
            {principleName && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${principleColor}20`, color: principleColor, border: `1px solid ${principleColor}40` }}>
                {principleName}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-[#8BA4BE] mb-3">{path.description}</p>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#1A3A5C] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: principleColor }} />
          </div>
          <span className="text-sm font-mono text-[#8BA4BE]">{Math.round(progress)}%</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-[#5A7A9A]">
          <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {completedNodes.length}/{Object.keys(path.nodes).length} nodes</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {getCompletedHours.toFixed(1)}/{getTotalHours.toFixed(1)}h</span>
        </div>
      </div>

      {/* Nodes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {nodes.map((node) => {
          const status = getNodeStatus(node.id);
          const isExpanded = expandedNode === node.id;
          const nodeColor = node.hermeticPrinciple != null ? PRINCIPLE_COLORS[node.hermeticPrinciple] : principleColor;
          
          return (
            <div key={node.id}>
              <button
                onClick={() => {
                  if (status !== 'locked') {
                    setExpandedNode(isExpanded ? null : node.id);
                    onNodeSelect(node.id);
                  }
                }}
                disabled={status === 'locked'}
                className={`w-full text-left p-3 rounded-lg transition-all border ${
                  status === 'completed'
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/30 hover:bg-[#39FF14]/15'
                    : status === 'available'
                    ? 'bg-[#0F2D4A] border-[#1A3A5C] hover:bg-[#0F2D4A]/80 hover:border-[#00D4FF]/40'
                    : 'bg-[#050E1A]/50 border-[#1A3A5C]/30 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle2 size={20} className="text-[#39FF14]" />
                    ) : status === 'locked' ? (
                      <Lock size={20} className="text-[#5A7A9A]" />
                    ) : (
                      <Circle size={20} style={{ color: nodeColor }} className="opacity-60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{TYPE_ICONS[node.type]}</span>
                      <span className={`text-sm font-medium ${status === 'completed' ? 'text-[#39FF14]' : status === 'locked' ? 'text-[#5A7A9A]' : 'text-white'}`}>
                        {node.title}
                      </span>
                    </div>
                    {node.estimatedHours && (
                      <span className="text-xs text-[#5A7A9A] ml-5">{node.estimatedHours}h</span>
                    )}
                  </div>
                  {status === 'available' && (
                    <ChevronRight size={16} className="text-[#5A7A9A]" />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && status !== 'locked' && (
                <div className="ml-8 mt-2 p-3 rounded-lg bg-[#0F2D4A]/50 border border-[#1A3A5C]">
                  {node.description && (
                    <p className="text-sm text-[#8BA4BE] mb-3">{node.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {node.challengeIds && node.challengeIds.length > 0 && (
                      <button
                        onClick={() => onNodeSelect(node.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30 hover:bg-[#00D4FF]/25 transition-colors"
                      >
                        <Zap size={12} /> Start Challenge
                      </button>
                    )}
                    {node.knowledgeCardIds && node.knowledgeCardIds.length > 0 && (
                      <button
                        onClick={() => onNodeSelect(node.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30 hover:bg-[#A855F7]/25 transition-colors"
                      >
                        <BookOpen size={12} /> Study Cards ({node.knowledgeCardIds.length})
                      </button>
                    )}
                  </div>
                  {node.tags && node.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {node.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-[#1A3A5C] text-[#5A7A9A]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LearningPathView;