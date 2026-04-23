/**
 * HermeticPrincipleBar — A subtle footer showing which Hermetic principle
 * governs the current app section. Renders italic, muted, uppercase.
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 */

import { getHermeticFooter } from '../../lib/hermetic-integration';

interface Props {
  domain: string;
  style?: React.CSSProperties;
}

export function HermeticPrincipleBar({ domain, style }: Props) {
  const { quote, principle, color } = getHermeticFooter(domain);

  return (
    <div style={{
      marginTop: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      ...style,
    }}>
      <div style={{
        width: 16,
        height: 1,
        background: `${color}25`,
      }} />
      <span style={{
        fontSize: 9,
        fontStyle: 'italic',
        color: color,
        opacity: 0.35,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        whiteSpace: 'nowrap',
      }}>
        {quote}
      </span>
      <span style={{
        fontSize: 8,
        color: `${color}40`,
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        {principle}
      </span>
      <div style={{
        width: 16,
        height: 1,
        background: `${color}25`,
      }} />
    </div>
  );
}