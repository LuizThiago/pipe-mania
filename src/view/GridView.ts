import { Container, Graphics } from 'pixi.js';
import type { GridPort } from '@core/ports/GridPort';
import { TileView } from './TileView';
import type { GameConfig } from '@core/config';
import type { Dir, PipeKind, Rot } from '@core/types';

export class GridView extends Container implements GridPort {
  private tiles: TileView[][] = [];
  private blockedTiles: boolean[][] = [];
  private background?: Graphics;

  constructor(
    private readonly rows: number,
    private readonly cols: number,
    private tileSize: number,
    private gap: number,
    private readonly backgroundPadding: number,
    private readonly backgroundCornerRadius: number,
    private readonly backgroundColor: number,
    private readonly config: GameConfig
  ) {
    super();
    this.blockedTiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => false)
    );
  }

  async init() {
    try {
      const tilePromises: Promise<void>[] = [];

      this.ensureBackground();

      for (let y = 0; y < this.rows; y++) {
        const row: TileView[] = [];
        for (let x = 0; x < this.cols; x++) {
          const tile = new TileView(y, x, this.tileSize, this.config);
          tile.position.set(x * (this.tileSize + this.gap), y * (this.tileSize + this.gap));
          this.addChild(tile);
          row.push(tile);

          tilePromises.push(tile.init());
          this.setupClickEvent(tile);
        }
        this.tiles.push(row);
      }
      await Promise.all(tilePromises);
      this.refreshLayout();
    } catch (error) {
      this.removeChildren();
      this.tiles = [];
      throw error;
    }
  }

  // --- Layout Methods ---

  setLayout(tileSize: number, gap: number) {
    if (tileSize <= 0) {
      throw new Error('tileSize must be greater than zero');
    }

    const hasChanged = this.tileSize !== tileSize || this.gap !== gap;
    this.tileSize = tileSize;
    this.gap = gap;

    if (hasChanged) {
      this.refreshLayout();
    }
  }

  private refreshLayout() {
    this.updateTilesLayout();
    this.updateBackground();
    this.centerPivot();
  }

  private updateTilesLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];
        tile.position.set(x * (this.tileSize + this.gap), y * (this.tileSize + this.gap));
        tile.setTileSize(this.tileSize);
      }
    }
  }

  private centerPivot() {
    this.pivot.set(this.contentWidth / 2, this.contentHeight / 2);
  }

  private ensureBackground() {
    if (!this.background) {
      this.background = new Graphics();
      this.addChildAt(this.background, 0);
    }
  }

  private updateBackground() {
    this.ensureBackground();
    const padding = this.backgroundPadding;

    this.background!.clear()
      .roundRect(-padding, -padding, this.outerWidth, this.outerHeight, this.backgroundCornerRadius)
      .fill({ color: this.backgroundColor });
  }

  // --- Getters ---

  getTile(x: number, y: number): TileView | null {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
      return null;
    }

    return this.tiles[y][x];
  }

  // --- Getter/Setter Methods ---

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

  clearAllBlocks(): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.blockedTiles[y][x] = false;
        const tile = this.tiles[y]?.[x];
        tile?.setIsBlocked(false);
      }
    }
  }

  async setPipe(col: number, row: number, kind: PipeKind, rot: Rot) {
    const tile = this.tiles[row]?.[col];
    if (!tile) {
      return;
    }
    await tile.setPipe(kind, rot);
  }

  hasWaterFlow(col: number, row: number): boolean {
    const tile = this.tiles[row]?.[col];
    return tile?.hasWaterFlow() ?? false;
  }

  // --- Size Calculation Methods ---

  private get contentWidth(): number {
    return this.cols * this.tileSize + (this.cols - 1) * this.gap;
  }

  private get contentHeight(): number {
    return this.rows * this.tileSize + (this.rows - 1) * this.gap;
  }

  private get outerWidth(): number {
    return this.contentWidth + this.backgroundPadding * 2;
  }

  private get outerHeight(): number {
    return this.contentHeight + this.backgroundPadding * 2;
  }

  // --- Event Setup Methods ---

  private setupClickEvent(tile: TileView) {
    tile.on('tile:click', payload => {
      this.emit('grid:tileSelected', { ...payload, tile });
    });
  }

  // --- Water Methods ---

  forEachTile(cb: (t: TileView) => void) {
    for (const row of this.tiles) {
      for (const t of row) {
        cb(t);
      }
    }
  }

  setFillAll(p: number) {
    this.setAllWaterFill(p);
  }

  setWaterFillProgress(col: number, row: number, progress: number) {
    const tile = this.tiles[row]?.[col];
    tile?.setWaterFillProgress(progress);
  }

  setWaterFlow(col: number, row: number, entry?: Dir) {
    const tile = this.tiles[row]?.[col];
    tile?.setWaterFlow(entry);
  }

  finalizeWaterSegment(col: number, row: number, entry: Dir | undefined, exit: Dir) {
    const tile = this.tiles[row]?.[col];
    tile?.finalizeWaterSegment(entry, exit);
  }

  setAllWaterFill(progress: number) {
    this.forEachTile(t => t.setWaterFillProgress(progress));
  }
}
