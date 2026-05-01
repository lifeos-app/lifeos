// ═══════════════════════════════════════════════════════════
// DashboardJunctionRecommender — AI-powered Junction suggestions
// Asks "What do you want to achieve?" and recommends the best
// Junction (life-improvement game) for your current goals.
// Inspired by VISION-v2 "Junction AI: The Recommender"
// ═══════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass, Dumbbell, Briefcase, Brain, Sparkles, Leaf,
  Code, Utensils, Shield, ChevronRight, X,
} from 'lucide-react';
import './DashboardJunctionRecommender.css';

// ═══ Junction Catalog ═══
// From VISION-v2: "Every Junction is a 'game' you play with your real life as the controller."

interface Junction {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Compass;
  color: string;
  keywords: string[];
  goalDomains: string[];
}

const JUNCTION_CATALOG: Junction[] = [
  {
    id: 'iron-protocol',
    name: 'Iron Protocol',
    tagline: 'Military discipline meets progressive overload',
    icon: Dumbbell,
    color: '#F97316',
    keywords: ['fitness', 'workout', 'gym', 'body', 'strength', 'exercise', 'muscle', 'health'],
    goalDomains: ['health', 'fitness'],
  },
  {
    id: 'the-grind',
    name: 'The Grind',
    tagline: 'Hustle culture but self-aware',
    icon: Briefcase,
    color: '#EAB308',
    keywords: ['business', 'career', 'money', 'revenue', 'income', 'work', 'job', 'startup', 'hustle'],
    goalDomains: ['finance', 'career'],
  },
  {
    id: 'brain-forge',
    name: 'Brain Forge',
    tagline: 'Cyberpunk academy for knowledge seekers',
    icon: Brain,
    color: '#A855F7',
    keywords: ['study', 'learn', 'education', 'exam', 'university', 'skill', 'reading', 'knowledge', 'code'],
    goalDomains: ['education', 'skill'],
  },
  {
    id: 'clean-slate',
    name: 'Clean Slate',
    tagline: 'Marie Kondo meets minimalism',
    icon: Leaf,
    color: '#39FF14',
    keywords: ['declutter', 'organize', 'simplify', 'clean', 'minimal', 'tidy', 'room', 'home'],
    goalDomains: ['lifestyle', 'organization'],
  },
  {
    id: 'stack-overflow',
    name: 'Stack Overflow',
    tagline: 'Dev culture humor meets learn-to-code',
    icon: Code,
    color: '#00D4FF',
    keywords: ['code', 'programming', 'developer', 'software', 'web', 'app', 'javascript', 'react', 'python'],
    goalDomains: ['education', 'technology'],
  },
  {
    id: 'gut-check',
    name: 'Gut Check',
    tagline: 'Food documentary aesthetic meets meal tracking',
    icon: Utensils,
    color: '#F43F5E',
    keywords: ['diet', 'nutrition', 'food', 'meal', 'macro', 'cooking', 'fasting', 'weight'],
    goalDomains: ['health', 'nutrition'],
  },
  {
    id: 'monk-mode',
    name: 'Monk Mode',
    tagline: 'Contemplative practice for the modern world',
    icon: Shield,
    color: '#8B5CF6',
    keywords: ['meditation', 'mindfulness', 'spiritual', 'prayer', 'detox', 'gratitude', 'peace', 'focus'],
    goalDomains: ['spiritual', 'mental'],
  },
];

// ═══ Keywords for goal text matching ═══
function scoreJunction(junction: Junction, goalTexts: string[]): number {
  let score = 0;
  const lower = goalTexts.join(' ').toLowerCase();

  for (const keyword of junction.keywords) {
    if (lower.includes(keyword)) {
      score += 2;
    }
  }

  // Partial matches
  for (const keyword of junction.keywords) {
    const parts = keyword.split(' ');
    for (const part of parts) {
      if (part.length > 3 && lower.includes(part)) {
        score += 1;
      }
    }
  }

  return score;
}

