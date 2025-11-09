import { Assets, Container } from 'pixi.js';
import { loadConfig } from '@core/config';
import { GameController } from '@core/controller/GameController';
import { GridView } from './GridView';
import { QueueView } from './QueueView';
import { calculateSceneLayout } from './layout/sceneLayout';
import { parseColor } from './utils/color';

export class Scene extends Container {
  private config = loadConfig();
  private gridView?: GridView;
  private queueView?: QueueView;
  private gameController?: GameController;
  private lastViewport?: { width: number; height: number };

  constructor() {
    super();
    window.addEventListener('keydown', this.onKeyDown);
    this.init();
  }

  private async init() {
    await this.loadAssets();

    const { cols, rows } = this.config.grid;

    this.gridView = await this.createGrid(rows, cols);

    this.gameController = new GameController(this.gridView, this.config);
    await this.gameController.init();
    await this.createQueue(this.gameController);

    if (this.lastViewport) {
      this.applyResponsiveLayout(this.lastViewport.width, this.lastViewport.height);
    }
  }

  // --- Initialization Methods ---

  private async loadAssets() {
    await Assets.load([
      '/assets/pipes/tile.png',
      '/assets/pipes/straight-pipe.png',
      '/assets/pipes/curved-pipe.png',
      '/assets/pipes/cross-pipe.png',
      '/assets/pipes/start-pipe.png',
    ]);
  }

  private async createGrid(rows: number, cols: number): Promise<GridView> {
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
      this.config.grid.backgroundCornerRadius ?? 12,
      parseColor(this.config.grid.backgroundColor ?? '#CBE1DC'),
      this.config
    );
    await gridView.init();
    this.addChild(gridView);
    return gridView;
  }

  private async createQueue(gameController: GameController) {
    const visibleSlots = this.getVisibleQueueSlots();
    const qGap = this.config.queue.queueGap;
    const pad = this.config.grid.backgroundPadding ?? 16;
    const radius = this.config.grid.backgroundCornerRadius ?? 12;

    const tileSize = this.calculateTileSize(
      this.lastViewport?.width ?? 1024,
      this.lastViewport?.height ?? 768
    );

    this.queueView = new QueueView(
      visibleSlots,
      tileSize,
      qGap,
      pad,
      radius,
      parseColor(this.config.queue.queueBackgroundColor ?? '#DDEEEF')
    );
    await this.queueView.init();

    this.addChild(this.queueView);

    gameController.onPipesQueueChange = queuePipes => {
      this.queueView?.setQueue(queuePipes);
    };
  }

  // --- Layout Methods ---

  onViewportResize(width: number, height: number) {
    this.lastViewport = { width, height };
    this.position.set(width / 2, height / 2);
    this.applyResponsiveLayout(width, height);
  }

  // --- Layout Helpers ---

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

  private applyResponsiveLayout(width: number, height: number) {
    const tileSize = this.calculateTileSize(width, height);
    const gap = this.config.grid.tileGap ?? 5;

    // Grid
    if (!this.gridView) {
      return;
    }

    this.gridView.setLayout(tileSize, gap);

    // Queue
    if (!this.queueView) {
      return;
    }
    const visibleSlots = this.getVisibleQueueSlots();
    this.queueView.setVisibleSlots(visibleSlots);
    this.queueView.setLayout(tileSize, this.config.queue.queueGap);

    const layout = calculateSceneLayout(
      tileSize,
      this.config.grid,
      this.config.queue,
      visibleSlots
    );
    this.gridView.position.set(layout.gridPosition.x, layout.gridPosition.y);
    this.queueView.position.set(layout.queuePosition.x, layout.queuePosition.y);
  }

  private getVisibleQueueSlots(): number {
    const size = this.config.queue.queueSize;
    const maxVisible = this.config.queue.maxVisibleTiles ?? size;
    return Math.max(1, Math.min(size, maxVisible));
  }

  // --- TMP Methods ---

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'f') {
      void this.gameController?.startWaterFlow();
    }
  };
}
