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
import { createSeededRng, hashStringToSeed } from '@core/rng';
import type { FlowCompletionPayload } from '@core/types';
import { WaterFlowController } from './WaterFlowController';

type AllowedConfigPipe = GameConfig['gameplay']['allowedPipes'][number];
type PlaceablePipe = Exclude<AllowedConfigPipe, 'start'>;
type TileCoordinate = { col: number; row: number };

export class GameController {
  private readonly placeablePipes: ReadonlyArray<PlaceablePipe>;
  private pipesQueue: PipesQueue;
  private gridData: TileState[][] = [];
  private startTile?: TileCoordinate;
  private stage: number = 1;
  private inputLocked: boolean = false;
  private readonly scoreController: ScoreController;
  private readonly waterFlowController: WaterFlowController;
  private _onPipesQueueChange?: (q: readonly PipeQueueItem[]) => void;
  private _onBeforeQueueShift?: (info: { col: number; row: number }) => Promise<void> | void;
  set onPipesQueueChange(cb: ((q: readonly PipeQueueItem[]) => void) | undefined) {
    this._onPipesQueueChange = cb;
    if (cb) cb(this.pipesQueue.snapshotPipes());
  }
  set onBeforeQueueShift(
    cb: ((info: { col: number; row: number }) => Promise<void> | void) | undefined
  ) {
    this._onBeforeQueueShift = cb;
  }

  private rngGrid: RNG = Math.random;
  private rngStart: RNG = Math.random;
  private rngQueue: RNG = Math.random;

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

    this.initRngForStage();

    this.pipesQueue = this.createPipesQueue();
    this.scoreController = new ScoreController(this.config.gameplay.scoring);
    this.updateDifficultyForCurrentStage();
    const fillDurationMs = this.config.water.fillDurationMs ?? 1000;
    this.waterFlowController = new WaterFlowController(
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
    return new PipesQueue(this.config.queue.queueSize, this.rngQueue, this.placeablePipes);
  }

