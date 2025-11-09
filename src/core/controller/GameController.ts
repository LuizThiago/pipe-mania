import type { GameConfig } from '@core/config';
import type { GridTileSelectedPayload } from '@core/events';
import { log } from '@core/logger';
import { buildInitialBoard } from '@core/logic/boardBuilder';
import type { RNG } from '@core/logic/boardBuilder';
import { findLongestConnectedPath } from '@core/logic/pathfinding';
import type { Dir, PipeKind, Rot, TileState } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';
import { PipesQueue, type PipeQueueItem } from '@core/logic/pipesQueue';
import { getPorts } from '@core/logic/pipes';
import { OPPOSED_DIRS } from '@core/constants';

type AllowedConfigPipe = GameConfig['gameplay']['allowedPipes'][number];
type PlaceablePipe = Exclude<AllowedConfigPipe, 'start'>;
type TileCoordinate = { col: number; row: number };

export class GameController {
  private readonly placeablePipes: ReadonlyArray<PlaceablePipe>;
  private readonly pipesQueue: PipesQueue;
  private gridData: TileState[][] = [];
  private startTile?: TileCoordinate;
  private isFlowing = false;
  private activeAnimationFrame?: number;
  private readonly fillDurationMs: number;
  private _onPipesQueueChange?: (q: readonly PipeQueueItem[]) => void;
  set onPipesQueueChange(cb: ((q: readonly PipeQueueItem[]) => void) | undefined) {
    this._onPipesQueueChange = cb;
    if (cb) cb(this.pipesQueue.snapshotPipes());
  }
  private hasFlowFrom: Map<string, Set<Dir>> = new Map();

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
    this.fillDurationMs = this.config.water.fillDurationMs ?? 1000;
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
    if (this.isFlowing) {
      return;
    }
    if (!this.startTile) {
      log.error('No start tile configured');
      return;
    }

    this.isFlowing = true;
    this.hasFlowFrom.clear();

    let current: TileCoordinate | undefined = { ...this.startTile };
    let incoming: Dir | undefined = undefined;

    // The traversal walks the network tile by tile, relying on `incoming` and the
    // historical flow map to prevent oscillations when a pipe has more than one
    // valid exit (e.g. crosses). This keeps the simulation deterministic without
    // maintaining a full visited set.
    while (this.isFlowing && current) {
      const state = this.gridData[current.row]?.[current.col];
      if (!state || !state.kind || state.kind === 'empty') {
        log.info('Water flow stopped: missing pipe');
        break;
      }

      const tileKey = this.toKey(current);
      const filledDirs = this.hasFlowFrom.get(tileKey) ?? new Set<Dir>();

      const exit = this.determineExitDirection(state.kind, state.rot ?? 0, incoming, filledDirs);
      if (!exit) {
        log.info('Water flow stopped: no valid exit');
        break;
      }

      await this.animateTileFill(current.col, current.row, incoming, exit);

      if (!this.isFlowing) {
        break;
      }

      filledDirs.add(exit);
      this.hasFlowFrom.set(tileKey, filledDirs);

      const next = this.getNextCoordinates(current, exit);
      if (!next) {
        log.info('Water flow stopped: reached grid boundary');
        break;
      }

      const nextState = this.gridData[next.row]?.[next.col];
      const incomingDir = this.getOpposite(exit);
      if (!this.canEnterTile(nextState, incomingDir)) {
        log.info('Water flow stopped: pipeline not connected');
        break;
      }

      current = next;
      incoming = incomingDir;
    }

    if (this.activeAnimationFrame !== undefined) {
      cancelAnimationFrame(this.activeAnimationFrame);
      this.activeAnimationFrame = undefined;
    }

    this.isFlowing = false;
  }

  private determineExitDirection(
    kind: PipeKind,
    rot: Rot,
    incoming: Dir | undefined,
    filledDirs: Set<Dir>
  ): Dir | undefined {
    const ports = getPorts(kind, rot);

    if (kind === 'start') {
      return ports[0];
    }

    if (incoming === undefined) {
      return undefined;
    }

    if (!ports.includes(incoming)) {
      return undefined;
    }

    // Cross pipes can split water in multiple directions; we prioritize the
    // straight-through direction to preserve momentum, only falling back to the
    // secondary arms when the primary path was already consumed earlier.
    if (kind === 'cross') {
      const primary = OPPOSED_DIRS[incoming];
      if (!filledDirs.has(primary)) {
        return primary;
      }
      const alternate = ports.find(
        dir => dir !== incoming && dir !== primary && !filledDirs.has(dir)
      );
      return alternate ?? primary;
    }

    const candidate = ports.find(dir => dir !== incoming && !filledDirs.has(dir));
    return candidate ?? ports.find(dir => dir !== incoming) ?? incoming;
  }

  private canEnterTile(state: TileState | undefined, incoming: Dir): boolean {
    if (!state || state.blocked || !state.kind || state.kind === 'empty') {
      return false;
    }

    const ports = getPorts(state.kind, state.rot ?? 0);
    return ports.includes(incoming);
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

  private getOpposite(dir: Dir): Dir {
    return OPPOSED_DIRS[dir];
  }

  private async animateTileFill(col: number, row: number, entry: Dir | undefined, exit: Dir) {
    this.grid.setWaterFlow(col, row, entry);
    this.grid.setWaterFillProgress(col, row, 0);

    // Using requestAnimationFrame keeps the fill animation in sync with the
    // renderer while the Promise interface lets the caller await the visual
    // completion before advancing the fluid simulation to the next tile.
    return new Promise<void>(resolve => {
      let startTime: number | undefined;

      const step = (time: number) => {
        if (!this.isFlowing) {
          this.grid.setWaterFillProgress(col, row, 1);
          this.grid.finalizeWaterSegment(col, row, entry, exit);
          this.activeAnimationFrame = undefined;
          resolve();
          return;
        }

        if (startTime === undefined) {
          startTime = time;
        }

        const elapsed = time - startTime;
        const progress = Math.min(1, elapsed / this.fillDurationMs);
        this.grid.setWaterFlow(col, row, entry);
        this.grid.setWaterFillProgress(col, row, progress);

        if (progress >= 1) {
          this.grid.finalizeWaterSegment(col, row, entry, exit);
          this.activeAnimationFrame = undefined;
          resolve();
          return;
        }

        this.activeAnimationFrame = requestAnimationFrame(step);
      };

      this.activeAnimationFrame = requestAnimationFrame(step);
    });
  }

  private toKey(coord: TileCoordinate): string {
    return `${coord.col}:${coord.row}`;
  }

  // --- Pipes Queue Methods ---
  getQueueSnapshot() {
    return this.pipesQueue.snapshotPipes();
  }
}
