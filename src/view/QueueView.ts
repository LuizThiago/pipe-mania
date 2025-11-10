import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import type { PipeQueueItem } from '@core/logic/pipesQueue';
import { ASSETS } from '@core/constants';
import { animate, Easing, type CancelAnimation } from './utils/tween';
import type { GameConfig } from '@core/config';
import { log } from '@core/logger';

export class QueueView extends Container {
  private itemsContainer = new Container();
  private background?: Graphics;
  private visibleSlots: number;
  private currentQueueId = 0;
  private activeTweens: CancelAnimation[] = [];
  private flightCancel?: CancelAnimation;
  private readonly animOutMs: number;
  private readonly animMoveMs: number;
  private readonly animInMs: number;
  private flewOutSinceLastSet = false;
  private lastVisibleItems: PipeQueueItem[] = [];

  constructor(
    visibleSlots: number,
    private tileSize: number,
    private gap: number,
    private readonly backgroundPadding: number,
    private readonly backgroundCornerRadius: number,
    private readonly backgroundColor: number,
    private readonly config?: GameConfig
  ) {
    super();
    this.visibleSlots = Math.max(1, visibleSlots);
    this.animOutMs = this.config?.animations?.queueShiftOutMs ?? 180;
    this.animMoveMs = this.config?.animations?.queueShiftMoveMs ?? 220;
    this.animInMs = this.config?.animations?.queueShiftInMs ?? 220;
  }

  // ---- Lifecycle ----
  async init() {
    this.createBackground();
    this.addChild(this.itemsContainer);
    this.refreshLayout();
  }

  // ---- Public API ----
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

  clear() {
    this.stopTweens();
    this.cancelFlight();
    const old = this.itemsContainer.removeChildren() as Sprite[];
    for (const c of old) c.destroy();
    this.lastVisibleItems = [];
    this.flewOutSinceLastSet = false;
  }

  async setQueue(items: readonly PipeQueueItem[]) {
    const queueId = ++this.currentQueueId;
    const n = Math.min(items.length, this.visibleSlots);

    const existing = this.itemsContainer.children as Sprite[];
    if (existing.length === 0) {
      await this.renderInitial(items, n, queueId);
      this.flewOutSinceLastSet = false;
      this.lastVisibleItems = items.slice(0, n);
      return;
    }

    if (this.flewOutSinceLastSet) {
      await this.handleAfterFly(items, n, existing, queueId);
      this.lastVisibleItems = items.slice(0, n);
      return;
    }

    if (existing.length === n) {
      // Detect if this is a true "shift-left by one" scenario; otherwise, rebuild
      let isShift = this.lastVisibleItems.length === n;
      if (isShift) {
        for (let i = 0; i < n - 1; i++) {
          const prev = this.lastVisibleItems[i + 1];
          const curr = items[i];
          if (!prev || !curr || prev.kind !== curr.kind || prev.rot !== curr.rot) {
            isShift = false;
            break;
          }
        }
      }
      if (!isShift) {
        this.stopTweens();
        await this.rebuild(items, n, queueId);
        this.flewOutSinceLastSet = false;
        this.lastVisibleItems = items.slice(0, n);
        return;
      }
      await this.handleSmoothShift(items, n, existing, queueId);
      this.flewOutSinceLastSet = false;
      this.lastVisibleItems = items.slice(0, n);
      return;
    }

    this.stopTweens();
    await this.rebuild(items, n, queueId);
    this.flewOutSinceLastSet = false;
    this.lastVisibleItems = items.slice(0, n);
  }

