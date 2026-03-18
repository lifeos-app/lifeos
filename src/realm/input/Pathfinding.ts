/**
 * A* Pathfinding — The Realm
 *
 * Grid-based pathfinding on the tilemap.
 * Used for tap-to-move on mobile.
 */

import { TILE_DEFS, type TileType } from '../data/tiles';
import type { ZoneDef, BuildingPlacement } from '../data/zones';

interface PathNode {
  col: number;
  row: number;
  g: number; // Cost from start
  h: number; // Heuristic (estimated cost to end)
  f: number; // g + h
  parent: PathNode | null;
}

// BUG-085: Cache walkability grids to avoid recomputing on every pathfinding request
const walkGridCache = new Map<string, boolean[][]>();

function getZoneKey(zone: ZoneDef): string {
  // Create a unique key based on zone properties
  // Include building count and positions to invalidate when buildings change
  const buildingKeys = zone.buildings.map(b => `${b.tileX},${b.tileY},${b.widthTiles},${b.heightTiles}`).join('|');
  return `${zone.name}_${zone.width}x${zone.height}_${buildingKeys}`;
}

/**
 * Build a walkability grid from zone data
 * BUG-085: Now cached per zone
 */
function buildWalkGrid(zone: ZoneDef): boolean[][] {
  const cacheKey = getZoneKey(zone);
  const cached = walkGridCache.get(cacheKey);
  if (cached) return cached;
  const grid: boolean[][] = [];
  for (let row = 0; row < zone.height; row++) {
    grid[row] = [];
    for (let col = 0; col < zone.width; col++) {
      const tile = zone.tiles[row]?.[col];
      grid[row][col] = tile ? (TILE_DEFS[tile]?.walkable ?? false) : false;
    }
  }

  // Mark building tiles as non-walkable
  for (const b of zone.buildings) {
    for (let r = b.tileY; r < b.tileY + b.heightTiles; r++) {
      for (let c = b.tileX; c < b.tileX + b.widthTiles; c++) {
        if (grid[r]?.[c] !== undefined) {
          grid[r][c] = false;
        }
      }
    }
  }

  // BUG-085: Cache the computed grid
  walkGridCache.set(cacheKey, grid);
  return grid;
}

/**
 * BUG-085: Clear the walkability grid cache (call when zone changes)
 */
export function clearPathfindingCache() {
  walkGridCache.clear();
}

/**
 * Find path from (startCol, startRow) to (endCol, endRow)
 * Returns array of {col, row} steps, or empty if no path.
 */
export function findPath(
  zone: ZoneDef,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  maxIterations = 500,
): { col: number; row: number }[] {
  const grid = buildWalkGrid(zone);

  // Clamp start/end to grid
  startCol = Math.max(0, Math.min(zone.width - 1, Math.round(startCol)));
  startRow = Math.max(0, Math.min(zone.height - 1, Math.round(startRow)));
  endCol = Math.max(0, Math.min(zone.width - 1, Math.round(endCol)));
  endRow = Math.max(0, Math.min(zone.height - 1, Math.round(endRow)));

  // If target is not walkable, find nearest walkable tile
  if (!grid[endRow]?.[endCol]) {
    const nearest = findNearestWalkable(grid, endCol, endRow, zone.width, zone.height);
    if (!nearest) return [];
    endCol = nearest.col;
    endRow = nearest.row;
  }

  // Already there
  if (startCol === endCol && startRow === endRow) return [];

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;

  const startNode: PathNode = {
    col: startCol, row: startRow,
    g: 0,
    h: heuristic(startCol, startRow, endCol, endRow),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }

    const current = openSet.splice(bestIdx, 1)[0];

    // Found target
    if (current.col === endCol && current.row === endRow) {
      return reconstructPath(current);
    }

    closedSet.add(key(current.col, current.row));

    // Check neighbors (4-directional)
    const neighbors = [
      { col: current.col - 1, row: current.row },
      { col: current.col + 1, row: current.row },
      { col: current.col, row: current.row - 1 },
      { col: current.col, row: current.row + 1 },
    ];

    for (const n of neighbors) {
      if (n.col < 0 || n.col >= zone.width || n.row < 0 || n.row >= zone.height) continue;
      if (!grid[n.row]?.[n.col]) continue;
      if (closedSet.has(key(n.col, n.row))) continue;

      const tentativeG = current.g + 1;
      const existing = openSet.find(o => o.col === n.col && o.row === n.row);

      if (existing) {
        if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(n.col, n.row, endCol, endRow);
        openSet.push({
          col: n.col,
          row: n.row,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  return []; // No path found
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan distance
}

function reconstructPath(node: PathNode): { col: number; row: number }[] {
  const path: { col: number; row: number }[] = [];
  let current: PathNode | null = node;
  while (current) {
    path.unshift({ col: current.col, row: current.row });
    current = current.parent;
  }
  // Remove start position
  if (path.length > 0) path.shift();
  return path;
}

function findNearestWalkable(
  grid: boolean[][],
  col: number,
  row: number,
  width: number,
  height: number,
): { col: number; row: number } | null {
  // BFS outward from target to find nearest walkable
  for (let dist = 1; dist < 10; dist++) {
    for (let dx = -dist; dx <= dist; dx++) {
      for (let dy = -dist; dy <= dist; dy++) {
        if (Math.abs(dx) + Math.abs(dy) !== dist) continue;
        const nc = col + dx;
        const nr = row + dy;
        if (nc >= 0 && nc < width && nr >= 0 && nr < height && grid[nr]?.[nc]) {
          return { col: nc, row: nr };
        }
      }
    }
  }
  return null;
}

/**
 * Check if a tile is walkable
 * BUG-086: Now uses cached collision grid instead of iterating buildings
 */
export function isTileWalkable(zone: ZoneDef, col: number, row: number): boolean {
  if (col < 0 || col >= zone.width || row < 0 || row >= zone.height) return false;
  
  // BUG-086: Use cached walkability grid instead of recomputing
  const grid = buildWalkGrid(zone);
  return grid[row]?.[col] ?? false;
}
