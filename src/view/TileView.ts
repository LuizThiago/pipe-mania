import { Assets, Container, Sprite } from 'pixi.js';
import { ASSETS, Z_ORDERS } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';

export class TileView extends Container {
  private bg!: Sprite;
  private piece?: Sprite;
  private currentKind?: PipeKind;
  private currentRot: Rot = 0;
  private blocked: boolean = false;

  constructor(
    private tileSize: number = 100,
    private row: number,
    private col: number
  ) {
    super();
  }

  // --- Initialization Methods ---

  async init() {
    const [bgTex] = await Promise.all([Assets.load(ASSETS.empty)]);
    this.bg = new Sprite(bgTex);
    this.setupSpriteToTile(this.bg);
    this.addChild(this.bg);
    this.setupClickEvent();
  }

  private setupSpriteToTile(sprite: Sprite) {
    this.setSpriteAnchorPosition(sprite);
    this.setSpriteScale(sprite);
  }
  private setupClickEvent() {
    this.eventMode = 'static';
    this.on('pointertap', () => {
      this.emit('tile:click', { col: this.col, row: this.row });
    });
  }

  // --- Setters ---

  setIsBlocked(isBlocked: boolean) {
    this.blocked = isBlocked;
    this.bg.visible = !this.blocked;
  }

  async setPiece(kind: PipeKind = 'empty', rot: Rot = 0) {
    if (this.currentKind === kind && this.currentRot === rot) {
      return;
    }

    if (kind === 'empty') {
      this.clearPiece();
      return;
    }

    this.currentKind = kind;

    const tex = await Assets.load(ASSETS[kind]);

    if (!this.piece) {
      this.piece = new Sprite(tex);
      this.setupSpriteToTile(this.piece);
      this.addChild(this.piece);
      this.setChildIndex(this.bg, Z_ORDERS.tiles_bg);
      this.setChildIndex(this.piece, Z_ORDERS.pieces);
    } else {
      this.piece.texture = tex;
    }

    this.applyRotation(rot);
  }

  clearPiece(): void {
    if (!this.piece) return;

    this.removeChild(this.piece);
    this.piece.destroy();
    this.piece = undefined;
    this.currentKind = undefined;
    this.currentRot = 0;
  }

  // --- Helper Methods ---

  private applyRotation(rot: Rot): void {
    if (!this.piece || this.currentRot === rot) return;

    this.currentRot = rot;
    this.piece.rotation = (Math.PI / 2) * rot;
  }

  private setSpriteAnchorPosition(sprite: Sprite) {
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(this.tileSize / 2, this.tileSize / 2);
  }

  private setSpriteScale(sprite: Sprite) {
    const w = sprite.texture.width || this.tileSize;
    const h = sprite.texture.height || this.tileSize;
    const sx = this.tileSize / w;
    const sy = this.tileSize / h;
    sprite.scale.set(sx, sy);
  }
}
