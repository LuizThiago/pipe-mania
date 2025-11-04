import { Container } from 'pixi.js';
import { TileView } from './TileView';

export class Scene extends Container {
  constructor() {
    super();
    const tile = new TileView('straight');
    tile.position.set(40, 40);
    this.addChild(tile);
  }
}
