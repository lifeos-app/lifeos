/**
 * DreamInterpreter.tsx — AI dream interpretation engine
 *
 * Select a dream, choose interpretation tradition(s),
 * see multi-tradition comparisons, symbol-by-symbol breakdowns,
 * and save interpretations to the dream entry.
 */

import { useState, useMemo } from 'react';
import { useDreamStore } from '../../stores/dreamStore';
import { useDreamJournal, SYMBOL_DATABASE, DREAM_MOODS, type DreamSymbol, type SymbolMeaning } from './useDreamJournal';

// Interpretation tradition groups
const INTERPRETATION_TRADITIONS = [
  { id: 'hermetic', name: 'Hermetic', emoji: '⚗️', description: 'The 7 Principles applied to dreams — Correspondence, Vibration, Polarity' },
  { id: 'buddhism', name: 'Buddhist', emoji: '☸️', description: 'Anicca, Dukkha, Anatta — dreams as manifestations of the aggregates' },
  { id: 'jungian', name: 'Jungian', emoji: '🧠', description: 'Archetypes, Shadow, Anima/Animus, individuation through dream work' },
  { id: 'islam', name: 'Islamic', emoji: '☪️', description: 'Ru\'ya (true vision), Ta\'wil interpretation, Prophetic dream science' },
  { id: 'hinduism', name: 'Hindu', emoji: '🕉️', description: 'Vasana (impressions), atman in maya, symbols as karmic mirrors' },
  { id: 'stoicism', name: 'Stoic', emoji: '🏛️', description: 'Impressions (phantasiai), what is in your power, the dichotomy of control' },
  { id: 'christian', name: 'Christian', emoji: '☦️', description: 'Biblical dream interpretation, Joseph and Daniel, divine messages' },
  { id: 'daoism', name: 'Daoist', emoji: '☯️', description: 'The Way in dreams — flow, wu-wei, natural symbolism' },
  { id: 'shamanic', name: 'Shamanic', emoji: '🌀', description: 'Journey between worlds, soul retrieval, power animal guidance' },
  { id: 'egyptian', name: 'Ancient Egyptian', emoji: '🏺', description: 'The Duat, Book of the Dead, Osirian transformation' },
  { id: 'celtic', name: 'Celtic', emoji: '🍀', description: 'Thin places, Otherworld journeys, druidic symbol wisdom' },
  { id: 'zen', name: 'Zen', emoji: '🪷', description: 'Direct pointing, no-interpretation interpretation, mu' },
];

interface DreamInterpreterProps {
  onClose: () => void;
  initialDreamId?: string;
}

