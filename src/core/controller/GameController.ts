import type { GameConfig } from '@core/config';
import type { GridTileSelectedPayload } from '@core/events';
import { log } from '@core/logger';
import { buildInitialBoard } from '@core/logic/boardBuilder';
import type { RNG as BoardRng } from '@core/logic/boardBuilder';
import { findLongestConnectedPath } from '@core/logic/pathfinding';
import type { PathNode, TileState, Rot } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';

type RNG = BoardRng; // Still not deterministic, i'll fix it later...
type AllowedConfigPiece = GameConfig['gameplay']['allowedPieces'][number];
type PlaceablePiece = Exclude<AllowedConfigPiece, 'start'>;

export class GameController {
  private readonly placeablePieces: ReadonlyArray<PlaceablePiece>;
  private gridData: TileState[][] = [];

  constructor(
    private readonly grid: GridPort,
    private config: GameConfig,
    private rng: RNG = Math.random
  ) {
    this.placeablePieces = this.config.gameplay.allowedPieces.filter(
      (p): p is PlaceablePiece => p !== 'start'
    );
    if (this.placeablePieces.length === 0) {
      log.error('At least one placeable piece (other than "start") must be configured');
      throw new Error('At least one placeable piece (other than "start") must be configured');
    }

    if (!this.validateConfig()) {
      log.error('Invalid game configuration');
      throw new Error('Invalid game configuration');
    }
    this.buildBoard();
    this.subscribeToEvents();
  }

  // --- Board Initialization Methods ---

  private buildBoard() {
    const { rows, cols } = this.config.grid;
    const { blockedTilesPercentage } = this.config.gameplay;

    const { gridData, blockedTiles } = buildInitialBoard({
      rows,
      cols,
      blockedTilesPercentage,
      rng: this.rng,
    });

    this.gridData = gridData;
    for (const { col, row } of blockedTiles) {
      this.grid.setAsBlocked(col, row);
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

    try {
      await tile.setPiece(piece, rotation);

      this.gridData[row][col].kind = piece;
      this.gridData[row][col].rot = rotation;

      this.onPlace();
    } catch (error) {
      log.error('Failed to place piece:', error);
    }
  };

  private getRandomPiece(): PlaceablePiece {
    if (this.placeablePieces.length === 0) {
      throw new Error('No placeable pieces available');
    }

    const index = Math.floor(this.rng() * this.placeablePieces.length);
    return this.placeablePieces[index];
  }

  private getRandomRotation(): Rot {
    const n = Math.floor(this.rng() * 4);
    return n as Rot;
  }

  private canPlace(col: number, row: number): boolean {
    if (row < 0 || row >= this.gridData.length || col < 0 || col >= this.gridData[row].length) {
      log.error('Invalid grid position');
      return false;
    }

    return !this.gridData[row][col].blocked;
  }

  private onPlace() {
    const best = findLongestConnectedPath(this.gridData);
    this.applyHighlight(best);
    if (best.length > 0) {
      console.log('best count:', best.length);
    } else {
      console.log('no path found');
    }
  }

  private applyHighlight(path: PathNode[]) {
    this.grid.setHighlight(path);
  }

  private validateConfig(): boolean {
    const { rows, cols } = this.config.grid;
    const { blockedTilesPercentage } = this.config.gameplay;

    if (!Number.isInteger(rows) || rows <= 0) {
      log.error('grid.rows must be a positive integer');
      return false;
    }
    if (!Number.isInteger(cols) || cols <= 0) {
      log.error('grid.cols must be a positive integer');
      return false;
    }
    if (blockedTilesPercentage < 0 || blockedTilesPercentage > 1) {
      log.error('gameplay.blockedTilesPercentage must be between 0 and 1');
      return false;
    }

    return true;
  }
}
