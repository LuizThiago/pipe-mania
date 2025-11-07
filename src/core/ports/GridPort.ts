import type { GridTileSelectedPayload } from '@core/events';

export interface GridPort {
  setAsBlocked(col: number, row: number): void;
  isBlocked(col: number, row: number): boolean;
  setHighlight(path: ReadonlyArray<{ col: number; row: number }>): void;
  on(event: 'grid:tileSelected', handler: (payload: GridTileSelectedPayload) => void): void;
}
