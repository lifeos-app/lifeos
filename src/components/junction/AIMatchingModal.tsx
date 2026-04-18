import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Check, X } from 'lucide-react';
import type { JunctionTradition } from '../../hooks/useJunction';
import { TraditionIcon } from './TraditionIcons';

export function AIMatchingModal({
  traditions,
  onClose,
  onEquip,
}: {
  traditions: JunctionTradition[];
  onClose: () => void;
  onEquip: (tradition: JunctionTradition) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const questions = [
    { q: "Do you value structured ritual and ceremony?", tags: ['tewahedo', 'catholic', 'judaism'] },
    { q: "Is personal meditation/inner stillness important to you?", tags: ['buddhism', 'daoism', 'hinduism'] },
    { q: "Do you believe in one supreme God?", tags: ['tewahedo', 'islam', 'catholic', 'judaism', 'sikhism'] },
    { q: "Are you drawn to ancient, mystical traditions?", tags: ['tewahedo', 'hinduism', 'dreaming'] },
    { q: "Do you value reason and self-mastery over faith?", tags: ['stoicism'] },
    { q: "Is community worship central to your practice?", tags: ['islam', 'sikhism', 'catholic'] },
    { q: "Do you connect spirituality with nature and the land?", tags: ['dreaming', 'daoism'] },
    { q: "Is fasting/physical discipline part of your spiritual practice?", tags: ['tewahedo', 'islam', 'buddhism'] },
    { q: "Do you believe in the interconnection of all souls?", tags: ['hinduism', 'buddhism', 'sikhism'] },
    { q: "Does sacred art, music, and architecture enhance your worship?", tags: ['tewahedo', 'catholic', 'hinduism'] },
  ];

  const handleAnswer = (ans: boolean) => {
    const newAnswers = [...answers, ans];
    setAnswers(newAnswers);
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const isComplete = answers.length === questions.length;

  const matches = useMemo(() => {
    if (!isComplete) return [];
    
    const scores: Record<string, number> = {};
    traditions.forEach(t => { scores[t.slug] = 0; });

    answers.forEach((ans, i) => {
      if (ans) {
        questions[i].tags.forEach(tag => {
          if (scores[tag] !== undefined) scores[tag] += 1;
        });
      }
    });

    const sorted = traditions
      .map(t => ({ tradition: t, score: scores[t.slug], percent: Math.round((scores[t.slug] / questions.length) * 100) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return sorted;
  }, [isComplete, answers, traditions, questions]);

  return createPortal(
    <div className="jnc-ai-overlay" onClick={onClose}>
      <div className="jnc-ai-modal" onClick={e => e.stopPropagation()}>
        <button className="jnc-ai-close" onClick={onClose} aria-label="Close AI matching"><X size={16} /></button>

        {!isComplete ? (
          <>
            <div className="jnc-ai-header">
              <div className="jnc-ai-header-icon"><Sparkles size={28} /></div>
              <div className="jnc-ai-header-title">Find Your Perfect Junction</div>
              <div className="jnc-ai-header-subtitle">Question {currentQ + 1} of {questions.length}</div>
            </div>

            <div className="jnc-ai-progress">
              <div className="jnc-ai-progress-bar" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="jnc-ai-question">{questions[currentQ].q}</div>

            <div className="jnc-ai-answers">
              <button className="jnc-ai-ans-btn yes" onClick={() => handleAnswer(true)}><Check size={18} /> Yes</button>
              <button className="jnc-ai-ans-btn no" onClick={() => handleAnswer(false)}><X size={18} /> No</button>
            </div>

            <div className="jnc-ai-dots">
              {questions.map((_, i) => (
                <div key={i} className={`jnc-ai-dot ${i < currentQ ? 'done' : i === currentQ ? 'active' : ''}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="jnc-ai-results-header">
              <Sparkles size={24} className="jnc-ai-results-icon" />
              <div className="jnc-ai-results-title">Your Spiritual Matches</div>
              <div className="jnc-ai-results-subtitle">Based on your answers, these paths resonate with you</div>
            </div>

            <div className="jnc-ai-results">
              {matches.map((m, i) => (
                <div key={m.tradition.id} className="jnc-ai-result-card" style={{ '--trad-color': m.tradition.color } as React.CSSProperties}>
                  <div className="jnc-ai-result-rank">#{i + 1}</div>
                  <div className="jnc-ai-result-icon"><TraditionIcon slug={m.tradition.slug} emoji={m.tradition.icon} size={36} /></div>
                  <div className="jnc-ai-result-name">{m.tradition.name}</div>
                  <div className="jnc-ai-result-match">{m.percent}% Match</div>
                  <div className="jnc-ai-result-why">
                    {i === 0 && "Strongest alignment with your spiritual values"}
                    {i === 1 && "Deep resonance with your practice preferences"}
                    {i === 2 && "Significant compatibility with your beliefs"}
                  </div>
                  <button className="jnc-ai-result-equip" onClick={() => onEquip(m.tradition)}>
                    <Sparkles size={12} /> Equip This Junction
                  </button>
                </div>
              ))}
            </div>

            <button className="jnc-ai-restart" onClick={() => { setCurrentQ(0); setAnswers([]); }}>Retake Quiz</button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
