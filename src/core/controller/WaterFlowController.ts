import { log } from '@core/logger';
import { getPorts } from '@core/logic/pipes';
import { OPPOSED_DIRS } from '@core/constants';
import type { Dir, PipeKind, Rot, TileState, FlowTerminationReason } from '@core/types';
import type { GridPort } from '@core/ports/GridPort';
import type { ScoreController } from './ScoreController';

type TileCoordinate = { col: number; row: number };

export class WaterFlowController {
  private isFlowing = false;
  private activeAnimationFrame?: number;
  private readonly hasFlowFrom: Map<string, Set<Dir>> = new Map(); // Tracks which directions were already used when exiting a tile

  constructor(
    private readonly grid: GridPort,
    private readonly getGridData: () => TileState[][],
    private readonly getStartTile: () => TileCoordinate | undefined,
    private readonly fillDurationMs: number,
    private readonly scoreController: ScoreController
  ) {}

  async startWaterFlow(): Promise<void> {
    if (this.isFlowing) {
      return;
    }
    const startTile = this.getStartTile();
    if (!startTile) {
      log.error('No start tile configured');
      return;
    }

    this.isFlowing = true;
    this.hasFlowFrom.clear();
    this.scoreController.beginFlow();

    const gridData = this.getGridData();
    let current: TileCoordinate | undefined = { ...startTile };
    let incoming: Dir | undefined = undefined;
    let terminationReason: FlowTerminationReason = 'manualStop';

    // Read current tile, choose exit, animate fill, then advance to the next tile using the chosen direction.
    while (this.isFlowing && current) {
      const state = gridData[current.row]?.[current.col];
      if (!state || !state.kind || state.kind === 'empty') {
        log.info('Water flow stopped: missing pipe');
        terminationReason = 'missingPipe';
        break;
      }

      const tileKey = this.toKey(current);
      const filledDirs = this.hasFlowFrom.get(tileKey) ?? new Set<Dir>();

      const exit = this.determineExitDirection(state.kind, state.rot ?? 0, incoming, filledDirs);
      if (!exit) {
        log.info('Water flow stopped: no valid exit');
        terminationReason = 'noExit';
        break;
      }

      await this.animateTileFill(current.col, current.row, incoming, exit);

      if (!this.isFlowing) {
        terminationReason = 'manualStop';
        break;
      }

      filledDirs.add(exit);
      this.hasFlowFrom.set(tileKey, filledDirs);

      if (state.kind !== 'start') {
        this.scoreController.registerFlowStep({ tile: current, kind: state.kind });
      }

      const next = this.getNextCoordinates(current, exit);
      if (!next) {
        log.info('Water flow stopped: reached grid boundary');
        terminationReason = 'outOfBounds';
        break;
      }

      const nextState = gridData[next.row]?.[next.col];
      const incomingDir = this.getOpposite(exit);
      if (!this.canEnterTile(nextState, incomingDir)) {
        log.info('Water flow stopped: pipeline not connected');
        terminationReason = 'disconnected';
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
    this.scoreController.completeFlow(terminationReason);
  }

  stop(): void {
    this.isFlowing = false;
  }

  // Resolves the next direction to flow out of a tile.
  private determineExitDirection(
    kind: PipeKind,
    rot: Rot,
    incoming: Dir | undefined,
    filledDirs: Set<Dir>
  ): Dir | undefined {
    const ports = getPorts(kind, rot); // Get the available exit directions for the current tile

    if (kind === 'start') {
      return ports[0];
    }

    if (incoming === undefined || !ports.includes(incoming)) {
      return undefined;
    }

    if (kind === 'cross') {
      // Cross pipes prioritize straight-through flow, then fall back to alternate arms if needed.
      const primary = OPPOSED_DIRS[incoming];
      if (!filledDirs.has(primary)) {
        return primary;
      }
      const alternate = ports.find(
        dir => dir !== incoming && dir !== primary && !filledDirs.has(dir)
      );
      return alternate ?? primary;
    }

    // For other pipe types, we find the first available direction that hasn't been used yet.
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

    return new Promise<void>(resolve => {
      // We use a Promise to ensure the animation completes before the next tile is processed.
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
}
