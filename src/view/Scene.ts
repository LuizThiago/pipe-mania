import { Assets, Container } from 'pixi.js';
import { TileView } from './TileView';

export class Scene extends Container {
  constructor() {
    super();
    this.init();
  }

  private async init() {
    await this.loadAssets();

    // for testing purpose
    const tile = new TileView();
    await tile.init();
    await tile.setPiece('straight', 0);
    tile.position.set(10, 40);
    this.addChild(tile);

    const tile2 = new TileView();
    await tile2.init();
    await tile2.setPiece('empty', 0);
    tile2.position.set(130, 40);
    this.addChild(tile2);
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
