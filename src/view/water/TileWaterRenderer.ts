import { Graphics } from 'pixi.js';
import type { Dir, PipeKind, Rot } from '@core/types';
import type { GameConfig } from '@core/config';
import { parseColor } from '../utils/color';
import { getPorts } from '@core/logic/pipes';
import { OPPOSED_DIRS } from '@core/constants';

type PipeGeometry = {
  size: number;
  edgeInset: number;
  channel: number;
  centerStartX: number;
  centerEndX: number;
  centerStartY: number;
  centerEndY: number;
  leftStart: number;
  rightStart: number;
  topStart: number;
  bottomStart: number;
  horizontalArm: number;
  verticalArm: number;
};

export class TileWaterRenderer {
  private tileSize = 0;
  private currentKind?: PipeKind;
  private currentRot: Rot = 0;
  private fillProgress = 0;
  private entryDir?: Dir;
  private geometry?: PipeGeometry;

  private readonly color: number;
  private readonly alpha: number;

  constructor(
    private readonly dynamicGraphics: Graphics,
    private readonly staticGraphics: Graphics,
    private readonly config: GameConfig['water']
  ) {
    this.color = parseColor(config.fillColor);
    this.alpha = Math.max(0, Math.min(1, config.fillAlpha));
    this.dynamicGraphics.visible = false;
    this.staticGraphics.visible = false;
  }

  setTileSize(size: number) {
    this.tileSize = size;
    this.geometry = undefined;
    this.render();
  }

  setPipe(kind: PipeKind | undefined, rot: Rot) {
    this.currentKind = kind;
    this.currentRot = rot;
    this.entryDir = undefined;
    if (!kind || kind === 'empty') {
      this.clearAllGraphics();
      return;
    }
    this.render();
  }

  setRotation(rot: Rot) {
    if (this.currentRot === rot) {
      return;
    }
    this.currentRot = rot;
    this.entryDir = undefined;
    this.render();
  }

  setEntryDirections(entry?: Dir) {
    this.entryDir = entry;
  }

  clearPipe() {
    this.currentKind = undefined;
    this.fillProgress = 0;
    this.entryDir = undefined;
    this.clearAllGraphics();
  }

  clearFill() {
    this.fillProgress = 0;
    this.entryDir = undefined;
    this.clearDynamicGraphics();
  }

  setFillProgress(progress: number) {
    const clamped = Math.max(0, Math.min(1, progress));

    if (!this.currentKind || this.currentKind === 'empty') {
      this.clearFill();
      return;
    }

    if (clamped === 0) {
      this.clearDynamicGraphics();
      return;
    }

    if (this.fillProgress === clamped) {
      return;
    }

    this.fillProgress = clamped;
    this.render();
  }

  commitPath(entry: Dir | undefined, exit: Dir) {
    if (!this.currentKind || this.currentKind === 'empty') {
      return;
    }
    const geometry = this.getGeometry();
    if (!geometry) {
      return;
    }
    this.staticGraphics.visible = true;
    this.staticGraphics.fill({ color: this.color, alpha: this.alpha });
    this.drawPath(this.staticGraphics, entry, exit, 1, geometry);
    this.staticGraphics.fill();
    this.clearDynamicGraphics();
  }

  private render() {
    this.clearDynamicGraphics();

    if (
      !this.currentKind ||
      this.currentKind === 'empty' ||
      this.fillProgress <= 0 ||
      this.tileSize <= 0
    ) {
      return;
    }

    const geometry = this.getGeometry();
    if (!geometry) {
      return;
    }

    const connections = this.getActiveConnections();
    if (!this.entryDir) {
      this.entryDir = connections[0];
    }

    const { entry, exit } = this.resolveFlow(connections, this.entryDir);
    if (!exit) {
      return;
    }

    this.dynamicGraphics.visible = true;
    this.dynamicGraphics.fill({ color: this.color, alpha: this.alpha });
    this.drawPath(this.dynamicGraphics, entry, exit, this.fillProgress, geometry);
    this.dynamicGraphics.fill();
  }

