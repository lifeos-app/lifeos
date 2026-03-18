/**
 * Zone Transition — The Realm
 *
 * Shows zone name popup when entering a new zone.
 * Fades in → holds → fades out.
 */

import { useEffect, useState } from 'react';

interface ZoneTransitionProps {
  zoneName: string;
  zoneDescription: string;
  onComplete: () => void;
}

export function ZoneTransition({ zoneName, zoneDescription, onComplete }: ZoneTransitionProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(() => onComplete(), 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className={`realm-zone-transition realm-zone-transition--${phase}`}>
      <div className="realm-zone-transition-content">
        <div className="realm-zone-transition-name">{zoneName}</div>
        <div className="realm-zone-transition-desc">{zoneDescription}</div>
      </div>
    </div>
  );
}
