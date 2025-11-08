import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { ASSETS, Z_ORDERS } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';
import { log } from '@core/logger';

export class TileView extends Container {
  private bg!: Sprite;
  private piece?: Sprite;
  private currentKind?: PipeKind;
  private currentRot: Rot = 0;
  private blocked: boolean = false;
  private highlight?: Graphics;

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

    const tex = await Assets.load(ASSETS[kind]);
    if (tex === undefined) {
      log.error('Asset not found for piece kind:', kind);
      return;
    }

    this.currentKind = kind;

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

  setHighlighted(on: boolean) {
    if (on) {
      if (!this.highlight) {
        const g = new Graphics();
        g.roundRect(0, 0, this.tileSize, this.tileSize, Math.min(12, this.tileSize * 0.12)).stroke({
          width: 4,
          color: 0x2b80ff,
          alpha: 0.9,
        });
        g.position.set(0, 0);
        this.highlight = g;
        this.addChild(g);
        this.setChildIndex(g, this.children.length - 1);
      }
      this.highlight.visible = true;
    } else if (this.highlight) {
      this.highlight.visible = false;
    }
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
