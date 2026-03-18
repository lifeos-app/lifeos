/**
 * Biome System — The Realm
 *
 * 6 cosmetic biome palettes that override tile colors, parallax,
 * and grass fill. Woodland matches current hardcoded defaults exactly.
 */

import type { TileType } from './tiles';

export type BiomeId = 'woodland' | 'tropical' | 'highland' | 'savanna' | 'coastal' | 'tundra';

export interface BiomePalette {
  id: BiomeId;
  name: string;
  description: string;
  tileOverrides: Partial<Record<TileType, string[]>>;
  grassFill: string;
  mountainColors: string[];
  treeColor: string;
  cloudColor: string;
}

export const BIOMES: Record<BiomeId, BiomePalette> = {
  woodland: {
    id: 'woodland',
    name: 'Woodland',
    description: 'Classic green forest — the default realm',
    tileOverrides: {},
    grassFill: '#4A7C3E',
    mountainColors: [
      'rgba(25,20,55,0.45)',
      'rgba(35,45,75,0.35)',
      'rgba(45,70,80,0.28)',
    ],
    treeColor: 'rgba(20,40,25,0.3)',
    cloudColor: 'rgba(220,225,240,0.06)',
  },

  tropical: {
    id: 'tropical',
    name: 'Tropical',
    description: 'Lush jungle with vibrant greens and turquoise water',
    tileOverrides: {
      grass:         ['#2E8B57', '#3CB371', '#228B22'],
      grass_dark:    ['#228B22', '#2E8B57', '#1B6B1B'],
      grass_flowers: ['#2E8B57', '#FF6B9D', '#FF4500'],
      water:         ['#00838F', '#00ACC1', '#006064'],
      water_edge_n:  ['#00ACC1', '#2E8B57'],
      water_edge_s:  ['#00ACC1', '#2E8B57'],
      water_edge_e:  ['#00ACC1', '#2E8B57'],
      water_edge_w:  ['#00ACC1', '#2E8B57'],
    },
    grassFill: '#267A3E',
    mountainColors: [
      'rgba(15,40,30,0.45)',
      'rgba(20,60,40,0.35)',
      'rgba(30,80,50,0.28)',
    ],
    treeColor: 'rgba(15,50,20,0.35)',
    cloudColor: 'rgba(200,240,230,0.06)',
  },

  highland: {
    id: 'highland',
    name: 'Highland',
    description: 'Misty purple hills with heather and stone',
    tileOverrides: {
      grass:         ['#5B6B5A', '#6B7B6A', '#4B5B4A'],
      grass_dark:    ['#4B5B4A', '#5B6B5A', '#3B4B3A'],
      grass_flowers: ['#5B6B5A', '#9B59B6', '#E8A0BF'],
      path_stone:    ['#7B7B8B', '#8B8B9B', '#6B6B7B'],
      wall_stone:    ['#5B5B6B', '#6B6B7B', '#4B4B5B'],
    },
    grassFill: '#4A5B42',
    mountainColors: [
      'rgba(40,30,60,0.50)',
      'rgba(55,40,80,0.38)',
      'rgba(65,55,90,0.30)',
    ],
    treeColor: 'rgba(30,25,40,0.3)',
    cloudColor: 'rgba(200,195,220,0.08)',
  },

  savanna: {
    id: 'savanna',
    name: 'Savanna',
    description: 'Golden grasslands under warm amber skies',
    tileOverrides: {
      grass:         ['#8B7D3C', '#9B8D4C', '#7B6D2C'],
      grass_dark:    ['#7B6D2C', '#8B7D3C', '#6B5D1C'],
      grass_flowers: ['#8B7D3C', '#E74C3C', '#F39C12'],
      path_dirt:     ['#A08060', '#B09070', '#906D4A'],
      water:         ['#4A8B6E', '#5A9B7E', '#3A7B5E'],
      water_edge_n:  ['#5A9B7E', '#8B7D3C'],
      water_edge_s:  ['#5A9B7E', '#8B7D3C'],
      water_edge_e:  ['#5A9B7E', '#8B7D3C'],
      water_edge_w:  ['#5A9B7E', '#8B7D3C'],
    },
    grassFill: '#7A6C30',
    mountainColors: [
      'rgba(60,40,20,0.40)',
      'rgba(80,55,30,0.32)',
      'rgba(90,70,40,0.25)',
    ],
    treeColor: 'rgba(50,40,15,0.25)',
    cloudColor: 'rgba(240,220,180,0.06)',
  },

  coastal: {
    id: 'coastal',
    name: 'Coastal',
    description: 'Sandy shores with ocean blues and sea breeze',
    tileOverrides: {
      grass:         ['#5A8A5A', '#6A9A6A', '#4A7A4A'],
      grass_dark:    ['#4A7A4A', '#5A8A5A', '#3A6A3A'],
      grass_flowers: ['#5A8A5A', '#FF8C69', '#87CEEB'],
      path_stone:    ['#A0A090', '#B0B0A0', '#909080'],
      path_dirt:     ['#C2B280', '#D2C290', '#B2A270'],
      water:         ['#1565C0', '#1E88E5', '#0D47A1'],
      water_edge_n:  ['#1E88E5', '#5A8A5A'],
      water_edge_s:  ['#1E88E5', '#5A8A5A'],
      water_edge_e:  ['#1E88E5', '#5A8A5A'],
      water_edge_w:  ['#1E88E5', '#5A8A5A'],
    },
    grassFill: '#4A7A40',
    mountainColors: [
      'rgba(20,30,60,0.42)',
      'rgba(30,50,80,0.32)',
      'rgba(40,65,90,0.25)',
    ],
    treeColor: 'rgba(25,45,30,0.25)',
    cloudColor: 'rgba(230,240,255,0.08)',
  },

  tundra: {
    id: 'tundra',
    name: 'Tundra',
    description: 'Frozen expanse with ice-blue tones and snow',
    tileOverrides: {
      grass:         ['#6B7B7B', '#7B8B8B', '#5B6B6B'],
      grass_dark:    ['#5B6B6B', '#6B7B7B', '#4B5B5B'],
      grass_flowers: ['#6B7B7B', '#87CEEB', '#B0C4DE'],
      path_stone:    ['#8B8B9B', '#9B9BAB', '#7B7B8B'],
      path_dirt:     ['#7B7B70', '#8B8B80', '#6B6B60'],
      water:         ['#2A6B8E', '#3A7B9E', '#1A5B7E'],
      water_edge_n:  ['#3A7B9E', '#6B7B7B'],
      water_edge_s:  ['#3A7B9E', '#6B7B7B'],
      water_edge_e:  ['#3A7B9E', '#6B7B7B'],
      water_edge_w:  ['#3A7B9E', '#6B7B7B'],
    },
    grassFill: '#5A6A62',
    mountainColors: [
      'rgba(40,45,65,0.48)',
      'rgba(55,60,85,0.38)',
      'rgba(70,80,100,0.30)',
    ],
    treeColor: 'rgba(30,35,40,0.25)',
    cloudColor: 'rgba(220,230,245,0.09)',
  },
};

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
