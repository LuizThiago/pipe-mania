import type { GameConfig } from '@core/config';
import type { GridTileSelectedPayload } from '@core/events';
import { log } from '@core/logger';
import { buildInitialBoard } from '@core/logic/boardBuilder';
import type { RNG } from '@core/logic/boardBuilder';
import { findLongestConnectedPath } from '@core/logic/pathfinding';
import type { Dir, Rot, TileState } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';
import { PipesQueue, type PipeQueueItem } from '@core/logic/pipesQueue';
import { getPorts } from '@core/logic/pipes';
import { ScoreController } from './ScoreController';
import type { FlowCompletionPayload } from '@core/types';
import { WaterFlowController } from './WaterFlowController';

type AllowedConfigPipe = GameConfig['gameplay']['allowedPipes'][number];
type PlaceablePipe = Exclude<AllowedConfigPipe, 'start'>;
type TileCoordinate = { col: number; row: number };

export class GameController {
  private readonly placeablePipes: ReadonlyArray<PlaceablePipe>;
  private readonly pipesQueue: PipesQueue;
  private gridData: TileState[][] = [];
  private startTile?: TileCoordinate;
  private inputLocked: boolean = false;
  private readonly scoreController: ScoreController;
  private readonly waterFlowController: WaterFlowController;
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
    this.scoreController = new ScoreController(this.config.gameplay.scoring);
    const fillDurationMs = this.config.water.fillDurationMs ?? 1000;
    this.waterFlowController = new WaterFlowController( // Water flow is delegated to a dedicated controller. We inject getters for `gridData` and `startTile` to it
      this.grid,
      () => this.gridData,
      () => this.startTile,
      fillDurationMs,
      this.scoreController
    );
  }

  async init() {
    await this.buildBoard();
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

  private async buildBoard() {
    const { rows, cols } = this.config.grid;
    const { blockedTilesPercentage } = this.config.gameplay;

    const { gridData, blockedTiles } = buildInitialBoard({
      rows,
      cols,
      blockedTilesPercentage,
      rng: this.rng,
    });

    this.gridData = gridData;
    this.grid.clearAllBlocks();
    for (const { col, row } of blockedTiles) {
      this.grid.setAsBlocked(col, row);
    }

    await this.placeStartTile();
  }

  private async placeStartTile() {
    const candidates: TileCoordinate[] = [];
    for (let row = 0; row < this.gridData.length; row++) {
      for (let col = 0; col < this.gridData[row].length; col++) {
        const state = this.gridData[row][col];
        if (!state.blocked) {
          candidates.push({ col, row });
        }
      }
    }

    if (candidates.length === 0) {
      log.error('No available tile to place the start pipe');
      return;
    }

    let chosen: TileCoordinate | undefined;
    let chosenRot: Rot | undefined;

    // Random sampling keeps the placement unpredictable while naturally rejecting
    // dead ends. I intentionally mutate the candidates list to avoid revisiting
    // positions that were already proven invalid for every rotation.
    while (candidates.length > 0 && (!chosen || chosenRot === undefined)) {
      const index = Math.floor(this.rng() * candidates.length);
      const candidate = candidates.splice(index, 1)[0];
      const validRotations = this.getValidStartRotations(candidate);
      if (validRotations.length === 0) {
        continue;
      }

      chosen = candidate;
      chosenRot = validRotations[Math.floor(this.rng() * validRotations.length)];
    }

    if (!chosen || chosenRot === undefined) {
      log.error('No valid position found to place the start pipe');
      return;
    }

    this.startTile = chosen;
    const state = this.gridData[chosen.row][chosen.col];
    state.kind = 'start';
    state.rot = chosenRot;
    await this.grid.setPipe(chosen.col, chosen.row, 'start', chosenRot);
    this.grid.setWaterFlow(chosen.col, chosen.row, undefined);
    this.grid.setWaterFillProgress(chosen.col, chosen.row, 0);
  }

  private getValidStartRotations({ col, row }: TileCoordinate): Rot[] {
    const rotations: Rot[] = [];
    const totalRows = this.gridData.length;
    const totalCols = totalRows > 0 ? this.gridData[0].length : 0;

    for (let rotValue = 0; rotValue < 4; rotValue++) {
      const rot = rotValue as Rot;
      const exitDir = getPorts('start', rot)[0];
      const next = this.getNextCoordinates({ col, row }, exitDir);
      if (!next) {
        continue;
      }

      if (next.col < 0 || next.col >= totalCols || next.row < 0 || next.row >= totalRows) {
        continue;
      }

      const nextState = this.gridData[next.row][next.col];
      if (!nextState || nextState.blocked) {
        continue;
      }

      rotations.push(rot);
    }

    return rotations;
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
    if (this.inputLocked) {
      return false;
    }
    if (row < 0 || row >= this.gridData.length || col < 0 || col >= this.gridData[row].length) {
      log.error('Invalid grid position');
      return false;
    }

    return !this.grid.isBlocked(col, row) && !this.grid.hasWaterFlow(col, row);
  }

  private async tryPlacePipe(
    col: number,
    row: number,
    tile: GridTileSelectedPayload['tile']
  ): Promise<boolean> {
    const pipe = this.pipesQueue.peekPipe();
    if (!pipe) {
      log.error('No pipes available to place');
      return false;
    }

    const state = this.gridData[row]?.[col];
    const wasReplacement = !!state?.kind && state.kind !== 'empty' && state.kind !== 'start';

    try {
      await tile.setPipe(pipe.kind, pipe.rot);

      this.gridData[row][col].kind = pipe.kind;
      this.gridData[row][col].rot = pipe.rot;

      this.scoreController.handlePipePlacement({ wasReplacement });

      this.pipesQueue.popAndPushPipe();
      this._onPipesQueueChange?.(this.pipesQueue.snapshotPipes());

      return true;
    } catch (error) {
      log.error('Failed to place pipe:', error);
      return false;
    }
  }

  private onPlace() {
    findLongestConnectedPath(this.gridData);
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

  // --- Water Fill Sequence ---

  async startWaterFlow() {
    await this.waterFlowController.startWaterFlow();
  }

  private getNextCoordinates(current: TileCoordinate, exit: Dir): TileCoordinate | undefined {
    switch (exit) {
      case 'left':
        return { col: current.col - 1, row: current.row };
      case 'right':
        return { col: current.col + 1, row: current.row };
      case 'top':
        return { col: current.col, row: current.row - 1 };
      case 'bottom':
        return { col: current.col, row: current.row + 1 };
      default:
        return undefined;
    }
  }

  // --- Pipes Queue Methods ---

  getQueueSnapshot() {
    return this.pipesQueue.snapshotPipes();
  }

  // --- Score Controller Events and Getters ---

  set onScoreChange(listener: ((score: number) => void) | undefined) {
    this.scoreController.onScoreChange = listener;
  }

  set onFlowComplete(listener: ((payload: FlowCompletionPayload) => void) | undefined) {
    this.scoreController.onFlowComplete = listener;
  }

  set onFlowProgress(listener: ((progress: number) => void) | undefined) {
    this.scoreController.onFlowProgress = listener;
  }

  getScore(): number {
    return this.scoreController.getScore();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputLocked = !enabled;
  }

  async resetStage(): Promise<void> {
    // Clear all tiles (pipes and water)
    for (let row = 0; row < this.gridData.length; row++) {
      for (let col = 0; col < (this.gridData[row]?.length ?? 0); col++) {
        try {
          await this.grid.setPipe(col, row, 'empty', 0);
        } catch {
          // Best-effort; continue clearing others
        }
        // Reset in-memory state
        if (this.gridData[row] && this.gridData[row][col]) {
          this.gridData[row][col].kind = 'empty';
          this.gridData[row][col].rot = 0 as Rot;
          this.gridData[row][col].blocked = false;
        }
      }
    }
    this.grid.setAllWaterFill(0);
    this.grid.clearAllBlocks();
    this.startTile = undefined;

    // Rebuild board and start tile
    await this.buildBoard();

    // Reset the queue
    this.pipesQueue.reset();
    this._onPipesQueueChange?.(this.pipesQueue.snapshotPipes());

    // Re-enable input
    this.inputLocked = false;
  }
}
