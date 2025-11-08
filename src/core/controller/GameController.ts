import type { GameConfig } from '@core/config';
import type { GridTileSelectedPayload } from '@core/events';
import { log } from '@core/logger';
import { buildInitialBoard } from '@core/logic/boardBuilder';
import type { RNG } from '@core/logic/boardBuilder';
import { findLongestConnectedPath } from '@core/logic/pathfinding';
import type { PathNode, TileState } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';
import { PipesQueue, type PipeQueueItem } from '@core/logic/pipesQueue';
import type { TileView } from '@view/TileView';

type AllowedConfigPipe = GameConfig['gameplay']['allowedPipes'][number];
type PlaceablePipe = Exclude<AllowedConfigPipe, 'start'>;

export class GameController {
  private readonly placeablePipes: ReadonlyArray<PlaceablePipe>;
  private readonly pipesQueue: PipesQueue;
  private gridData: TileState[][] = [];
  private _onPipesQueueChange?: (q: readonly PipeQueueItem[]) => void;
  set onPipesQueueChange(cb: ((q: readonly PipeQueueItem[]) => void) | undefined) {
    this._onPipesQueueChange = cb;
    if (cb) cb(this.pipesQueue.snapshotPipes());
  }

  constructor(
    private readonly grid: GridPort,
    private config: GameConfig,
    private rng: RNG = Math.random
  ) {
    if (!this.validateConfig()) {
      log.error('Invalid game configuration');
      throw new Error('Invalid game configuration');
    }

    this.placeablePipes = this.resolvePlaceablePipes();
    this.pipesQueue = this.createPipesQueue();

    this.buildBoard();
    this.subscribeToEvents();

    this._onPipesQueueChange?.(this.pipesQueue.snapshotPipes());
  }

  // --- Board Initialization Methods ---

  private resolvePlaceablePipes(): ReadonlyArray<PlaceablePipe> {
    const pipe = this.config.gameplay.allowedPipes.filter((p): p is PlaceablePipe => p !== 'start');
    if (pipe.length === 0) {
      log.error('At least one allowed pipe (other than "start") must be configured');
      throw new Error('At least one allowed pipe (other than "start") must be configured');
    }

    return pipe;
  }

  private createPipesQueue(): PipesQueue {
    return new PipesQueue(this.config.queue.queueSize, this.rng, this.placeablePipes);
  }

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
    if (!this.canPlacePipe(col, row)) {
      return;
    }

    if (await this.tryPlacePipe(col, row, tile)) {
      this.onPlace();
    }
  };

  private canPlacePipe(col: number, row: number): boolean {
    if (row < 0 || row >= this.gridData.length || col < 0 || col >= this.gridData[row].length) {
      log.error('Invalid grid position');
      return false;
    }

    return !this.gridData[row][col].blocked;
  }

  private async tryPlacePipe(col: number, row: number, tile: TileView): Promise<boolean> {
    const pipe = this.pipesQueue.peekPipe();
    if (!pipe) {
      log.error('No pipes available to place');
      return false;
    }

    try {
      await tile.setPipe(pipe.kind, pipe.rot);

      this.gridData[row][col].kind = pipe.kind;
      this.gridData[row][col].rot = pipe.rot;

      this.pipesQueue.popAndPushPipe();
      this._onPipesQueueChange?.(this.pipesQueue.snapshotPipes());

      return true;
    } catch (error) {
      log.error('Failed to place pipe:', error);
      return false;
    }
  }

  private onPlace() {
    const best = findLongestConnectedPath(this.gridData);
    this.applyHighlight(best);
    if (best.length > 0) {
      log.info('best count:', best.length);
    } else {
      log.info('no path found');
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

  // --- Pipes Queue Methods ---
  getQueueSnapshot() {
    return this.pipesQueue.snapshotPipes();
  }
}
