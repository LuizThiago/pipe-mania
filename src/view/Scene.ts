import { Assets, Container } from 'pixi.js';
import { GridView } from './GridView';
import { randomPiece, randomRot } from '@core/pieces';
import { loadConfig } from '@core/config';

export class Scene extends Container {
  private config = loadConfig();

  constructor() {
    super();
    this.init();
  }

  private async init() {
    await this.loadAssets();

    const { cols, rows, tileSize } = this.config.grid;

    // GridView setup
    const gridView = new GridView(cols, rows, tileSize, 5);
    await gridView.init();
    this.addChild(gridView);

    gridView.on('grid:tileSelected', async ({ tile }) => {
      const kind = randomPiece();
      const rot = randomRot();
      await tile.setPiece(kind, rot);
    });
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
}
