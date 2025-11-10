import { Container } from 'pixi.js';
import type { GameConfig } from '@core/config';
import type { GridView } from '../GridView';
import { GhostTile } from '../GhostTile';
import type { PipeQueueItem } from '@core/logic/pipesQueue';

export class GhostController {
  private ghost?: GhostTile;
  private pointerHandler?: (e: any) => void;
  private _prevParentEventMode?: Container['eventMode'];

  constructor(
    private readonly contentRoot: Container,
    private readonly gridView: GridView,
    private readonly config: GameConfig
  ) {}

  init() {
    if (this.ghost) return;

    // Convert hex color string to number
    const colorString = this.config.animations?.ghostOutlineColor ?? '#2b80ff';
    const colorNumber = parseInt(colorString.replace('#', ''), 16);

    this.ghost = new GhostTile({
      lerpInside: this.config.animations?.ghostSnapLerpInside ?? 0.22,
      lerpOutside: this.config.animations?.ghostSnapLerpOutside ?? 0.14,
      pulseSpeed: this.config.animations?.ghostPulseSpeed ?? 0.05,
      outlineColor: colorNumber,
    });
    this.ghost.visible = false;
    this.contentRoot.addChild(this.ghost);
    this.enable();
  }

  destroy() {
    this.disable();
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = undefined;
    }
  }

  // ---- Pointer Handling ----
  enable() {
    if (this.pointerHandler) return;
    const parent = this.contentRoot.parent as Container | undefined;
    if (parent) {
      this._prevParentEventMode = parent.eventMode;
      parent.eventMode = 'static';
    }
    this.pointerHandler = (e: any) => {
      if (!this.ghost) return;
      const local = this.gridView.toLocal(e.global);
      const { col, row } = this.snapToGridCell(local);
      const center = this.gridView.getCellCenter(col, row);
      const posInRoot = this.contentRoot.toLocal(this.gridView.toGlobal(center));
      this.ghost.setTarget(posInRoot.x, posInRoot.y);
      const { width, height } = this.gridView.getContentSize();
      const inside = local.x >= 0 && local.y >= 0 && local.x <= width && local.y <= height;
      this.ghost.setVisibleInsideGrid(inside);
    };
    if (parent) {
      parent.on('pointermove', this.pointerHandler);
    }
  }

  disable() {
    if (!this.pointerHandler) return;
    const parent = this.contentRoot?.parent as Container | undefined;
    if (parent) {
      parent.off('pointermove', this.pointerHandler);
      if (this._prevParentEventMode !== undefined) {
        parent.eventMode = this._prevParentEventMode;
      }
    }
    this.pointerHandler = undefined;
    this._prevParentEventMode = undefined;
  }

  private snapToGridCell(localPos: { x: number; y: number }): { col: number; row: number } {
    const t = this.gridView.getTileSize();
    const g = this.gridView.getGap();
    const cols = this.gridView.getCols();
    const rows = this.gridView.getRows();
    const col = Math.max(0, Math.min(cols - 1, Math.round((localPos.x - t / 2) / (t + g))));
    const row = Math.max(0, Math.min(rows - 1, Math.round((localPos.y - t / 2) / (t + g))));
    return { col, row };
  }

  // ---- Public API ----
  updateFromQueueFirstItem(first: PipeQueueItem | undefined, tileSize: number) {
    if (!first || !this.ghost) return;
    this.ghost.setTileSize(tileSize);
    // Ghost is now just an outline, no need to set pipe type/rotation
  }

  setTileSize(tileSize: number) {
    if (!this.ghost) return;
    this.ghost.setTileSize(tileSize);
  }

  show() {
    if (this.ghost) this.ghost.visible = true;
  }

  hide() {
    if (this.ghost) this.ghost.visible = false;
  }

  getTargetPositionInContentRoot(): { x: number; y: number } | undefined {
    if (!this.ghost) return undefined;
    return { x: this.ghost.x, y: this.ghost.y };
  }

  getSnappedCell(): { col: number; row: number } | undefined {
    if (!this.ghost) return undefined;
    const posInGrid = this.gridView.toLocal(
      this.contentRoot.toGlobal({ x: this.ghost.x, y: this.ghost.y })
    );
    return this.snapToGridCell(posInGrid);
  }
}