  // ---- Layout Methods ----

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
      // Note: rotation is NOT updated here; it's set by prepareSprite and should not change on layout
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
      .roundRect(-pad, -pad, this.outerWidth, this.outerHeight, this.backgroundCornerRadius)
      .fill({ color: this.backgroundColor });
  }

  private centerPivot() {
    this.pivot.set(this.contentWidth / 2, this.contentHeight / 2);
    this.itemsContainer.position.set(0, 0);
  }

  // ---- Helpers ----

  private async renderInitial(
    items: readonly PipeQueueItem[],
    n: number,
    queueId: number
  ): Promise<void> {
    const textures = await this.loadTexturesSlice(items, n);
    if (queueId !== this.currentQueueId) return;
    for (let i = 0; i < n; i++) {
      const spr = new Sprite(textures[i]);
      this.prepareSprite(spr, items[i]);
      spr.position.set(this.slotX(i), this.slotY());
      this.itemsContainer.addChild(spr);
    }
  }

  private async handleAfterFly(
    items: readonly PipeQueueItem[],
    n: number,
    existing: Sprite[],
    queueId: number
  ): Promise<void> {
    this.flewOutSinceLastSet = false;
    this.stopTweens();

    const expectedPrevCount = Math.max(0, n - 1);
    const diff = existing.length - expectedPrevCount;
    if (diff !== 0 && diff !== 1) {
      log.warn('QueueView mismatch after fly; adjusting animations', {
        existingLength: existing.length,
        expectedPrevCount,
        n,
        itemsLength: items.length,
      });
    }

    // Number of leading sprites that should be considered "extras"
    // We keep at most 1 extra (the flying original at index 0); remove the rest.
    const offset = Math.max(0, existing.length - expectedPrevCount);
    if (offset > 1) {
      let toRemove = offset - 1;
      while (toRemove > 0 && this.itemsContainer.children.length > 0) {
        // Remove from index 1 to preserve the (invisible) flying original at index 0
        const child = this.itemsContainer.children[1] as Sprite | undefined;
        if (!child) break;
        this.itemsContainer.removeChild(child);
        child.destroy();
        toRemove--;
      }
    }

    // Refresh existing reference after potential removals
    existing = this.itemsContainer.children as Sprite[];

    // Animate only the safe overlap bound using item rotations, skipping any leading extras
    const overlap = Math.min(existing.length - offset, expectedPrevCount);
    for (let i = 0; i < overlap; i++) {
      const spr = existing[i + offset];
      const targetIndex = i; // shift left by 'offset' (usually 1) after a flight
      const startX = spr.x;
      const endX = this.slotX(targetIndex);

      const newRot = (Math.PI / 2) * items[targetIndex].rot;
      const startRot = spr.rotation;
      let delta = newRot - startRot;
      delta = ((delta + Math.PI) % (2 * Math.PI)) - Math.PI;

      this.activeTweens.push(
        animate(
          this.animMoveMs,
          t => {
            // Guard against sprite being removed/destroyed while animating
            if (!spr.parent || (spr as any).destroyed) {
              return;
            }
            spr.x = startX + (endX - startX) * t;
            spr.rotation = startRot + delta * t;
          },
          { easing: Easing.inOutSine }
        )
      );
    }

    // If there are trailing extras (unexpected), remove them to clamp to expected counts
    const maxAllowed = expectedPrevCount + Math.min(1, offset); // keep at most the flying original extra
    while (this.itemsContainer.children.length > maxAllowed) {
      const child = this.itemsContainer.children[this.itemsContainer.children.length - 1] as Sprite;
      this.itemsContainer.removeChild(child);
      child.destroy();
    }

    // If we have fewer sprites than expectedPrevCount, add as many as needed, then add the last item.
    if (existing.length < expectedPrevCount) {
      for (let i = existing.length; i < expectedPrevCount; i++) {
        // Each call adds the item at index i (since it adds the last among the first i+1 items)
        await this.addLastItemWithFadeIn(items, i + 1, queueId);
      }
    }

    // Finally add the new last visible item so the queue ends with n items.
    await this.addLastItemWithFadeIn(items, n, queueId);
  }

  private async handleSmoothShift(
    items: readonly PipeQueueItem[],
    n: number,
    existing: Sprite[],
    queueId: number
  ): Promise<void> {
    this.stopTweens();

    const out = existing[0];
    const outStartX = out.x;
    const outEndX = outStartX - (this.tileSize + this.gap) * 0.6;
    this.activeTweens.push(
      animate(
        this.animOutMs,
        t => {
          out.x = outStartX + (outEndX - outStartX) * t;
          out.alpha = 1 - t;
        },
        {
          easing: Easing.outCubic,
          onComplete: () => {
            if (out.parent === this.itemsContainer) {
              this.itemsContainer.removeChild(out);
              out.destroy();
            }
          },
        }
      )
    );

    for (let i = 1; i < n; i++) {
      const spr = existing[i];
      const targetIndex = i - 1;
      const startX = spr.x;
      const endX = this.slotX(targetIndex);

      const newRot = (Math.PI / 2) * items[targetIndex].rot;
      const startRot = spr.rotation;
      let delta = newRot - startRot;
      delta = ((delta + Math.PI) % (2 * Math.PI)) - Math.PI;

      this.activeTweens.push(
        animate(
          this.animMoveMs,
          t => {
            if (!spr.parent || (spr as any).destroyed) {
              return;
            }
            spr.x = startX + (endX - startX) * t;
            spr.rotation = startRot + delta * t;
          },
          { easing: Easing.inOutSine }
        )
      );
    }

    await this.addLastItemWithFadeIn(items, n, queueId);
  }

  private async rebuild(
    items: readonly PipeQueueItem[],
    n: number,
    queueId: number
  ): Promise<void> {
    // Prepare textures before touching current visuals to avoid flicker/holes
    const textures = await this.loadTexturesSlice(items, n);
    if (queueId !== this.currentQueueId) return;

    // Hide container during rebuild to avoid visual artifacts
    const wasVisible = this.itemsContainer.visible;
    this.itemsContainer.visible = false;

    // Swap content quickly (no awaits between remove and add)
    const old = this.itemsContainer.removeChildren() as Sprite[];
    for (const c of old) c.destroy();

    for (let i = 0; i < n; i++) {
      const spr = new Sprite(textures[i]);
      this.prepareSprite(spr, items[i]);
      spr.position.set(this.slotX(i), this.slotY());
      this.itemsContainer.addChild(spr);
    }

    // Show container again
    this.itemsContainer.visible = wasVisible;
  }

  private loadTexturesSlice(items: readonly PipeQueueItem[], n: number) {
    return Promise.all(items.slice(0, n).map(it => Assets.load(ASSETS[it.kind])));
  }

  private async addLastItemWithFadeIn(
    items: readonly PipeQueueItem[],
    n: number,
    queueId: number
  ): Promise<void> {
    const lastItem = items[n - 1];
    let tex;
    try {
      tex = await Assets.load(ASSETS[lastItem.kind]);
    } catch (error) {
      log.error('Failed to load queue item texture', {
        error,
        item: lastItem,
        kind: lastItem.kind,
      });
      return;
    }
    if (queueId !== this.currentQueueId) return;

    const last = new Sprite(tex);
    this.prepareSprite(last, lastItem);

    const lastTargetX = this.slotX(n - 1);
    const startX = lastTargetX + (this.tileSize + this.gap) * 0.8;
    last.position.set(startX, this.slotY());
    last.alpha = 0;
    this.itemsContainer.addChild(last);

    this.activeTweens.push(
      animate(
        this.animInMs,
        t => {
          last.x = startX + (lastTargetX - startX) * t;
          last.alpha = t;
        },
        { easing: Easing.outCubic }
      )
    );
  }

  private stopTweens() {
    for (const c of this.activeTweens) {
      c();
    }
    this.activeTweens = [];
  }

  private cancelFlight() {
    if (this.flightCancel) {
      this.flightCancel();
      this.flightCancel = undefined;
    }
  }

  private prepareSprite(sprite: Sprite, item: PipeQueueItem) {
    sprite.anchor.set(0.5);
    sprite.rotation = (Math.PI / 2) * item.rot;
    const base = Math.max(sprite.texture.width, sprite.texture.height) || 1;
    const scale = this.tileSize / base;
    sprite.scale.set(scale);
  }

  private slotX(i: number): number {
    return i * (this.tileSize + this.gap) + this.tileSize / 2;
  }

  private slotY(): number {
    return this.tileSize / 2;
  }

  flyFirstTo(targetInParent: { x: number; y: number }): Promise<void> {
    const first = this.itemsContainer.children[0] as Sprite | undefined;
    if (!first) {
      return Promise.resolve();
    }
    // Mark that we have a flight in progress so setQueue uses handleAfterFly
    this.flewOutSinceLastSet = true;
    this.stopTweens();
    const parent = this.parent ?? this;

    // Compute start in parent's coordinate space
    const startInParent = parent.toLocal({ x: first.x, y: first.y } as any, this);

    // Create a clone to fly while hiding the original to sell the illusion
    const clone = new Sprite(first.texture);
    clone.anchor.set(0.5);
    clone.rotation = first.rotation;
    clone.scale.set(first.scale.x, first.scale.y);
    clone.position.set(startInParent.x, startInParent.y);

    // Hide the original immediately so the slot looks empty during the flight
    first.visible = false;

    // Add clone above the queue (to parent)
    parent.addChild(clone);

    return new Promise<void>(resolve => {
      // Ensure only one flight tween at a time
      if (this.flightCancel) {
        this.flightCancel();
        this.flightCancel = undefined;
      }

      const baseScaleX = clone.scale.x;
      const baseScaleY = clone.scale.y;

      const cancelTween = animate(
        this.animMoveMs,
        t => {
          if (!clone.parent || (clone as any).destroyed) return;
          clone.x = startInParent.x + (targetInParent.x - startInParent.x) * t;
          clone.y = startInParent.y + (targetInParent.y - startInParent.y) * t;
          const s = 1 + 0.12 * t;
          clone.scale.set(baseScaleX * s, baseScaleY * s);
        },
        {
          easing: Easing.outCubic,
          onComplete: () => {
            // Cleanup clone
            if (clone.parent) {
              clone.parent.removeChild(clone);
            }
            clone.destroy();
            // Remove original from the queue container
            if (first.parent === this.itemsContainer) {
              this.itemsContainer.removeChild(first);
              first.destroy();
            }
            this.flewOutSinceLastSet = true;
            this.flightCancel = undefined;
            resolve();
          },
        }
      );
      // Keep flight cancel separate so queue tweens cancellation does not affect the flight.
      // Also ensure we cleanup the clone and restore the original visibility if cancelled.
      this.flightCancel = () => {
        cancelTween();
        if (clone.parent) {
          clone.parent.removeChild(clone);
        }
        clone.destroy();
        if (first && !first.destroyed) {
          first.visible = true;
        }
      };
    });
  }

  // ---- Getters ----

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
