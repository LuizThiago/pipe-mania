import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import type { PipeQueueItem } from '@core/logic/pipesQueue';
import { ASSETS } from '@core/constants';

export class QueueView extends Container {
  private itemsContainer = new Container();
  private background?: Graphics;
  private visibleSlots: number;
  private currentQueueId = 0;

  constructor(
    visibleSlots: number,
    private tileSize: number,
    private gap: number,
    private readonly backgroundPadding: number,
    private readonly backgroundCornerRadius: number,
    private readonly backgroundColor: number
  ) {
    super();
    this.visibleSlots = Math.max(1, visibleSlots);
  }

  async init() {
    this.createBackground();
    this.addChild(this.itemsContainer);
    this.refreshLayout();
  }

  setLayout(tileSize: number, gap: number) {
    if (tileSize <= 0) throw new Error('tileSize must be greater than zero');
    const changed = this.tileSize !== tileSize || this.gap !== gap;
    this.tileSize = tileSize;
    this.gap = gap;
    if (changed) this.refreshLayout();
  }

  setVisibleSlots(count: number) {
    const clamped = Math.max(1, count);
    if (this.visibleSlots === clamped) {
      return;
    }
    this.visibleSlots = clamped;
    this.refreshLayout();
  }

  async setQueue(items: readonly PipeQueueItem[]) {
    const queueId = ++this.currentQueueId;
    this.itemsContainer.removeChildren();

    const n = Math.min(items.length, this.visibleSlots);
    const textures = await Promise.all(items.slice(0, n).map(it => Assets.load(ASSETS[it.kind])));

    if (queueId !== this.currentQueueId) {
      return;
    }

    for (let i = 0; i < n; i++) {
      const it = items[i];
      const spr = new Sprite(textures[i]);

      spr.anchor.set(0.5);
      spr.rotation = (Math.PI / 2) * it.rot;

      const base = Math.max(spr.texture.width, spr.texture.height) || 1;
      const scale = this.tileSize / base;
      spr.scale.set(scale);

      const x = i * (this.tileSize + this.gap) + this.tileSize / 2;
      const y = this.tileSize / 2;
      spr.position.set(x, y);

      this.itemsContainer.addChild(spr);
    }
  }

  // --- Layout Methods ---

  private refreshLayout() {
    this.updateItemsLayout();
    this.updateBackground();
    this.centerPivot();
  }

  private updateItemsLayout() {
    for (let i = 0; i < this.itemsContainer.children.length; i++) {
      const sprite = this.itemsContainer.children[i] as Sprite;
      const x = i * (this.tileSize + this.gap) + this.tileSize / 2;
      const y = this.tileSize / 2;
      sprite.position.set(x, y);

      const base = Math.max(sprite.texture.width, sprite.texture.height) || 1;
      const scale = this.tileSize / base;
      sprite.scale.set(scale);
    }
  }

  private createBackground() {
    if (!this.background) {
      this.background = new Graphics();
      this.addChildAt(this.background, 0);
    }
  }

  private updateBackground() {
    this.createBackground();
    const pad = this.backgroundPadding;

    this.background!.clear()
      .beginFill(this.backgroundColor)
      .drawRoundedRect(-pad, -pad, this.outerWidth, this.outerHeight, this.backgroundCornerRadius)
      .endFill();
  }

  private centerPivot() {
    this.pivot.set(this.contentWidth / 2, this.contentHeight / 2);
    this.itemsContainer.position.set(0, 0);
  }

  // --- Layout Getters ---

  get contentWidth(): number {
    return this.visibleSlots * this.tileSize + (this.visibleSlots - 1) * this.gap;
  }

  get contentHeight(): number {
    return this.tileSize;
  }

  get outerWidth(): number {
    return this.contentWidth + this.backgroundPadding * 2;
  }

  get outerHeight(): number {
    return this.contentHeight + this.backgroundPadding * 2;
  }
}
