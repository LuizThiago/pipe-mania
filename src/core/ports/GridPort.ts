import type { GridTileSelectedPayload } from '@core/events';
import type { Dir, PipeKind, Rot } from '@core/types';

export interface GridPort {
  setAsBlocked(col: number, row: number): void;
  isBlocked(col: number, row: number): boolean;
  setPipe(col: number, row: number, kind: PipeKind, rot: Rot): Promise<void>;
  setWaterFillProgress(col: number, row: number, progress: number): void;
  setWaterFlow(col: number, row: number, entry?: Dir): void;
  finalizeWaterSegment(col: number, row: number, entry: Dir | undefined, exit: Dir): void;
  setAllWaterFill(progress: number): void;
  setHighlight(path: ReadonlyArray<{ col: number; row: number }>): void;
  on(event: 'grid:tileSelected', handler: (payload: GridTileSelectedPayload) => void): void;
}
