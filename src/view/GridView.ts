import { Container } from 'pixi.js';
import type { GridPort } from '@core/ports/GridPort';
import { TileView } from './TileView';

export class GridView extends Container implements GridPort {
  private tiles: TileView[][] = [];
  private blockedTiles: boolean[][] = [];

  constructor(
    private rows: number,
    private cols: number,
    private tileSize: number,
    private gap: number = 0
  ) {
    super();
    this.blockedTiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => false)
    );
  }

  async init() {
    try {
      const tilePromises: Promise<void>[] = [];

      for (let y = 0; y < this.rows; y++) {
        const row: TileView[] = [];
        for (let x = 0; x < this.cols; x++) {
          const tile = new TileView(this.tileSize, y, x);
          tile.position.set(x * (this.tileSize + this.gap), y * (this.tileSize + this.gap));
          this.addChild(tile);
          row.push(tile);

          tilePromises.push(tile.init());
          this.setupClickEvent(tile);
        }
        this.tiles.push(row);
      }
      await Promise.all(tilePromises);
    } catch (error) {
      this.removeChildren();
      this.tiles = [];
      throw error;
    }
  }

  // --- Getters ---

  getTile(x: number, y: number): TileView | null {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
      return null;
    }

    return this.tiles[y][x];
  }

  // --- Block Getter/Setter Methods ---

  setAsBlocked(col: number, row: number) {
    const tile = this.tiles[row]?.[col];
    if (!tile) {
      return;
    }

    this.blockedTiles[row][col] = true;
    tile.setIsBlocked(true);
  }

  isBlocked(col: number, row: number): boolean {
    return !!this.blockedTiles[row]?.[col];
  }

  // --- Path Highlighting Methods ---
  setHighlight(path: ReadonlyArray<{ col: number; row: number }>) {
    for (const row of this.tiles) for (const t of row) t.setHighlighted(false);
    for (const n of path) this.tiles[n.row][n.col]?.setHighlighted(true);
  }

  // --- Initialization Methods ---

  private setupClickEvent(tile: TileView) {
    tile.on('tile:click', payload => {
      this.emit('grid:tileSelected', { ...payload, tile });
    });
  }
}
