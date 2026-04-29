/**
 * ChallengePlayer — interactive challenge/quiz component.
 * Supports multiple-choice, fill-blank, ordering, reflection, flash-card, and scenario types.
 */
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Zap, BookOpen } from 'lucide-react';
import type { Challenge, ChallengeResult } from '../../lib/challenge-engine';
import { validateChallenge, calculateXP } from '../../lib/challenge-engine';

const PRINCIPLE_COLORS = ['#A855F7','#06B6D4','#F97316','#EC4899','#39FF14','#FACC15','#D4AF37'];
const PRINCIPLE_NAMES = ['Mentalism','Correspondence','Vibration','Polarity','Rhythm','Cause & Effect','Gender'];

interface ChallengePlayerProps {
  challenges: Challenge[];
  onComplete: (results: ChallengeResult[]) => void;
  onBack: () => void;
}

export function ChallengePlayer({ challenges, onComplete, onBack }: ChallengePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [orderItems, setOrderItems] = useState<string[]>([]);
  const [reflectionText, setReflectionText] = useState('');
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastExplanation, setLastExplanation] = useState<string | undefined>();
  const [startTime] = useState(Date.now());
  const [xpAnimated, setXpAnimated] = useState(0);

  const challenge = challenges[currentIndex];
  const progress = ((currentIndex) / challenges.length) * 100;

  // Initialize order items for ordering challenges
  useMemo(() => {
    if (challenge?.type === 'ordering' && challenge.orderingItems) {
      const shuffled = [...challenge.orderingItems].sort(() => Math.random() - 0.5);
      setOrderItems(shuffled.map(i => i.id));
    }
  }, [challenge]);

  if (!challenge) {
    // All challenges completed
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-white mb-2">Lessons Complete!</h2>
        <p className="text-[#8BA4BE] mb-2">
          You completed {challenges.length} challenge{challenges.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[#00D4FF] text-2xl font-bold mb-6">
          +{results.reduce((sum, r) => sum + r.xpEarned, 0)} XP
        </p>
        <button onClick={onBack} className="px-6 py-2 rounded-lg bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30 transition-colors">
          Back to Path
        </button>
      </div>
    );
  }

  const handleSubmit = () => {
    let answer = '';
    switch (challenge.type) {
      case 'multiple-choice':
      case 'scenario':
        answer = answers[challenge.id] || '';
        break;
      case 'fill-blank':
        answer = answers[challenge.id] || '';
        break;
      case 'ordering':
        answer = orderItems.join(',');
        break;
      case 'reflection':
        answer = reflectionText;
        break;
      case 'flash-card':
        answer = answers[challenge.id] || 'reviewed';
        break;
      case 'code-challenge':
        answer = answers[challenge.id] || '';
        break;
    }

    const validation = validateChallenge(challenge, answer);
    const elapsed = Date.now() - startTime;
    const xp = challenge.type === 'reflection'
      ? challenge.xpReward // always give XP for reflection
      : calculateXP(challenge, { correct: validation.correct, attempts: 1, timeMs: elapsed });

    const result: ChallengeResult = {
      challengeId: challenge.id,
      correct: challenge.type === 'reflection' ? true : validation.correct,
      answer,
      timeMs: elapsed,
      attempts: 1,
      completedAt: new Date().toISOString(),
      xpEarned: xp,
    };

    setResults(prev => [...prev, result]);
    setLastCorrect(result.correct);
    setLastExplanation(validation.explanation);
    setShowResult(true);

    if (xp > 0) {
      setXpAnimated(0);
      let frame = 0;
      const animate = () => {
        frame++;
        setXpAnimated(Math.min(frame * (xp / 20), xp));
        if (frame < 20) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  };

  const handleNext = () => {
    setShowResult(false);
    setCurrentIndex(prev => prev + 1);
    setAnswers(prev => ({ ...prev }));
    setReflectionText('');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderItems];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrderItems(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index >= orderItems.length - 1) return;
    const newOrder = [...orderItems];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderItems(newOrder);
  };

  const principleColor = challenge.hermeticPrinciple != null ? PRINCIPLE_COLORS[challenge.hermeticPrinciple] : '#00D4FF';
  const principleName = challenge.hermeticPrinciple != null ? PRINCIPLE_NAMES[challenge.hermeticPrinciple] : null;
  const difficultyColors = { beginner: '#39FF14', intermediate: '#F97316', advanced: '#F43F5E' };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1A3A5C]">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="text-[#8BA4BE] hover:text-white text-sm">← Back</button>
          <div className="flex items-center gap-2">
            {principleName && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${principleColor}20`, color: principleColor, border: `1px solid ${principleColor}40` }}>
                {principleName}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${difficultyColors[challenge.difficulty]}15`, color: difficultyColors[challenge.difficulty] }}>
              {challenge.difficulty}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[#1A3A5C] overflow-hidden">
          <div className="h-full rounded-full bg-[#00D4FF] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-[#5A7A9A] mt-1">{currentIndex + 1} of {challenges.length}</div>
      </div>

      {/* Challenge Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-lg font-semibold text-white mb-2">{challenge.title}</h3>
        <div className="text-sm text-[#8BA4BE] mb-4 whitespace-pre-line">{challenge.description}</div>

        {/* Challenge Type Specific UI */}
        {!showResult && (
          <>
            {/* Multiple Choice / Scenario */}
            {(challenge.type === 'multiple-choice' || challenge.type === 'scenario') && challenge.options && (
              <div className="space-y-2">
                {challenge.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers(prev => ({ ...prev, [challenge.id]: opt.id }))}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      answers[challenge.id] === opt.id
                        ? 'bg-[#00D4FF]/15 border-[#00D4FF]/50 text-white'
                        : 'bg-[#0F2D4A] border-[#1A3A5C] text-[#8BA4BE] hover:bg-[#0F2D4A]/80'
                    }`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            )}

            {/* Fill in the Blank */}
            {challenge.type === 'fill-blank' && challenge.blanks && (
              <div className="space-y-3">
                {challenge.blanks.map((blank) => (
                  <div key={blank.id}>
                    <input
                      type="text"
                      value={answers[`${challenge.id}_${blank.id}`] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [`${challenge.id}_${blank.id}`]: e.target.value }))}
                      placeholder={blank.hint || 'Type your answer...'}
                      className="w-full p-3 rounded-lg bg-[#0F2D4A] border border-[#1A3A5C] text-white placeholder:text-[#5A7A9A] focus:border-[#00D4FF]/50 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Ordering */}
            {challenge.type === 'ordering' && challenge.orderingItems && (
              <div className="space-y-2">
                {orderItems.map((itemId, index) => {
                  const item = challenge.orderingItems!.find(i => i.id === itemId);
                  if (!item) return null;
                  return (
                    <div key={itemId} className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMoveUp(index)} className="text-[#5A7A9A] hover:text-white text-xs">▲</button>
                        <button onClick={() => handleMoveDown(index)} className="text-[#5A7A9A] hover:text-white text-xs">▼</button>
                      </div>
                      <div className="flex-1 p-3 rounded-lg bg-[#0F2D4A] border border-[#1A3A5C] text-white text-sm">
                        <span className="text-[#5A7A9A] mr-2">{index + 1}.</span>{item.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reflection */}
            {challenge.type === 'reflection' && challenge.reflectionPrompt && (
              <div>
                <p className="text-[#8BA4BE] text-sm mb-3 italic">{challenge.reflectionPrompt}</p>
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={5}
                  className="w-full p-3 rounded-lg bg-[#0F2D4A] border border-[#1A3A5C] text-white placeholder:text-[#5A7A9A] focus:border-[#00D4FF]/50 focus:outline-none resize-none"
                />
              </div>
            )}
          </>
        )}

        {/* Result Display */}
        {showResult && (
          <div className={`p-4 rounded-lg border ${
            lastCorrect ? 'bg-[#39FF14]/10 border-[#39FF14]/30' : 'bg-[#F43F5E]/10 border-[#F43F5E]/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {lastCorrect ? (
                <><CheckCircle2 className="text-[#39FF14]" size={20} /><span className="text-[#39FF14] font-semibold">Correct!</span></>
              ) : (
                <><XCircle className="text-[#F43F5E]" size={20} /><span className="text-[#F43F5E] font-semibold">Not quite</span></>
              )}
              {xpAnimated > 0 && (
                <span className="ml-auto text-[#00D4FF] font-bold">+{Math.round(xpAnimated)} XP</span>
              )}
            </div>
            {lastExplanation && (
              <p className="text-sm text-[#8BA4BE]">{lastExplanation}</p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4">
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={challenge.type !== 'reflection' && !answers[challenge.id] && orderItems.length === 0}
            className="w-full py-3 rounded-lg font-medium transition-all bg-[#00D4FF] text-[#050E1A] hover:bg-[#00D4FF]/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-lg font-medium transition-all bg-[#00D4FF] text-[#050E1A] hover:bg-[#00D4FF]/90 flex items-center justify-center gap-2"
          >
            {currentIndex + 1 >= challenges.length ? 'Finish' : 'Next Challenge'} <ArrowRight size={16} />
          </button>
        )}
        {challenge.hint && !showResult && (
          <p className="text-xs text-[#5A7A9A] text-center mt-2">💡 {challenge.hint}</p>
        )}
      </div>
    </div>
  );
}

export default ChallengePlayer;