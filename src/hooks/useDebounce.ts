/**
 * useDebounce — Debounce & throttle hooks
 *
 * useDebounce<T>(value, delay)        — Debounce a value (e.g. search input)
 * useDebouncedCallback(fn, delay)     — Debounce a callback (e.g. API call)
 * useThrottledCallback(fn, delay)     — Throttle a callback (e.g. resize handler)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Returns a debounced version of the input value.
 * Updates only after `delay` ms of inactivity.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * // debouncedSearch updates 300ms after the user stops typing
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a debounced version of a callback function.
 * The callback will only execute after `delay` ms of inactivity.
 *
 * @example
 * const debouncedSave = useDebouncedCallback((text: string) => {
 *   saveToServer(text);
 * }, 500);
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    },
    [delay],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debouncedFn;
}

/**
 * Returns a throttled version of a callback function.
 * The callback will execute at most once per `delay` ms.
 *
 * @example
 * const throttledResize = useThrottledCallback(() => {
 *   recalcLayout();
 * }, 200);
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const throttledFn = useMemo(
    () =>
      (...args: Parameters<T>) => {
        const now = Date.now();
        const remaining = delay - (now - lastCallRef.current);

        if (remaining <= 0) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          lastCallRef.current = now;
          fnRef.current(...args);
        } else if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            lastCallRef.current = Date.now();
            timerRef.current = null;
            fnRef.current(...args);
          }, remaining);
        }
      },
    [delay],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return throttledFn;
}
