export type CharacterTab = 'overview' | 'quests' | 'stats' | 'equipment' | 'junction' | 'realm';
export interface CSSVarStyle extends React.CSSProperties {
  [key: `--${string}`]: string | number;
}
