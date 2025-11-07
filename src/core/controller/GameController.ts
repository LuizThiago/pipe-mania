import type { GameConfig } from '@core/config';
import { OPPOSED_DIRS } from '@core/constants';
import type { GridTileSelectedPayload } from '@core/events';
import { getPorts } from '@core/logic/pipes';
import type { Dir, PipeKind, Rot } from '@core/types';
import type { GridView } from '@view/GridView';

type RNG = () => number; // Still not deterministic, i'll fix it later...
type XY = { col: number; row: number };

type TileData = {
  kind?: PipeKind;
  rot?: Rot;
  blocked?: boolean;
};

export class GameController {
  private readonly placeablePieces: GameConfig['gameplay']['allowedPieces'];
  private gridData: TileData[][] = [];

  constructor(
    private grid: GridView,
    private config: GameConfig,
    private rng: RNG = Math.random
  ) {
    this.placeablePieces = this.config.gameplay.allowedPieces.filter(piece => piece !== 'start');
    if (this.placeablePieces.length === 0) {
      throw new Error('At least one placeable piece (other than "start") must be configured');
    }
    this.initGridData();
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
      this.gridData[targetCells[i].row][targetCells[i].col].blocked = true;
    }
  }

  private initGridData() {
    const { cols, rows } = this.config.grid;
    this.gridData = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({})));
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

    this.gridData[row][col].kind = piece;
    this.gridData[row][col].rot = rotation;

    this.onPlace(col, row);
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
    return !this.gridData[row][col].blocked;
  }

  private onPlace(col: number, row: number) {
    const best = this.longestPath();
    this.applyHighlight(best);
    if (best.length > 0) {
      console.log('best count:', best.length);
    } else {
      console.log('no path found');
    }
  }

  private inBounds(c: number, r: number) {
    const { cols, rows } = this.config.grid;
    return c >= 0 && c < cols && r >= 0 && r < rows;
  }

  private longestPath(): XY[] {
    const { cols, rows } = this.config.grid;

    const key = (n: XY) => `${n.col},${n.row}`;

    let best: XY[] = [];
    const visited = new Set<string>();

    const dfs = (node: XY, path: XY[]) => {
      const k = key(node);
      if (visited.has(k)) return;

      visited.add(k);
      path.push(node);

      const nexts = this.linkedNeighbors(node).filter(nb => !visited.has(key(nb)));
      if (nexts.length === 0) {
        if (path.length > best.length) best = [...path];
      }

      for (const nb of nexts) {
        dfs(nb, path);
      }

      path.pop();
      visited.delete(k);
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = this.gridData[r][c];
        if (t.kind && !t.blocked) dfs({ col: c, row: r }, []);
      }
    }

    return best;
  }

  private linkedNeighbors(node: XY): XY[] {
    const me = this.gridData[node.row][node.col];
    if (!me.kind || me.blocked) return [];

    const myPorts = getPorts(me.kind, me.rot ?? 0);
    const result: XY[] = [];

    for (const dir of myPorts) {
      const nb = this.neighborOf(node, dir);
      if (!nb) continue;

      const other = this.gridData[nb.row][nb.col];
      if (!other || !other.kind || other.blocked) continue;

      const theirPorts = getPorts(other.kind, other.rot ?? 0);
      if (theirPorts.includes(OPPOSED_DIRS[dir])) {
        result.push(nb);
      }
    }
    return result;
  }

  private neighborOf({ col, row }: XY, dir: Dir): XY | null {
    if (dir === 'top' && this.inBounds(col, row - 1)) return { col, row: row - 1 };
    if (dir === 'right' && this.inBounds(col + 1, row)) return { col: col + 1, row };
    if (dir === 'bottom' && this.inBounds(col, row + 1)) return { col, row: row + 1 };
    if (dir === 'left' && this.inBounds(col - 1, row)) return { col: col - 1, row };
    return null;
  }

  private applyHighlight(path: XY[]) {
    this.grid.setHighlight(path);
  }
}
