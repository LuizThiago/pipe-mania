import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { ASSETS, Z_ORDERS } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';
import { log } from '@core/logger';

export class TileView extends Container {
  private bg!: Sprite;
  private pipe?: Sprite;
  private currentKind?: PipeKind;
  private currentRot: Rot = 0;
  private blocked: boolean = false;
  private highlight?: Graphics;

  constructor(
    private row: number,
    private col: number,
    private tileSize: number
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

  async setPipe(kind: PipeKind = 'empty', rot: Rot = 0) {
    if (this.currentKind === kind && this.currentRot === rot) {
      return;
    }

    if (kind === 'empty') {
      this.clearPipe();
      return;
    }

    const tex = await Assets.load(ASSETS[kind]);
    if (tex === undefined) {
      log.error('Asset not found for pipe kind:', kind);
      return;
    }

    this.currentKind = kind;

    if (!this.pipe) {
      this.pipe = new Sprite(tex);
      this.setupSpriteToTile(this.pipe);
      this.addChild(this.pipe);
      this.setChildIndex(this.bg, Z_ORDERS.tiles_bg);
      this.setChildIndex(this.pipe, Z_ORDERS.pipes);
    } else {
      this.pipe.texture = tex;
    }

    this.applyRotation(rot);
  }

  clearPipe(): void {
    if (!this.pipe) return;

    this.removeChild(this.pipe);
    this.pipe.destroy();
    this.pipe = undefined;
    this.currentKind = undefined;
    this.currentRot = 0;
  }

  setHighlighted(on: boolean) {
    if (on) {
      if (!this.highlight) {
        this.highlight = this.createHighlight();
        this.addChild(this.highlight);
        this.setChildIndex(this.highlight, this.children.length - 1);
      }
      this.highlight.visible = true;
    } else if (this.highlight) {
      this.highlight.visible = false;
    }
  }

  setTileSize(size: number) {
    if (this.tileSize === size) {
      return;
    }

    this.tileSize = size;

    if (this.bg) {
      this.setupSpriteToTile(this.bg);
    }
    if (this.pipe) {
      this.setupSpriteToTile(this.pipe);
    }
    this.refreshHighlight();
  }

  // --- Helper Methods ---

  private applyRotation(rot: Rot): void {
    if (!this.pipe || this.currentRot === rot) return;

    this.currentRot = rot;
    this.pipe.rotation = (Math.PI / 2) * rot;
  }

  private createHighlight(): Graphics {
    const g = new Graphics();
    this.drawHighlight(g);
    g.position.set(0, 0);
    return g;
  }

  private refreshHighlight() {
    if (!this.highlight) {
      return;
    }

    this.highlight.clear();
    this.drawHighlight(this.highlight);
  }

  private drawHighlight(target: Graphics) {
    target
      .roundRect(0, 0, this.tileSize, this.tileSize, Math.min(12, this.tileSize * 0.12))
      .stroke({
        width: Math.max(2, this.tileSize * 0.04),
        color: 0x2b80ff,
        alpha: 0.9,
      });
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
