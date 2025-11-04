import { Container, Graphics } from 'pixi.js';
import { TILE_BG, TILE_SIZE } from '../core/constants';

export type PipeKind = 'straight' | 'curve' | 't' | 'cross';

export class TileView extends Container {
  private bg = new Graphics();
  private pipeG = new Graphics();
  private waterG = new Graphics();
  private maskG = new Graphics();

  constructor(public kind: PipeKind) {
    super();
    this.addChild(this.bg, this.pipeG, this.waterG, this.maskG);
    this.waterG.mask = this.maskG;

    this.drawBg();
  }

  private drawBg() {
    this.bg.clear();
    this.bg.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(TILE_BG);
  }
}
