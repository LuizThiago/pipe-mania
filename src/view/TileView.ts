import { Assets, Container, Sprite } from 'pixi.js';
import { ASSETS, TILE_SIZE } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';

export class TileView extends Container {
  private bg!: Sprite;
  private piece?: Sprite;
  private currentKind?: PipeKind;
  private currentRot?: Rot = 0;

  async init() {
    const [bgTex] = await Promise.all([Assets.load(ASSETS.empty)]);
    this.bg = new Sprite(bgTex);
    this.setupSpriteToTile(this.bg);
    this.addChild(this.bg);
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
      let pieceSprite = new Sprite(tex);
      if (!pieceSprite) {
        throw new Error(`Failed to load texture for kind: ${kind}`);
      }

      this.piece = pieceSprite;
      this.setupSpriteToTile(this.piece);
      this.addChild(this.piece);
      this.setChildIndex(this.bg, 0);
      this.setChildIndex(this.piece, 1);
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

  private applyRotation(rot: Rot): void {
    if (!this.piece || this.currentRot === rot) return;

    this.currentRot = rot;
    this.piece.rotation = (Math.PI / 2) * rot;
  }

  private setupSpriteToTile(sprite: Sprite) {
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2);

    // scale the sprite to fit tile size
    const w = sprite.texture.width || TILE_SIZE;
    const h = sprite.texture.height || TILE_SIZE;
    const sx = TILE_SIZE / w;
    const sy = TILE_SIZE / h;
    sprite.scale.set(sx, sy);

    this.width = TILE_SIZE;
    this.height = TILE_SIZE;
  }
}
