import { Container, Text } from 'pixi.js';
import type { GameConfig } from '@core/config';
import type { SceneLayout } from './layout/sceneLayout';
import { parseColor } from './utils/color';

export class HudView extends Container {
  private readonly labelColor: number;
  private readonly baseLabelFontSize: number;
  private readonly baseValueFontSize: number;
  private readonly baseVerticalOffset: number;
  private readonly baseStackGap: number;
  private readonly baseSideOffset: number;
  private readonly baseSafeMargin: number;
  private readonly minTopReserve: number;

  private targetLabel: Text;
  private targetValue: Text;
  private scoreLabel: Text;
  private scoreValue: Text;
  private flowLabel: Text;
  private flowValue: Text;
  private nextLabel: Text;

  private currentLayout?: SceneLayout;
  private viewportSize?: { width: number; height: number };
  private labelScale = 1;
  private safeMargin: number;
  private currentFlowProgress = 0;
  private currentTopReserve = 120;
  private currentCountdownMs: number = 0;

  constructor(private readonly config: GameConfig) {
    super();

    this.labelColor = parseColor('#777E8D');
    const hud = this.config.hud ?? {
      labelFontSize: 20,
      valueFontSize: 30,
      topOffset: 30,
      stackGap: 6,
      sideOffset: 24,
      safeMargin: 16,
      minTopReserve: 40,
    };
    this.baseLabelFontSize = hud.labelFontSize;
    this.baseValueFontSize = hud.valueFontSize;
    this.baseVerticalOffset = hud.topOffset;
    this.baseStackGap = hud.stackGap;
    this.baseSideOffset = hud.sideOffset;
    this.baseSafeMargin = hud.safeMargin;
    this.minTopReserve = hud.minTopReserve;
    this.safeMargin = this.baseSafeMargin;

    this.targetLabel = this.createText(
      this.config.strings?.targetLabel ?? 'target',
      this.baseLabelFontSize
    );
    this.targetLabel.anchor.set(0, 0);

    this.targetValue = this.createText(this.formatTargetProgress(0), this.baseValueFontSize);
    this.targetValue.anchor.set(0, 1);

    this.scoreLabel = this.createText(
      this.config.strings?.scoreLabel ?? 'score',
      this.baseLabelFontSize
    );
    this.scoreLabel.anchor.set(1, 0);

    this.scoreValue = this.createText('0', this.baseValueFontSize);
    this.scoreValue.anchor.set(1, 1);

    this.flowLabel = this.createText(
      this.config.strings?.flowCountdownLabel ?? 'flow in',
      this.baseLabelFontSize
    );
    this.flowLabel.anchor.set(0.5, 0);

    this.flowValue = this.createText('0.0s', this.baseValueFontSize);
    this.flowValue.anchor.set(0.5, 1);

    this.nextLabel = this.createText(
      this.config.strings?.nextLabel ?? 'next',
      this.baseLabelFontSize
    );
    this.nextLabel.anchor.set(0.5, 0.5);
    this.nextLabel.rotation = -Math.PI / 2;

    this.addChild(
      this.targetLabel,
      this.targetValue,
      this.scoreLabel,
      this.scoreValue,
      this.flowLabel,
      this.flowValue,
      this.nextLabel
    );
  }

  updateScore(score: number) {
    if (this.scoreValue.text === `${score}`) {
      return;
    }
    this.scoreValue.text = `${score}`;
    this.refreshLayout();
  }

  updateFlowProgress(progress: number) {
    if (this.currentFlowProgress === progress) {
      return;
    }

    this.currentFlowProgress = progress;
    this.targetValue.text = this.formatTargetProgress(progress);
    this.refreshLayout();
  }

  updateFlowCountdown(msRemaining: number) {
    if (msRemaining < 0) {
      msRemaining = 0;
    }
    if (this.currentCountdownMs === msRemaining) {
      return;
    }
    this.currentCountdownMs = msRemaining;
    const seconds = Math.ceil(msRemaining / 100) / 10; // 1 decimal, ceiling-ish to avoid jumping to 0 too early
    this.flowValue.text = `${seconds.toFixed(1)}s`;
    this.refreshLayout();
  }

