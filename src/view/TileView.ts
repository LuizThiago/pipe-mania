import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { ASSETS, Z_ORDERS } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';
import { log } from '@core/logger';
import type { GameConfig } from '@core/config';
import { TileWaterRenderer } from './water/TileWaterRenderer';

export class TileView extends Container {
  private bg!: Sprite;
  private pipe?: Sprite;
  private currentKind?: PipeKind;
  private currentRot: Rot = 0;
  private blocked: boolean = false;
  private highlight?: Graphics;
  private water?: Graphics;
  private waterRenderer?: TileWaterRenderer;
  private fillProgress: number = 0;

  constructor(
    private row: number,
    private col: number,
    private tileSize: number,
    private readonly config: GameConfig
  ) {
    super();
    this.sortableChildren = true;
  }

  // --- Initialization Methods ---

  async init() {
    await this.setupGraphics();
    if (this.waterRenderer) {
      this.waterRenderer.setTileSize(this.tileSize);
      if (this.currentKind && this.currentKind !== 'empty') {
        this.waterRenderer.setPipe(this.currentKind, this.currentRot);
      }
      if (this.fillProgress > 0) {
        this.waterRenderer.setFillProgress(this.fillProgress);
      } else {
        this.waterRenderer.clearFill();
      }
    }
    this.setupClickEvent();
  }

  private async setupGraphics() {
    // tile background
    const bgTex = await Assets.load(ASSETS.empty);
    this.bg = new Sprite(bgTex);
    this.setSpriteAnchorPosition(this.bg);
    this.setSpriteScale(this.bg);
    this.bg.zIndex = Z_ORDERS.tiles_bg;
    this.addChild(this.bg);

    // water layer
    this.water = new Graphics();
    this.water.zIndex = Z_ORDERS.water;
    this.water.visible = false;
    this.addChild(this.water);
    this.waterRenderer = new TileWaterRenderer(this.water, this.config.water);
    this.waterRenderer.setTileSize(this.tileSize);
    this.syncChildOrder();
  }

  private setupSpriteSizes(sprite: Sprite) {
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
      this.setupSpriteSizes(this.pipe);
      this.pipe.zIndex = Z_ORDERS.pipes;
      this.addChild(this.pipe);
    } else {
      this.pipe.texture = tex;
      this.setupSpriteSizes(this.pipe);
    }

    this.applyRotation(rot);
    this.syncChildOrder();
    this.waterRenderer?.setPipe(this.currentKind, this.currentRot);
    if (this.fillProgress > 0) {
      this.waterRenderer?.setFillProgress(this.fillProgress);
    } else {
      this.waterRenderer?.clearFill();
    }
  }

  clearPipe(): void {
    if (!this.pipe) return;

    this.removeChild(this.pipe);
    this.pipe.destroy();
    this.pipe = undefined;
    this.currentKind = undefined;
    this.currentRot = 0;
    this.fillProgress = 0;
    this.syncChildOrder();
    this.waterRenderer?.clearPipe();
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
      this.setupSpriteSizes(this.bg);
    }
    if (this.pipe) {
      this.setupSpriteSizes(this.pipe);
    }
    this.refreshHighlight();
    this.waterRenderer?.setTileSize(this.tileSize);
    if (this.fillProgress > 0) {
      this.waterRenderer?.setFillProgress(this.fillProgress);
    }
  }

  setWaterFillProgress(p: number) {
    const clamped = Math.max(0, Math.min(1, p));

    if (!this.pipe || !this.currentKind || this.currentKind === 'empty') {
      if (this.fillProgress !== 0) {
        this.fillProgress = 0;
        this.waterRenderer?.clearFill();
      }
      return;
    }

    if (clamped === 0) {
      if (this.fillProgress !== 0) {
        this.fillProgress = 0;
        this.waterRenderer?.clearFill();
      }
      return;
    }

    if (this.fillProgress === clamped) {
      return;
    }

    this.fillProgress = clamped;
    this.waterRenderer?.setFillProgress(clamped);
  }

  clearWaterFill() {
    this.setWaterFillProgress(0);
  }

  // --- Helper Methods ---

  private applyRotation(rot: Rot): void {
    if (!this.pipe || this.currentRot === rot) return;

    this.currentRot = rot;
    this.pipe.rotation = (Math.PI / 2) * rot;
    this.waterRenderer?.setRotation(this.currentRot);
    if (this.fillProgress > 0) {
      this.waterRenderer?.setFillProgress(this.fillProgress);
    }
  }

  private syncChildOrder() {
    this.bg.zIndex = Z_ORDERS.tiles_bg;
    if (this.pipe) {
      this.pipe.zIndex = Z_ORDERS.pipes;
    }
    if (this.water) {
      this.water.zIndex = Z_ORDERS.water;
    }
    this.sortChildren();
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