export function DreamInterpreter({ onClose, initialDreamId }: DreamInterpreterProps) {
  const entries = useDreamStore(s => s.entries);
  const setInterpretation = useDreamStore(s => s.setInterpretation);
  const { getSymbolMeaning } = useDreamJournal();

  const [selectedDreamId, setSelectedDreamId] = useState<string>(initialDreamId || '');
  const [selectedTraditions, setSelectedTraditions] = useState<Set<string>>(new Set(['hermetic', 'jungian']));
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [generatedInterpretation, setGeneratedInterpretation] = useState<string | null>(null);

  const selectedDream = useMemo(() => {
    return entries.find(e => e.id === selectedDreamId);
  }, [entries, selectedDreamId]);

  // Symbol meanings for the selected dream
  const symbolBreakdown = useMemo(() => {
    if (!selectedDream) return [];
    return selectedDream.symbol_tags
      .map(tag => {
        const sym = getSymbolMeaning(tag);
        if (!sym) return null;
        const traditionMeanings = sym.meanings.filter(m =>
          selectedTraditions.has(m.tradition)
        );
        return { symbol: sym, tag, traditionMeanings };
      })
      .filter(Boolean) as { symbol: DreamSymbol; tag: string; traditionMeanings: SymbolMeaning[] }[];
  }, [selectedDream, selectedTraditions, getSymbolMeaning]);

  const toggleTradition = (id: string) => {
    setSelectedTraditions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // Keep at least one
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Generate interpretation (in real app, this would call an LLM)
  const handleInterpret = async () => {
    if (!selectedDream) return;
    setIsInterpreting(true);

    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Build interpretation from symbol database
    const traditionNames = [...selectedTraditions].map(id =>
      INTERPRETATION_TRADITIONS.find(t => t.id === id)?.name || id
    );

    const moodLabels = selectedDream.mood_tags.map(m =>
      DREAM_MOODS.find(dm => dm.value === m)?.label || m
    ).join(', ');

    let interpretation = `✦ ${traditionNames.join(' + ')} Interpretation ✦\n\n`;
    interpretation += `Dream: "${selectedDream.title}"\n`;
    interpretation += `Mood: ${moodLabels}\n`;
    interpretation += `Intensity: ${selectedDream.intensity}/10\n`;
    if (selectedDream.isLucid) interpretation += `🌙 Lucid Dream\n`;
    if (selectedDream.isRecurring) interpretation += `🔁 Recurring Dream\n`;
    interpretation += `\n`;

    // Per-tradition interpretation
    [...selectedTraditions].forEach(traditionId => {
      const tradition = INTERPRETATION_TRADITIONS.find(t => t.id === traditionId);
      if (!tradition) return;

      interpretation += `── ${tradition.emoji} ${tradition.name} Perspective ──\n\n`;

      selectedDream.symbol_tags.forEach(symbolTag => {
        const sym = SYMBOL_DATABASE.find(s => s.name.toLowerCase() === symbolTag.toLowerCase());
        const meaning = sym?.meanings.find(m => m.tradition === traditionId);
        if (meaning) {
          interpretation += `${sym?.emoji || '◈'} ${symbolTag}: ${meaning.meaning}\n\n`;
        }
      });

      // Add tradition-specific synthesis
      if (traditionId === 'hermetic') {
        interpretation += `Alchemy: This dream reflects the Principle of ${selectedDream.intensity >= 7 ? 'Vibration — intense dreams signal a high-frequency state of consciousness' : 'Correspondence — the outer dream mirrors an inner reality seeking recognition'}. `;
        if (selectedDream.isLucid) interpretation += `Your lucid awareness demonstrates the Principle of Mentalism — consciousness shaping its own reality.`;
        interpretation += `\n\n`;
      } else if (traditionId === 'jungian') {
        interpretation += `Individuation: The symbols in this dream are ${selectedDream.mood_tags.includes('nightmare') ? 'Shadow material seeking integration — what you fear holds the key to your wholeness' : 'archetypal forces guiding you toward the Self'}. `;
        if (selectedDream.symbol_tags.includes('mirrors')) interpretation += `The mirror asks: what part of yourself are you refusing to see?`;
        interpretation += `\n\n`;
      } else if (traditionId === 'buddhism') {
        interpretation += `Awareness: This dream is a manifestation of ${selectedDream.mood_tags.includes('anxious') ? 'tanha (craving) — the anxious mind creates its own suffering' : 'mind (cittam) — observe without attachment, and the dream reveals its emptiness'}. All phenomena are impermanent, including this dream.\n\n`;
      } else if (traditionId === 'islam') {
        interpretation += `In the Islamic tradition, dreams are of three types: Ru\'ya (true vision), Hulm (confused dream from Shaytan), and Hadith al-nafs (self-talk). The presence of ${selectedDream.mood_tags.includes('peaceful') ? 'peace suggests this may be a Ru\'ya — pay attention to its guidance' : 'disturbance suggests processing of daily impressions (hadith al-nafs)'}.\n\n`;
      }

      interpretation += `\n`;
    });

    // Personal synthesis
    interpretation += `── ✦ Personal Synthesis ──\n\n`;
    interpretation += `This dream weaves together ${selectedDream.symbol_tags.length > 1 ? 'multiple symbols that interact with each other' : 'a single powerful symbol'}${selectedDream.isRecurring ? ' — and its recurrence signals unfinished business in the psyche' : ''}. `;
    interpretation += `At intensity ${selectedDream.intensity}/10, this dream ${selectedDream.intensity >= 7 ? 'carries significant emotional weight and deserves reflection' : 'suggests mild subconscious processing'}. `;
    if (selectedDream.isLucid) {
      interpretation += `Your lucidity indicates a breakthrough in consciousness — you are becoming aware of awareness itself.`;
    }

    setGeneratedInterpretation(interpretation);
    setIsInterpreting(false);
  };

  const handleSave = () => {
    if (selectedDreamId && generatedInterpretation) {
      setInterpretation(selectedDreamId, generatedInterpretation);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a1a]/95 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Close button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              Dream Interpreter
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300/60 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Dream Selection */}
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🌙</div>
            <p className="text-sm text-purple-300/50">No dreams recorded yet.</p>
            <p className="text-xs text-purple-400/40 mt-2">Log a dream first, then come back for interpretation.</p>
          </div>
        ) : (
          <>
            {/* Dream Selector */}
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-2 block">
                Select a Dream
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {entries.slice(0, 20).map(dream => (
                  <button
                    key={dream.id}
                    onClick={() => {
                      setSelectedDreamId(dream.id);
                      setGeneratedInterpretation(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedDreamId === dream.id
                        ? 'bg-purple-600/30 border border-purple-500/40'
                        : 'bg-[#111132]/60 border border-purple-500/10 hover:border-purple-500/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-100 truncate max-w-[70%]">{dream.title}</span>
                      <div className="flex items-center gap-1.5">
                        {dream.isLucid && <span className="text-xs">👁️</span>}
                        <span className="text-[10px] text-purple-400/50">{dream.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-300/40 line-clamp-1 mt-0.5">
                      {dream.narrative.substring(0, 60)}...
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Dream Preview */}
            {selectedDream && (
              <div className="mb-4 p-3 rounded-lg bg-purple-900/20 border border-purple-500/15">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-purple-200">{selectedDream.title}</span>
                  {selectedDream.isLucid && <span className="text-xs text-cyan-300">👁️ Lucid</span>}
                  {selectedDream.isRecurring && <span className="text-xs text-pink-300">🔁 Recurring</span>}
                </div>
                <p className="text-xs text-purple-300/60 line-clamp-3">
                  {selectedDream.narrative}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-purple-400/50">Intensity: {selectedDream.intensity}/10</span>
                  <span className="text-xs text-purple-400/30">|</span>
                  <div className="flex items-center gap-1">
                    {selectedDream.mood_tags.map(m => {
                      const mood = DREAM_MOODS.find(dm => dm.value === m);
                      return mood ? <span key={m} className="text-xs">{mood.emoji}</span> : null;
                    })}
                  </div>
                  <span className="text-xs text-purple-400/30">|</span>
                  <div className="flex items-center gap-1">
                    {selectedDream.symbol_tags.map(s => (
                      <span key={s} className="text-[10px] text-purple-300/60 capitalize">{s}</span>
                    )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, <span key={`sep-${i}`} className="text-purple-400/30">·</span>, curr], [] as React.ReactNode[])}
                  </div>
                </div>
              </div>
            )}

            {/* Tradition Selection */}
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-2 block">
                Interpretation Traditions
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {INTERPRETATION_TRADITIONS.map(trad => (
                  <button
                    key={trad.id}
                    onClick={() => toggleTradition(trad.id)}
                    className={`p-2 rounded-lg text-left transition-all ${
                      selectedTraditions.has(trad.id)
                        ? 'bg-purple-600/30 border border-purple-500/40'
                        : 'bg-white/5 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{trad.emoji}</span>
                      <span className={`text-xs font-medium ${selectedTraditions.has(trad.id) ? 'text-purple-100' : 'text-white/50'}`}>
                        {trad.name}
                      </span>
                    </div>
                    <p className={`text-[9px] mt-0.5 ${selectedTraditions.has(trad.id) ? 'text-purple-300/70' : 'text-white/30'}`}>
                      {trad.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol Breakdown */}
            {symbolBreakdown.length > 0 && (
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-2 block">
                  Symbol Breakdown
                </label>
                <div className="space-y-2">
                  {symbolBreakdown.map(({ symbol, tag, traditionMeanings }) => (
                    <div key={tag} className="p-2.5 rounded-lg bg-[#111132]/60 border border-purple-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{symbol.emoji}</span>
                        <span className="text-sm font-medium text-purple-200 capitalize">{tag}</span>
                      </div>
                      {traditionMeanings.length > 0 ? (
                        <div className="space-y-1.5 mt-2">
                          {traditionMeanings.map(m => (
                            <div key={m.tradition} className="pl-2 border-l-2 border-purple-500/20">
                              <div className="text-[10px] font-medium text-purple-300/80">{m.traditionName}</div>
                              <p className="text-xs text-purple-300/60 leading-relaxed">{m.meaning}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-purple-400/40 mt-1">
                          No {[...selectedTraditions].map(id => INTERPRETATION_TRADITIONS.find(t => t.id === id)?.name).join('/')} interpretation for this symbol.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interpret Button */}
            <button
              onClick={handleInterpret}
              disabled={!selectedDreamId || isInterpreting}
              className="w-full py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-600 via-purple-600 to-cyan-600 hover:from-amber-500 hover:via-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-4"
            >
              {isInterpreting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">✦</span> Reading the symbols...
                </span>
              ) : (
                '✨ Interpret Dream'
              )}
            </button>

            {/* Generated Interpretation */}
            {generatedInterpretation && (
              <div className="mb-4">
                <div className="p-4 rounded-xl bg-gradient-to-b from-[#111132] to-[#0d0d24] border border-purple-500/20">
                  <h3 className="text-sm font-medium text-purple-200 mb-3">Interpretation</h3>
                  <div className="text-xs text-purple-300/80 leading-relaxed whitespace-pre-line">
                    {generatedInterpretation}
                  </div>
                </div>

                {/* Save button */}
                {!selectedDream?.ai_interpretation && (
                  <button
                    onClick={handleSave}
                    className="w-full mt-3 py-2.5 rounded-xl text-sm bg-purple-600/40 hover:bg-purple-600/50 border border-purple-500/30 transition-all"
                  >
                    💾 Save Interpretation to Dream
                  </button>
                )}
                {selectedDream?.ai_interpretation && (
                  <div className="mt-3 p-2 rounded-lg bg-emerald-900/20 border border-emerald-500/20 text-center">
                    <span className="text-xs text-emerald-300">✓ Interpretation saved</span>
                  </div>
                )}
              </div>
            )}

            {/* Existing Interpretation */}
            {selectedDream?.ai_interpretation && !generatedInterpretation && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-b from-[#111132] to-[#0d0d24] border border-purple-500/15">
                <h3 className="text-sm font-medium text-purple-200 mb-2">Saved Interpretation</h3>
                <div className="text-xs text-purple-300/70 leading-relaxed whitespace-pre-line">
                  {selectedDream.ai_interpretation}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}