import { Assets, Container } from 'pixi.js';
import { GridView } from './GridView';
import { loadConfig } from '@core/config';
import { GameController } from '@core/controller/GameController';

export class Scene extends Container {
  private config = loadConfig();
  private gridView?: GridView;

  constructor() {
    super();
    this.init();
  }

  private async init() {
    await this.loadAssets();

    const { cols, rows, tileSize } = this.config.grid;

    this.gridView = await this.setupGrid(cols, rows, tileSize);

    new GameController(this.gridView, this.config);
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

  private async setupGrid(cols: number, rows: number, tileSize: number): Promise<GridView> {
    const gridView = new GridView(cols, rows, tileSize, this.config.grid.tileGap ?? 5);
    await gridView.init();
    this.addChild(gridView);
    return gridView;
  }
}
