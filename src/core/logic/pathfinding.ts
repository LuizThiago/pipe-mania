import { OPPOSED_DIRS } from '@core/constants';
import { getPorts } from '@core/logic/pipes';
import type { Dir, PathNode, TileState } from '@core/types';

type GridState = TileState[][];

export function findLongestConnectedPath(grid: GridState): PathNode[] {
  let best: PathNode[] = [];
  const visited = new Set<string>();

  const key = ({ col, row }: PathNode) => `${col},${row}`;

  const dfs = (node: PathNode, path: PathNode[]) => {
    const k = key(node);
    if (visited.has(k)) {
      return;
    }

    const tile = getTile(grid, node);
    if (!tile || !tile.kind || tile.blocked) {
      return;
    }

    // Depth-first search lets us reuse the same recursion stack to explore every
    // branch without allocating new path arrays for each fork. We rely on the
    // `path` reference being mutated in place to keep memory churn low.
    visited.add(k);
    path.push(node);

    const nextNodes = linkedNeighbors(grid, node).filter(nb => !visited.has(key(nb)));
    if (nextNodes.length === 0 && path.length > best.length) {
      best = [...path];
    }

    for (const nextNode of nextNodes) {
      dfs(nextNode, path);
    }

    path.pop();
    visited.delete(k);
  };

  for (let row = 0; row < grid.length; row++) {
    const cols = grid[row]?.length ?? 0;
    for (let col = 0; col < cols; col++) {
      const tile = grid[row]?.[col];
      if (tile && tile.kind && !tile.blocked) {
        dfs({ col, row }, []);
      }
    }
  }

  return best;
}

function linkedNeighbors(grid: GridState, node: PathNode): PathNode[] {
  const me = getTile(grid, node);
  if (!me || !me.kind || me.blocked) {
    return [];
  }

  const myPorts = getPorts(me.kind, me.rot ?? 0);
  const result: PathNode[] = [];

  for (const dir of myPorts) {
    const neighbor = neighborOf(grid, node, dir);
    if (!neighbor) {
      continue;
    }

    const other = getTile(grid, neighbor);
    if (!other || !other.kind || other.blocked) {
      continue;
    }

    // Only consider neighbors when the counterpart pipe exposes the opposing
    // port, which prevents diagonal leakage and guarantees bidirectional flow.
    const theirPorts = getPorts(other.kind, other.rot ?? 0);
    if (theirPorts.includes(OPPOSED_DIRS[dir])) {
      result.push(neighbor);
    }
  }

  return result;
}

function neighborOf(grid: GridState, { col, row }: PathNode, dir: Dir): PathNode | null {
  if (dir === 'top') {
    return isInBounds(grid, col, row - 1) ? { col, row: row - 1 } : null;
  }
  if (dir === 'right') {
    return isInBounds(grid, col + 1, row) ? { col: col + 1, row } : null;
  }
  if (dir === 'bottom') {
    return isInBounds(grid, col, row + 1) ? { col, row: row + 1 } : null;
  }
  if (dir === 'left') {
    return isInBounds(grid, col - 1, row) ? { col: col - 1, row } : null;
  }
  return null;
}

function isInBounds(grid: GridState, col: number, row: number): boolean {
  if (row < 0 || row >= grid.length) {
    return false;
  }

  const cols = grid[row]?.length ?? 0;
  return col >= 0 && col < cols;
}

function getTile(grid: GridState, { col, row }: PathNode): TileState | undefined {
  return grid[row]?.[col];
}
