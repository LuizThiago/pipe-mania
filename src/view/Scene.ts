import { Assets, Container } from 'pixi.js';
import { loadConfig } from '@core/config';
import { GameController } from '@core/controller/GameController';
import { GridView } from './GridView';
import { QueueView } from './QueueView';
import { calculateSceneLayout, type SceneLayout } from './layout/sceneLayout';
import { parseColor } from './utils/color';
import { HudView } from './HudView';

export class Scene extends Container {
  private config = loadConfig();
  private gridView?: GridView;
  private queueView?: QueueView;
  private gameController?: GameController;
  private lastViewport?: { width: number; height: number };
  private hudView?: HudView;
  private hudTopReserve: number;
  private readonly contentRoot: Container;

  constructor() {
    super();
    this.contentRoot = new Container();
    this.addChild(this.contentRoot);
    this.hudTopReserve = this.config.hud?.minTopReserve ?? 160;
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
    this.createHud(this.gameController);

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
    this.contentRoot.addChild(gridView);
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

    this.contentRoot.addChild(this.queueView);

    gameController.onPipesQueueChange = queuePipes => {
      this.queueView?.setQueue(queuePipes);
    };
  }

  private createHud(gameController: GameController) {
    this.hudView = new HudView(this.config);
    this.contentRoot.addChild(this.hudView);

    gameController.onScoreChange = score => {
      this.hudView?.updateScore(score);
    };

    gameController.onFlowProgress = progress => {
      this.hudView?.updateFlowProgress(progress);
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
    const horizontalReserve = Math.max(width * 0.08, 160);
    const verticalReserve = Math.max(height * 0.06, this.hudTopReserve);

    const maxGridWidth = Math.max(
      Math.min(width * maxWidthRatio, width - horizontalReserve * 2),
      gap * (cols - 1) + 1
    );
    const maxGridHeight = Math.max(height * maxHeightRatio - verticalReserve, 1);

    const usableWidth = Math.max(maxGridWidth - gap * (cols - 1), 1);
    const usableHeight = Math.max(maxGridHeight - gap * (rows - 1), 1);

    const sizeFromWidth = usableWidth / cols;
    const sizeFromHeight = usableHeight / rows;

    return Math.max(16, Math.min(sizeFromWidth, sizeFromHeight));
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
    this.hudView?.setLayout(layout, width, height, tileSize);
    if (this.hudView) {
      this.hudTopReserve = Math.max(96, this.hudView.getTopReserve());
    }
    this.centerContent(layout);
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

  private centerContent(layout: SceneLayout) {
    const gridBounds = this.resolveGridBounds(layout);
    const queueBounds = this.resolveQueueBounds(layout);
    const hudLocalBounds = this.hudView?.getContentBounds();
    const hudBounds = hudLocalBounds
      ? this.translateBounds(hudLocalBounds, this.hudView!.position)
      : undefined;

    let minX = Math.min(gridBounds.minX, queueBounds.minX);
    let maxX = Math.max(gridBounds.maxX, queueBounds.maxX);
    let minY = Math.min(gridBounds.minY, queueBounds.minY);
    let maxY = Math.max(gridBounds.maxY, queueBounds.maxY);

    if (hudBounds) {
      minX = Math.min(minX, hudBounds.minX);
      maxX = Math.max(maxX, hudBounds.maxX);
      minY = Math.min(minY, hudBounds.minY);
      maxY = Math.max(maxY, hudBounds.maxY);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.contentRoot.position.set(-centerX, -centerY);
  }

  private resolveGridBounds(layout: SceneLayout) {
    const { gridRect, gridPosition } = layout;
    const halfWidth = gridRect.outerWidth / 2;
    const halfHeight = gridRect.outerHeight / 2;
    return {
      minX: gridPosition.x - halfWidth,
      maxX: gridPosition.x + halfWidth,
      minY: gridPosition.y - halfHeight,
      maxY: gridPosition.y + halfHeight,
    };
  }

  private resolveQueueBounds(layout: SceneLayout) {
    const { queueRect, queuePosition } = layout;
    const halfWidth = queueRect.outerWidth / 2;
    const halfHeight = queueRect.outerHeight / 2;
    return {
      minX: queuePosition.x - halfWidth,
      maxX: queuePosition.x + halfWidth,
      minY: queuePosition.y - halfHeight,
      maxY: queuePosition.y + halfHeight,
    };
  }

  private translateBounds(
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    offset: { x: number; y: number }
  ) {
    return {
      minX: bounds.minX + offset.x,
      maxX: bounds.maxX + offset.x,
      minY: bounds.minY + offset.y,
      maxY: bounds.maxY + offset.y,
    };
  }
}
