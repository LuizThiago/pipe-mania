import { Assets, Container } from 'pixi.js';
import { GridView } from './GridView';
import { loadConfig } from '@core/config';
import { GameController } from '@core/controller/GameController';

export class Scene extends Container {
  private config = loadConfig();
  private gridView?: GridView;
  private lastViewport?: { width: number; height: number };

  constructor() {
    super();
    this.init();
  }

  private async init() {
    await this.loadAssets();

    const { cols, rows } = this.config.grid;

    this.gridView = await this.setupGrid(rows, cols);

    new GameController(this.gridView, this.config);

    if (this.lastViewport) {
      this.applyResponsiveLayout(this.lastViewport.width, this.lastViewport.height);
    }
  }

  private async loadAssets() {
    await Assets.load([
      '/assets/pipes/tile.png',
      '/assets/pipes/straight-pipe.png',
      '/assets/pipes/curved-pipe.png',
      '/assets/pipes/cross-pipe.png',
      '/assets/pipes/start-pipe.png',
    ]);
  }

  private async setupGrid(rows: number, cols: number): Promise<GridView> {
    const initialTileSize = this.calculateTileSize(
      this.lastViewport?.width ?? 1024,
      this.lastViewport?.height ?? 768
    );
    const gridView = new GridView(
      rows,
      cols,
      initialTileSize,
      this.config.grid.tileGap ?? 5,
      this.config.grid.backgroundPadding ?? 16,
      this.config.grid.backgroundCornerRadius ?? 12
    );
    await gridView.init();
    this.positionGridAtCenter(gridView);
    this.addChild(gridView);
    return gridView;
  }

  private positionGridAtCenter(gridView: GridView) {
    gridView.position.set(0, 0);
  }

  onViewportResize(width: number, height: number) {
    this.lastViewport = { width, height };
    this.position.set(width / 2, height / 2);
    this.applyResponsiveLayout(width, height);
  }

  private applyResponsiveLayout(width: number, height: number) {
    if (!this.gridView) {
      return;
    }

    const tileSize = this.calculateTileSize(width, height);
    this.gridView.setLayout(tileSize, this.config.grid.tileGap ?? 5);
  }

  private calculateTileSize(width: number, height: number) {
    const { cols, rows } = this.config.grid;
    const gap = this.config.grid.tileGap ?? 0;
    const maxWidthRatio = this.config.grid.maxWidthRatio ?? 0.9;
    const maxHeightRatio = this.config.grid.maxHeightRatio ?? 0.9;
    const usableWidth = Math.max(width * maxWidthRatio - gap * (cols - 1), 1);
    const usableHeight = Math.max(height * maxHeightRatio - gap * (rows - 1), 1);

    const sizeFromWidth = usableWidth / cols;
    const sizeFromHeight = usableHeight / rows;

    const tileSize = Math.max(16, Math.min(sizeFromWidth, sizeFromHeight));
    return tileSize;
  }
}
