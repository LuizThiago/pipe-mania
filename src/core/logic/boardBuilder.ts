import { log } from '@core/logger';
import type { TileState } from '@core/types';

export type RNG = () => number;

type BoardDimensions = {
  rows: number;
  cols: number;
};

type BoardBuildParams = BoardDimensions & {
  blockedTilesPercentage: number; // Percentage of tiles to block (0.0 to 1.0)
  rng: RNG;
};

type BoardBuildResult = {
  gridData: TileState[][];
  blockedTiles: ReadonlyArray<{ col: number; row: number }>;
};

export function buildInitialBoard({
  rows,
  cols,
  blockedTilesPercentage,
  rng,
}: BoardBuildParams): BoardBuildResult {
  if (rows <= 0 || cols <= 0) {
    log.error('Invalid board dimensions:', { rows, cols });
    return {
      gridData: [],
      blockedTiles: [],
    };
  }

  const gridData = createEmptyGrid(rows, cols);
  const totalTiles = rows * cols;
  const maxBlockable = Math.max(totalTiles - 1, 0);
  const targetBlocks = Math.min(Math.floor(totalTiles * blockedTilesPercentage), maxBlockable);
  // Shuffling the full coordinate list once ensures sampling without replacement,
  // which keeps the blocked distribution uniform without repeatedly probing random cells.
  const cells = shuffleCells(getAllCells(rows, cols), rng);
  const blockedTiles = cells.slice(0, targetBlocks);

  for (let i = 0; i < blockedTiles.length; i++) {
    const { col, row } = blockedTiles[i];
    gridData[row][col].blocked = true;
  }

  return {
    gridData,
    blockedTiles,
  };
}

function createEmptyGrid(rows: number, cols: number): TileState[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, (): TileState => ({})));
}

function getAllCells(rows: number, cols: number): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

function shuffleCells(
  cells: Array<{ col: number; row: number }>,
  rng: RNG
): Array<{ col: number; row: number }> {
  // Fisher–Yates shuffle preserves uniform randomness even with a custom RNG,
  // which makes it suitable for deterministic seeds during tests.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}