  private drawPath(
    target: Graphics,
    entry: Dir | undefined,
    exit: Dir,
    progress: number,
    geometry: PipeGeometry
  ) {
    const normalized = Math.max(0, Math.min(1, progress));
    if (normalized <= 0) {
      return;
    }

    const entryLength = entry ? this.getArmLength(entry, geometry) : 0;
    const exitLength = this.getArmLength(exit, geometry);
    const isCurve =
      entry !== undefined &&
      entry !== exit &&
      OPPOSED_DIRS[entry] !== exit &&
      this.currentKind !== 'start';
    const centerLength = geometry.channel * (isCurve ? Math.SQRT2 : 1);
    const totalLength = entryLength + centerLength + exitLength;

    if (totalLength <= 0) {
      return;
    }

    const fillLength = normalized * totalLength;

    const entryFill = Math.min(entryLength, fillLength);
    if (entry && entryFill > 0) {
      this.drawEntryArm(target, entry, entryFill, geometry);
    }

    const centerStart = entryLength;
    const centerFill = Math.min(centerLength, Math.max(0, fillLength - centerStart));
    const centerProgress = centerLength > 0 ? centerFill / centerLength : 0;
    if (centerProgress > 0) {
      this.drawCenter(target, entry, exit, centerProgress, geometry, isCurve);
    }

    const exitStart = centerStart + centerLength;
    const exitFill = Math.min(exitLength, Math.max(0, fillLength - exitStart));
    if (exitFill > 0) {
      this.drawExitArm(target, exit, exitFill, geometry);
    }
  }

  private drawEntryArm(target: Graphics, dir: Dir, length: number, geometry: PipeGeometry) {
    const { leftStart, rightStart, topStart, bottomStart, channel, centerStartX, centerStartY } =
      geometry;
    const epsilon = Math.max(0.25, channel * 0.02);
    const expansion = Math.min(epsilon, length);

    switch (dir) {
      case 'left':
        target.rect(leftStart - expansion, centerStartY, length + expansion, channel);
        break;
      case 'right':
        target.rect(rightStart - length - expansion, centerStartY, length + expansion, channel);
        break;
      case 'top':
        target.rect(centerStartX, topStart - expansion, channel, length + expansion);
        break;
      case 'bottom':
        target.rect(centerStartX, bottomStart - length - expansion, channel, length + expansion);
        break;
      default:
        break;
    }
  }

  private drawExitArm(target: Graphics, dir: Dir, length: number, geometry: PipeGeometry) {
    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const epsilon = Math.max(0.25, channel * 0.02);
    const expansion = Math.min(epsilon, length);

    switch (dir) {
      case 'left':
        target.rect(centerStartX - length - expansion, centerStartY, length + expansion, channel);
        break;
      case 'right':
        target.rect(centerEndX, centerStartY, length + expansion, channel);
        break;
      case 'top':
        target.rect(centerStartX, centerStartY - length - expansion, channel, length + expansion);
        break;
      case 'bottom':
        target.rect(centerStartX, centerEndY, channel, length + expansion);
        break;
      default:
        break;
    }
  }

  private drawCenter(
    target: Graphics,
    entry: Dir | undefined,
    exit: Dir,
    progress: number,
    geometry: PipeGeometry,
    isCurve: boolean
  ) {
    const clamped = Math.max(0, Math.min(1, progress));

    if (!isCurve || this.currentKind === 'cross') {
      this.drawStraightCenter(target, exit, clamped, geometry);
      return;
    }

    const firstPhase = Math.min(clamped, 0.5);
    if (firstPhase > 0 && entry) {
      const ratio = Math.min(1, firstPhase / 0.5);
      this.fillCenterArm(target, entry, ratio, geometry);
    }

    const secondPhase = clamped - 0.5;
    if (secondPhase > 0) {
      const ratio = Math.min(1, secondPhase / 0.5);
      this.fillCenterArm(target, exit, ratio, geometry);
    }
  }

