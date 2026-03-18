import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';

interface LongPressRowProps {
  onLongPress: (pos?: { x: number; y: number }) => void;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const LongPressRow = React.memo(function LongPressRow({
  onLongPress, onClick, className, children, style,
}: LongPressRowProps) {
  const lp = useLongPress(onLongPress, 450);
  return (
    <div {...lp} onClick={onClick} className={className} style={style}>
      {children}
    </div>
  );
});
