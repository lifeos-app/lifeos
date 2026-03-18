/**
 * SlideTutorial — Full-screen image slide overlay for feature discovery.
 *
 * Reuses the SpotlightTour tracking system (localStorage + Supabase sync).
 * Renders via OverlayPortal for correct z-index layering.
 * Gracefully handles missing images with gradient fallbacks.
 */

import { useState, useEffect, useCallback } from 'react';
import { isTourComplete, markTourComplete, type TourId } from './SpotlightTour';
import type { TutorialSlide } from './tutorials';
import './SlideTutorial.css';

interface SlideTutorialProps {
  tutorialKey: TourId;
  slides: TutorialSlide[];
  onComplete?: () => void;
}

export function SlideTutorial({ tutorialKey, slides, onComplete }: SlideTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [imgError, setImgError] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isTourComplete(tutorialKey)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [tutorialKey]);

  const dismiss = useCallback(() => {
    setVisible(false);
    markTourComplete(tutorialKey);
    onComplete?.();
  }, [tutorialKey, onComplete]);

  const next = useCallback(() => {
    if (current < slides.length - 1) {
      setCurrent(c => c + 1);
    } else {
      dismiss();
    }
  }, [current, slides.length, dismiss]);

  const prev = useCallback(() => {
    if (current > 0) setCurrent(c => c - 1);
  }, [current]);

  const handleImgError = useCallback((idx: number) => {
    setImgError(prev => new Set(prev).add(idx));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, dismiss, next, prev]);

  if (!visible || slides.length === 0) return null;

  const slide = slides[current];
  const showFallback = imgError.has(current);

  return (
    <div className="st-overlay" onClick={dismiss}>
      <div className="st-card" onClick={e => e.stopPropagation()}>
        <div
          className="st-image"
          style={showFallback ? { background: slide.fallbackGradient } : undefined}
        >
          {!showFallback && (
            <img
              src={slide.image}
              alt={slide.title}
              onError={() => handleImgError(current)}
            />
          )}
        </div>

        <div className="st-content">
          <h3 className="st-title">{slide.title}</h3>
          <p className="st-desc">{slide.description}</p>
        </div>

        <div className="st-footer">
          <div className="st-dots">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`st-dot ${i === current ? 'active' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>

          <div className="st-actions">
            {current < slides.length - 1 ? (
              <>
                <button className="st-skip" onClick={dismiss}>Skip</button>
                <button className="st-next" onClick={next}>Next</button>
              </>
            ) : (
              <button className="st-next" onClick={dismiss}>Get Started</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