  getContentBounds(): { minX: number; maxX: number; minY: number; maxY: number } | undefined {
    const texts = [
      this.targetLabel,
      this.targetValue,
      this.scoreLabel,
      this.scoreValue,
      this.flowLabel,
      this.flowValue,
      this.nextLabel,
    ];
    if (texts.length === 0) {
      return undefined;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const text of texts) {
      const bounds = this.getTextBounds(text);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    return { minX, maxX, minY, maxY };
  }

  setLayout(layout: SceneLayout, viewportWidth: number, viewportHeight: number, tileSize: number) {
    this.currentLayout = layout;
    this.viewportSize = { width: viewportWidth, height: viewportHeight };
    this.updateFontSizes(tileSize);
    this.refreshLayout();
  }

  getTopReserve(): number {
    return Math.max(this.currentTopReserve, this.minTopReserve);
  }

  private refreshLayout() {
    if (!this.currentLayout) {
      return;
    }

    const { gridRect, gridPosition, queueRect, queuePosition } = this.currentLayout;
    const gridLeft = gridPosition.x - gridRect.contentWidth / 2 - gridRect.padding;
    const gridRight = gridPosition.x + gridRect.contentWidth / 2 + gridRect.padding;
    const gridTop = gridPosition.y - gridRect.outerHeight / 2;

    const verticalOffset = this.baseVerticalOffset * this.labelScale;
    const stackGap = this.baseStackGap * this.labelScale;
    const sideOffset = this.baseSideOffset * this.labelScale;
    const { maxY } = this.getVerticalBounds();
    const minY = Number.NEGATIVE_INFINITY;

    let maxStackHeight = 0;

    const targetX = this.clampHorizontal(gridLeft, 0);
    const targetStack = this.positionValueStack(
      this.targetValue,
      this.targetLabel,
      gridTop - verticalOffset,
      stackGap,
      minY,
      maxY
    );
    this.targetValue.position.set(targetX, targetStack.valueBottom);
    this.targetLabel.position.set(targetX, targetStack.labelTop);
    maxStackHeight = Math.max(maxStackHeight, targetStack.stackHeight);

    const centerX = this.clampHorizontal(gridPosition.x, 0.5);
    const flowStack = this.positionValueStack(
      this.flowValue,
      this.flowLabel,
      gridTop - verticalOffset,
      stackGap,
      minY,
      maxY
    );
    this.flowValue.position.set(centerX, flowStack.valueBottom);
    this.flowLabel.position.set(centerX, flowStack.labelTop);
    maxStackHeight = Math.max(maxStackHeight, flowStack.stackHeight);

    const scoreX = this.clampHorizontal(gridRight, 1);
    const scoreStack = this.positionValueStack(
      this.scoreValue,
      this.scoreLabel,
      gridTop - verticalOffset,
      stackGap,
      minY,
      maxY
    );
    this.scoreValue.position.set(scoreX, scoreStack.valueBottom);
    this.scoreLabel.position.set(scoreX, scoreStack.labelTop);
    maxStackHeight = Math.max(maxStackHeight, scoreStack.stackHeight);

    const queueLeft = queuePosition.x - queueRect.contentWidth / 2 - queueRect.padding;
    const nextX = this.clampHorizontal(queueLeft - sideOffset, 0.5);
    const nextY = this.clampBottom(queuePosition.y, this.nextLabel.height, minY, maxY);
    this.nextLabel.position.set(nextX, nextY);

    this.currentTopReserve = verticalOffset + maxStackHeight;
  }

  private createText(text: string, fontSize: number): Text {
    return new Text({
      text,
      style: {
        fontFamily: 'Arial',
        fontSize,
        fill: this.labelColor,
        align: 'left',
      },
    });
  }

  private formatTargetProgress(current: number): string {
    return `${current}/${this.config.gameplay.scoring.targetFlowLength}`;
  }

  private updateFontSizes(tileSize: number) {
    const scale = Math.max(0.6, Math.min(2, tileSize / 48));
    if (this.labelScale === scale) {
      return;
    }

    this.labelScale = scale;
    const labelSize = this.baseLabelFontSize * scale;
    const valueSize = this.baseValueFontSize * scale;

    this.targetLabel.style.fontSize = labelSize;
    this.targetValue.style.fontSize = valueSize;
    this.scoreLabel.style.fontSize = labelSize;
    this.scoreValue.style.fontSize = valueSize;
    this.flowLabel.style.fontSize = labelSize;
    this.flowValue.style.fontSize = valueSize;
    this.nextLabel.style.fontSize = labelSize;

    (this.targetLabel as any).updateText?.();
    (this.targetValue as any).updateText?.();
    (this.scoreLabel as any).updateText?.();
    (this.scoreValue as any).updateText?.();
    (this.flowLabel as any).updateText?.();
    (this.flowValue as any).updateText?.();
    (this.nextLabel as any).updateText?.();

    this.safeMargin = Math.max(this.baseSafeMargin, tileSize * 0.35);
  }

  private clampHorizontal(x: number, anchor: number): number {
    if (!this.viewportSize) {
      return x;
    }

    const halfWidth = this.viewportSize.width / 2;
    const min = -halfWidth + this.safeMargin;
    const max = halfWidth - this.safeMargin;

    if (anchor === 1) {
      return Math.min(Math.max(x, min), max);
    }

    if (anchor === 0) {
      return Math.max(Math.min(x, max), min);
    }

    return Math.max(Math.min(x, max), min);
  }

  private getVerticalBounds(): { minY: number; maxY: number } {
    if (!this.viewportSize) {
      return { minY: Number.NEGATIVE_INFINITY, maxY: Number.POSITIVE_INFINITY };
    }

    const halfHeight = this.viewportSize.height / 2;
    return {
      minY: -halfHeight + this.safeMargin,
      maxY: halfHeight - this.safeMargin,
    };
  }

  private clampBottom(desiredBottom: number, height: number, minY: number, maxY: number): number {
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return desiredBottom;
    }

    const minBottom = minY + height;
    const maxBottom = maxY;
    if (minBottom > maxBottom) {
      return (minBottom + maxBottom) / 2;
    }
    return Math.min(Math.max(desiredBottom, minBottom), maxBottom);
  }

  private positionValueStack(
    value: Text,
    label: Text,
    desiredBottom: number,
    stackGap: number,
    minY: number,
    maxY: number
  ): { valueBottom: number; labelTop: number; stackHeight: number } {
    let valueBottom = Math.min(desiredBottom, maxY);
    let valueTop = valueBottom - value.height;

    let labelTop = valueTop - stackGap - label.height;

    if (labelTop < minY) {
      const delta = minY - labelTop;
      valueBottom = Math.min(valueBottom + delta, maxY);
      valueTop = valueBottom - value.height;
      labelTop = valueTop - stackGap - label.height;
    }

    const stackHeight = label.height + stackGap + value.height;
    return { valueBottom, labelTop, stackHeight };
  }

  private getTextBounds(text: Text) {
    const width = text.width;
    const height = text.height;
    const anchorX = text.anchor?.x ?? 0;
    const anchorY = text.anchor?.y ?? 0;
    const minX = text.position.x - anchorX * width;
    const minY = text.position.y - anchorY * height;
    return {
      minX,
      maxX: minX + width,
      minY,
      maxY: minY + height,
    };
  }
}
