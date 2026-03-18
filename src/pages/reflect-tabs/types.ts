export type ReflectTab = 'overview' | 'journal' | 'review' | 'inbox' | 'story';
export interface CSSVarStyle extends React.CSSProperties {
  [key: `--${string}`]: string | number;
}
