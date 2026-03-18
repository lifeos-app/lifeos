export type TierName = 'initiate' | 'pathfinder' | 'adept' | 'warden' | 'knight' | 'sage' | 'titan' | 'grandmaster' | 'celestial' | 'transcendent';

export interface TierInfo {
  name: TierName;
  primary: string;
  gradient: string;
  glowColor: string;
  cssClass: string;
}

const TIERS: { minLevel: number; info: TierInfo }[] = [
  { minLevel: 90, info: { name: 'transcendent', primary: '#FFD700', gradient: 'linear-gradient(90deg, #9B59B6, #E74C3C, #F39C12)', glowColor: 'rgba(255,215,0,0.4)', cssClass: 'tier-transcendent' }},
  { minLevel: 80, info: { name: 'celestial', primary: '#FFD700', gradient: 'linear-gradient(90deg, #FFD700, #FFF)', glowColor: 'rgba(255,215,0,0.3)', cssClass: 'tier-celestial' }},
  { minLevel: 70, info: { name: 'grandmaster', primary: '#E0E0E0', gradient: 'linear-gradient(90deg, #C0C0C0, #FFF)', glowColor: 'rgba(224,224,224,0.3)', cssClass: 'tier-grandmaster' }},
  { minLevel: 60, info: { name: 'titan', primary: '#FF6B6B', gradient: 'linear-gradient(90deg, #FF6B6B, #A855F7)', glowColor: 'rgba(255,107,107,0.3)', cssClass: 'tier-titan' }},
  { minLevel: 50, info: { name: 'sage', primary: '#8B5CF6', gradient: 'linear-gradient(90deg, #8B5CF6, #F43F5E)', glowColor: 'rgba(139,92,246,0.3)', cssClass: 'tier-sage' }},
  { minLevel: 40, info: { name: 'knight', primary: '#F43F5E', gradient: 'linear-gradient(90deg, #F43F5E, #F97316)', glowColor: 'rgba(244,63,94,0.3)', cssClass: 'tier-knight' }},
  { minLevel: 30, info: { name: 'warden', primary: '#F97316', gradient: 'linear-gradient(90deg, #F97316, #FFD700)', glowColor: 'rgba(249,115,22,0.3)', cssClass: 'tier-warden' }},
  { minLevel: 20, info: { name: 'adept', primary: '#FFD700', gradient: 'linear-gradient(90deg, #FFD700, #39FF14)', glowColor: 'rgba(255,215,0,0.3)', cssClass: 'tier-adept' }},
  { minLevel: 10, info: { name: 'pathfinder', primary: '#39FF14', gradient: 'linear-gradient(90deg, #39FF14, #00D4FF)', glowColor: 'rgba(57,255,20,0.3)', cssClass: 'tier-pathfinder' }},
  { minLevel: 1, info: { name: 'initiate', primary: '#00D4FF', gradient: 'linear-gradient(90deg, #00D4FF, #0099B8)', glowColor: 'rgba(0,212,255,0.3)', cssClass: 'tier-initiate' }},
];

export function getTierForLevel(level: number): TierInfo {
  for (const t of TIERS) {
    if (level >= t.minLevel) return t.info;
  }
  return TIERS[TIERS.length - 1].info;
}