// ═══ Props ═══
interface DashboardJunctionRecommenderProps {
  /** User's current active goals (for matching) */
  goalTexts?: string[];
}

// ═══ Component ═══
export function DashboardJunctionRecommender({ goalTexts = [] }: DashboardJunctionRecommenderProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    if (goalTexts.length === 0) {
      // No goals — show top 3 popular
      return JUNCTION_CATALOG.slice(0, 3);
    }

    const scored = JUNCTION_CATALOG.map(j => ({
      ...j,
      score: scoreJunction(j, goalTexts),
    }));

    // Sort by score, fallback to catalog order
    scored.sort((a, b) => b.score - a.score);

    // Return top 3 with score > 0, or top 3 overall
    const matched = scored.filter(s => s.score > 0).slice(0, 3);
    return matched.length > 0 ? matched : scored.slice(0, 3);
  }, [goalTexts]);

  const handleSelect = useCallback((junctionId: string) => {
    setSelectedId(junctionId === selectedId ? null : junctionId);
  }, [selectedId]);

  const selectedJunction = JUNCTION_CATALOG.find(j => j.id === selectedId);

  return (
    <section className="dash-card junction-recommender-card" aria-label="Junction recommendations">
      <div className="card-top">
        <h2><Compass size={16} /> Junctions</h2>
        <button
          className="recommender-toggle"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse junction suggestions' : 'Expand junction suggestions'}
        >
          {expanded ? <X size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <p className="recommender-subtitle">
        {goalTexts.length > 0
          ? 'Based on your goals, these life games fit best'
          : 'Choose a life-improvement game to play'}
      </p>

      <div className={`recommender-list ${expanded ? 'expanded' : 'collapsed'}`} role="list">
        {recommendations.map(junction => {
          const JunctionIcon = junction.icon;
          const isSelected = selectedId === junction.id;

          return (
            <div
              key={junction.id}
              className={`recommender-item glass ${isSelected ? 'selected' : ''}`}
              role="listitem"
              onClick={() => handleSelect(junction.id)}
              tabIndex={0}
              aria-label={`${junction.name}: ${junction.tagline}`}
              style={{ borderLeftColor: junction.color }}
            >
              <div className="recommender-icon" style={{ background: `${junction.color}15` }}>
                <JunctionIcon size={16} color={junction.color} />
              </div>
              <div className="recommender-info">
                <span className="recommender-name" style={{ color: junction.color }}>
                  {junction.name}
                </span>
                <span className="recommender-tagline">{junction.tagline}</span>
              </div>
              <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
            </div>
          );
        })}
      </div>

      {selectedJunction && (
        <div className="recommender-detail glass" role="region" aria-label={`${selectedJunction.name} details`}>
          <div className="detail-header">
            {(() => { const Icon = selectedJunction.icon; return <Icon size={20} color={selectedJunction.color} />; })()}
            <span className="detail-name" style={{ color: selectedJunction.color }}>
              {selectedJunction.name}
            </span>
          </div>
          <p className="detail-tagline">{selectedJunction.tagline}</p>
          <div className="detail-keywords">
            {selectedJunction.keywords.slice(0, 5).map(kw => (
              <span key={kw} className="keyword-chip" style={{ borderColor: `${selectedJunction.color}40` }}>
                {kw}
              </span>
            ))}
          </div>
          <button
            className="detail-activate"
            style={{
              background: `linear-gradient(135deg, ${selectedJunction.color}20, ${selectedJunction.color}40)`,
              borderColor: `${selectedJunction.color}60`,
            }}
            onClick={() => navigate('/junction')}
            aria-label={`Activate ${selectedJunction.name} junction`}
          >
            <Sparkles size={14} />
            Activate Junction
          </button>
        </div>
      )}

      <button
        className="recommender-browse"
        onClick={() => navigate('/junction')}
        aria-label="Browse all junctions"
      >
        <Compass size={14} />
        Browse all junctions
      </button>
    </section>
  );
}