  private drawStraightCenter(
    target: Graphics,
    exit: Dir,
    progress: number,
    geometry: PipeGeometry
  ) {
    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const length = channel * progress;

    if (exit === 'right') {
      target.rect(centerStartX, centerStartY, length, channel);
    } else if (exit === 'left') {
      target.rect(centerEndX - length, centerStartY, length, channel);
    } else if (exit === 'bottom') {
      target.rect(centerStartX, centerStartY, channel, length);
    } else if (exit === 'top') {
      target.rect(centerStartX, centerEndY - length, channel, length);
    } else {
      target.rect(geometry.centerStartX, geometry.centerStartY, geometry.channel, geometry.channel);
    }
  }

  private fillCenterArm(target: Graphics, dir: Dir, ratio: number, geometry: PipeGeometry) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const length = channel * clamped;

    switch (dir) {
      case 'left':
        target.rect(centerStartX, centerStartY, length, channel);
        break;
      case 'right':
        target.rect(centerEndX - length, centerStartY, length, channel);
        break;
      case 'top':
        target.rect(centerStartX, centerStartY, channel, length);
        break;
      case 'bottom':
        target.rect(centerStartX, centerEndY - length, channel, length);
        break;
      default:
        break;
    }
  }

  private getArmLength(dir: Dir, geometry: PipeGeometry): number {
    return dir === 'left' || dir === 'right' ? geometry.horizontalArm : geometry.verticalArm;
  }

  private resolveFlow(connections: Dir[], preferred?: Dir) {
    if (!this.currentKind || connections.length === 0) {
      return { entry: preferred, exit: undefined as Dir | undefined };
    }

    if (this.currentKind === 'start') {
      return { entry: undefined, exit: connections[0] };
    }

    let entry = preferred ?? connections[0];

    if (!entry) {
      return { entry: undefined, exit: connections[0] };
    }

    if (!connections.includes(entry)) {
      entry = connections[0];
    }

    if (!entry) {
      return { entry: undefined, exit: undefined };
    }

    let exit: Dir | undefined;

    if (this.currentKind === 'cross') {
      exit = OPPOSED_DIRS[entry];
    } else {
      exit = connections.find(dir => dir !== entry) ?? entry;
    }

    return { entry, exit };
  }

  private getActiveConnections(): Dir[] {
    if (!this.currentKind || this.currentKind === 'empty') {
      return [];
    }
    return getPorts(this.currentKind, this.currentRot);
  }

  private clearDynamicGraphics() {
    this.dynamicGraphics.clear();
    this.dynamicGraphics.visible = false;
  }

  private clearAllGraphics() {
    this.clearDynamicGraphics();
    this.staticGraphics.clear();
    this.staticGraphics.visible = false;
  }

  private getGeometry(): PipeGeometry | undefined {
    if (!this.geometry || this.geometry.size !== this.tileSize) {
      this.geometry = this.computeGeometry();
    }
    return this.geometry;
  }

  private computeGeometry(): PipeGeometry | undefined {
    const size = this.tileSize;
    if (size <= 0) {
      return undefined;
    }

    const edgeInsetRatio = Math.max(0, Math.min(0.2, this.config.edgeInsetRatio ?? 0));
    const channelWidthRatio = Math.max(0.05, Math.min(1, this.config.channelWidthRatio ?? 0.36));

    const edgeInset = Math.max(0, Math.min(size / 2, size * edgeInsetRatio));
    const maxChannel = size - edgeInset * 2;
    if (maxChannel <= 0) {
      return undefined;
    }

    const channel = Math.max(2, Math.min(size * channelWidthRatio, maxChannel));
    const centerStartX = size / 2 - channel / 2;
    const centerEndX = centerStartX + channel;
    const centerStartY = size / 2 - channel / 2;
    const centerEndY = centerStartY + channel;
    const leftStart = edgeInset;
    const rightStart = size - edgeInset;
    const topStart = edgeInset;
    const bottomStart = size - edgeInset;
    const horizontalArm = Math.max(0, centerStartX - leftStart);
    const verticalArm = Math.max(0, centerStartY - topStart);

    return {
      size,
      edgeInset,
      channel,
      centerStartX,
      centerEndX,
      centerStartY,
      centerEndY,
      leftStart,
      rightStart,
      topStart,
      bottomStart,
      horizontalArm,
      verticalArm,
    };
  }
}
