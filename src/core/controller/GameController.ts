import type { GameConfig } from '@core/config';
import type { GridTileSelectedPayload } from '@core/events';
import type { GridView } from '@view/GridView';

type RNG = () => number; // Still not deterministic, i'll fix it later...

export class GameController {
  private readonly placeablePieces: GameConfig['gameplay']['allowedPieces'];

  constructor(
    private grid: GridView,
    private config: GameConfig,
    private rng: RNG = Math.random
  ) {
    this.placeablePieces = this.config.gameplay.allowedPieces.filter(piece => piece !== 'start');
    if (this.placeablePieces.length === 0) {
      throw new Error('At least one placeable piece (other than "start") must be configured');
    }
    this.initBoard();
    this.subscribeToEvents();
  }

  // --- Board Initialization Methods ---

  private initBoard() {
    const { cols, rows, blockedTilesPercentage } = this.config.grid;
    const total = cols * rows;
    const targetBlocksToBlock = Math.min(
      Math.floor(total * blockedTilesPercentage),
      Math.max(total - 1, 0)
    );

    let cells = this.getCells(this.config.grid.rows, this.config.grid.cols);
    cells = this.shuffleCells(cells);
    this.blockTiles(cells.slice(0, targetBlocksToBlock));
  }

  private getCells(rows: number, cols: number): Array<{ col: number; row: number }> {
    const cells: Array<{ col: number; row: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ col: c, row: r });
      }
    }

    return cells;
  }

  private shuffleCells(
    cells: Array<{ col: number; row: number }>
  ): Array<{ col: number; row: number }> {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells;
  }

  private blockTiles(targetCells: Array<{ col: number; row: number }>) {
    for (let i = 0; i < targetCells.length; i++) {
      this.grid.setAsBlocked(targetCells[i].col, targetCells[i].row);
    }
  }

  private subscribeToEvents() {
    this.grid.on('grid:tileSelected', this.handleTileSelected);
  }

  // --- Tile Interaction Methods ---

  private readonly handleTileSelected = async ({ col, row, tile }: GridTileSelectedPayload) => {
    if (!this.canPlace(col, row)) {
      return;
    }

    const piece = this.getRandomPiece();
    const rotation = this.getRandomRotation();

    await tile.setPiece(piece as any, rotation as 0 | 1 | 2 | 3);
  };

  private getRandomPiece(): GameConfig['gameplay']['allowedPieces'][number] {
    const index = Math.floor(this.rng() * this.placeablePieces.length);
    return this.placeablePieces[index];
  }

  private getRandomRotation(): 0 | 1 | 2 | 3 {
    const n = Math.floor(this.rng() * 4);
    return n as 0 | 1 | 2 | 3;
  }

  private canPlace(col: number, row: number): boolean {
    if (this.grid.isBlocked(col, row)) {
      return false;
    }

    return true;
  }
}