  private async buildBoard() {
    const { rows, cols } = this.config.grid;
    const blockedTilesPercentage = this.getBlockedTilesPercentageForStage();

    const { gridData, blockedTiles } = buildInitialBoard({
      rows,
      cols,
      blockedTilesPercentage,
      rng: this.rngGrid,
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

    while (candidates.length > 0 && (!chosen || chosenRot === undefined)) {
      const index = Math.floor(this.rngStart() * candidates.length);
      const candidate = candidates.splice(index, 1)[0];
      const validRotations = this.getValidStartRotations(candidate);
      if (validRotations.length === 0) {
        continue;
      }

      chosen = candidate;
      chosenRot = validRotations[Math.floor(this.rngStart() * validRotations.length)];
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

    const state = this.gridData[row]?.[col];
    if (state?.kind === 'start') {
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
    if (state?.kind === 'start') {
      return false;
    }

    const wasReplacement = !!state?.kind && state.kind !== 'empty';

    try {
      await tile.setPipe(pipe.kind, pipe.rot);

      // Allow view to animate first queue item before we shift the queue
      if (this._onBeforeQueueShift) {
        try {
          await this._onBeforeQueueShift({ col, row });
        } catch (callbackError) {
          // Restore the previous state to keep view and model consistent
          const prevKind = state?.kind ?? 'empty';
          const prevRot = state?.rot ?? (0 as Rot);
          if (wasReplacement) {
            await tile.setPipe(prevKind, prevRot);
            this.gridData[row][col].kind = prevKind;
            this.gridData[row][col].rot = prevRot;
          } else {
            await tile.setPipe('empty', 0);
            this.gridData[row][col].kind = 'empty';
            this.gridData[row][col].rot = 0 as Rot;
          }
          throw callbackError;
        }
      }
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

    if (!Number.isInteger(rows) || rows <= 0) {
      log.error('grid.rows must be a positive integer');
      return false;
    }
    if (!Number.isInteger(cols) || cols <= 0) {
      log.error('grid.cols must be a positive integer');
      return false;
    }

    // Validate flowAutoStart if provided to prevent runaway/invalid values
    const difficulty = this.config.gameplay?.difficulty;
    const flowAutoStart = difficulty?.flowAutoStart;
    if (flowAutoStart) {
      const mult = flowAutoStart.multiplierPerStage;
      const minMs = flowAutoStart.minMs;
      if (!Number.isFinite(mult) || mult <= 0) {
        log.error(
          'gameplay.difficulty.flowAutoStart.multiplierPerStage must be a finite number > 0'
        );
        return false;
      }
      if (!Number.isFinite(minMs) || minMs < 0) {
        log.error('gameplay.difficulty.flowAutoStart.minMs must be a finite number >= 0');
        return false;
      }
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

  // --- Stage/Score Management ---
  getStage(): number {
    return this.stage;
  }

  setStage(next: number): void {
    this.stage = Math.max(1, Math.floor(next));
    this.initRngForStage();
    this.updateDifficultyForCurrentStage();
  }

  advanceStage(): void {
    this.stage = this.stage + 1;
    this.initRngForStage();
    this.updateDifficultyForCurrentStage();
  }

  resetScore(): void {
    this.scoreController.resetScore();
  }

  private getBlockedTilesPercentageForStage(): number {
    const diff = this.config.gameplay.difficulty;
    const start = diff.blockedPercentStart;
    const per = diff.blockedPercentPerStage;
    const max = diff.blockedPercentMax;
    const pct = start + Math.max(0, this.stage - 1) * per;
    return Math.max(0, Math.min(max, pct));
  }

  private updateDifficultyForCurrentStage(): void {
    const diff = this.config.gameplay.difficulty;
    const base = diff.targetLengthStart;
    const inc = diff.targetLengthPerStage;
    const cap = diff.targetLengthMax;
    const computed = Math.min(cap, base + Math.max(0, this.stage - 1) * inc);
    this.scoreController.setTargetFlowLength(computed);
  }

  getTargetFlowLength(): number {
    return this.scoreController.getTargetFlowLength();
  }

  getAutoStartDelayMs(): number {
    const baseRaw = this.config.water.autoStartDelayMs ?? 3000;
    const base = Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : 3000;

    // Reasonable hard cap to keep value bounded (1 minute)
    const HARD_CAP_MS = 60000;

    const diff = this.config.gameplay.difficulty;
    if (!diff || !diff.flowAutoStart) {
      return Math.min(base, HARD_CAP_MS);
    }

    // Safe defaults and guards
    const multRaw = diff.flowAutoStart.multiplierPerStage ?? 1;
    const minMsRaw = diff.flowAutoStart.minMs ?? 0;
    const mult = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1;
    const minMs = Number.isFinite(minMsRaw) && minMsRaw >= 0 ? minMsRaw : 0;

    const exponent = Math.max(0, this.stage - 1);
    const scaledRaw = base * Math.pow(mult, exponent);
    const scaledFinite = Number.isFinite(scaledRaw) && scaledRaw >= 0 ? scaledRaw : base;

    // Clamp to keep bounded and non-negative
    const minMsClamped = Math.min(Math.max(0, minMs), HARD_CAP_MS);
    const scaledClamped = Math.min(scaledFinite, HARD_CAP_MS);

    return Math.max(minMsClamped, scaledClamped);
  }

  setInputEnabled(enabled: boolean): void {
    this.inputLocked = !enabled;
  }

  isInputEnabled(): boolean {
    return !this.inputLocked;
  }

  async resetStage(): Promise<void> {
    for (let row = 0; row < this.gridData.length; row++) {
      for (let col = 0; col < (this.gridData[row]?.length ?? 0); col++) {
        try {
          await this.grid.setPipe(col, row, 'empty', 0);
        } catch {
          log.warn('Failed to clear pipe at', { col, row });
        }
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

    await this.buildBoard();

    this.pipesQueue = this.createPipesQueue();
    this._onPipesQueueChange?.(this.pipesQueue.snapshotPipes());

    this.inputLocked = false;
  }

  // Initializes per-stage RNG substreams derived from a base seed.
  // If no base seed is provided, falls back to Math.random for each stream.
  private initRngForStage(): void {
    const baseSeed = this.config.gameplay?.rngSeed;
    if (typeof baseSeed !== 'number') {
      this.rngGrid = this.rng;
      this.rngStart = this.rng;
      this.rngQueue = this.rng;
      return;
    }
    const stageStr = String(this.stage);
    const gridSeed = (baseSeed ^ hashStringToSeed('grid:' + stageStr)) >>> 0;
    const startSeed = (baseSeed ^ hashStringToSeed('start:' + stageStr)) >>> 0;
    const queueSeed = (baseSeed ^ hashStringToSeed('queue:' + stageStr)) >>> 0;

    this.rngGrid = createSeededRng(gridSeed);
    this.rngStart = createSeededRng(startSeed);
    this.rngQueue = createSeededRng(queueSeed);
  }
}
