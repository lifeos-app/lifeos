// ═══════════════════════════════════════════════════════════
// LazyImage — Intersection Observer-based lazy loading
// Smooth fade-in with placeholder support
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string; // CSS color or tiny base64 data URI
  onError?: () => void;
  eager?: boolean; // skip lazy loading for above-the-fold
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  style,
  placeholder = '#1a1a2e',
  onError,
  eager = false,
}: LazyImageProps) {
  const [isInView, setIsInView] = useState(eager);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager || isInView) return;
    const el = containerRef.current;
    if (!el) return;

    // IntersectionObserver not available in all environments — fall back to eager loading
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, isInView]);

  const handleLoad = useCallback(() => setIsLoaded(true), []);
  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError) return null;

  const isBase64 = placeholder.startsWith('data:');
  const placeholderStyle: React.CSSProperties = isBase64
    ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: placeholder };

  return (
    <div
      ref={containerRef}
      className={`lazy-image-wrapper ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        position: 'relative',
        overflow: 'hidden',
        ...placeholderStyle,
        ...style,
      }}
    >
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

export default LazyImage;
