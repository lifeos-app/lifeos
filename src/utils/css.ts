/**
 * CSS Custom Properties utility type.
 *
 * React's CSSProperties doesn't allow custom properties (--foo).
 * This type extends it to accept any `--*` key, eliminating the need
 * for `as any` casts when passing CSS custom properties inline.
 *
 * Usage:
 *   <div style={{ '--my-color': '#00D4FF', padding: 4 } as CSSCustomProperties}>
 *
 * Or use the helper:
 *   <div style={cssVars({ '--my-color': '#00D4FF' }, { padding: 4 })}>
 */
import type { CSSProperties } from 'react';

/** CSSProperties extended with CSS custom property support */
export type CSSCustomProperties = CSSProperties & Record<`--${string}`, string | number>;

/**
 * Create a style object with CSS custom properties, type-safe and without `as any`.
 *
 * @param vars  CSS custom properties (e.g. `{ '--eo-color': '#00D4FF' }`)
 * @param style Optional additional CSSProperties
 */
export function cssVars(
  vars: Record<`--${string}`, string | number>,
  style?: CSSProperties,
): CSSCustomProperties {
  return { ...vars, ...style } as CSSCustomProperties;
}
