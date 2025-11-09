import { Graphics } from 'pixi.js';
import type { PipeKind, Rot } from '@core/types';
import type { GameConfig } from '@core/config';
import { parseColor } from '../utils/color';

type CardinalDir = 'top' | 'right' | 'bottom' | 'left';

const DIRECTIONS_ORDER: CardinalDir[] = ['top', 'right', 'bottom', 'left'];

const OPPOSITE_DIR: Record<CardinalDir, CardinalDir> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const PIPE_CONNECTIONS: Record<PipeKind, CardinalDir[]> = {
  empty: [],
  straight: ['left', 'right'],
  curve: ['bottom', 'right'],
  cross: ['top', 'right', 'bottom', 'left'],
  start: ['right'],
};

function rotateDirs(dirs: CardinalDir[], rot: Rot): CardinalDir[] {
  if (rot % DIRECTIONS_ORDER.length === 0) {
    return dirs;
  }
  return dirs.map(dir => {
    const currentIndex = DIRECTIONS_ORDER.indexOf(dir);
    const rotatedIndex = (currentIndex + rot + DIRECTIONS_ORDER.length) % DIRECTIONS_ORDER.length;
    return DIRECTIONS_ORDER[rotatedIndex];
  });
}

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
  private entryDir?: CardinalDir;
  private secondaryEntryDir?: CardinalDir;
  private geometry?: PipeGeometry;

  private readonly color: number;
  private readonly alpha: number;

  constructor(
    private readonly graphics: Graphics,
    private readonly config: GameConfig['water']
  ) {
    this.color = parseColor(config.fillColor);
    this.alpha = Math.max(0, Math.min(1, config.fillAlpha));
    this.graphics.visible = false;
  }

  setTileSize(size: number) {
    this.tileSize = size;
    this.geometry = undefined;
    this.render();
  }

  setPipe(kind: PipeKind | undefined, rot: Rot) {
    this.currentKind = kind;
    this.currentRot = rot;
    this.resetEntryDirs();
    if (!kind || kind === 'empty') {
      this.clearGraphics();
      return;
    }
    this.render();
  }

  setRotation(rot: Rot) {
    if (this.currentRot === rot) {
      return;
    }
    this.currentRot = rot;
    this.resetEntryDirs();
    this.render();
  }

  clearPipe() {
    this.currentKind = undefined;
    this.fillProgress = 0;
    this.resetEntryDirs();
    this.clearGraphics();
  }

  clearFill() {
    if (this.fillProgress === 0 && !this.entryDir && !this.secondaryEntryDir) {
      this.clearGraphics();
      return;
    }
    this.fillProgress = 0;
    this.resetEntryDirs();
    this.clearGraphics();
  }

  setFillProgress(progress: number) {
    const clamped = Math.max(0, Math.min(1, progress));

    if (!this.currentKind || this.currentKind === 'empty') {
      this.clearFill();
      return;
    }

    if (clamped === 0) {
      this.clearFill();
      return;
    }

    if (this.fillProgress === clamped) {
      return;
    }

    this.fillProgress = clamped;

    if (!this.entryDir || (this.currentKind === 'cross' && !this.secondaryEntryDir)) {
      this.selectEntryDirs();
    }

    this.render();
  }

  render() {
    this.graphics.clear();

    if (
      !this.currentKind ||
      this.currentKind === 'empty' ||
      this.fillProgress <= 0 ||
      this.tileSize <= 0
    ) {
      this.graphics.visible = false;
      return;
    }

    const geometry = this.getGeometry();
    if (!geometry) {
      this.graphics.visible = false;
      return;
    }

    if (!this.entryDir || (this.currentKind === 'cross' && !this.secondaryEntryDir)) {
      this.selectEntryDirs();
    }

    if (!this.entryDir) {
      this.graphics.visible = false;
      return;
    }

    const connections = this.getActiveConnections();
    const primaryExit = this.getExitDirection(this.entryDir, connections);

    this.graphics.visible = true;
    this.graphics.beginFill(this.color, this.alpha);

    this.drawLinearPath(this.entryDir, primaryExit, this.fillProgress, geometry, true);

    if (this.currentKind === 'cross') {
      let secondaryEntry = this.secondaryEntryDir;
      if (!secondaryEntry) {
        secondaryEntry = this.selectPerpendicularEntry(this.entryDir, connections);
        this.secondaryEntryDir = secondaryEntry;
      }
      if (secondaryEntry) {
        const secondaryExit = this.getExitDirection(secondaryEntry, connections);
        this.drawLinearPath(secondaryEntry, secondaryExit, this.fillProgress, geometry, true);
      }
    }

    this.graphics.endFill();
  }

  private clearGraphics() {
    this.graphics.clear();
    this.graphics.visible = false;
  }

  private getGeometry(): PipeGeometry | null {
    if (!this.geometry || this.geometry.size !== this.tileSize) {
      this.geometry = this.computeGeometry();
    }
    return this.geometry ?? null;
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

  private getActiveConnections(): CardinalDir[] {
    if (!this.currentKind) {
      return [];
    }
    const base = PIPE_CONNECTIONS[this.currentKind] ?? [];
    return rotateDirs(base, this.currentRot);
  }

  private getExitDirection(entry: CardinalDir, connections: CardinalDir[]): CardinalDir {
    const opposite = OPPOSITE_DIR[entry];
    if (connections.includes(opposite)) {
      return opposite;
    }
    for (const dir of connections) {
      if (dir !== entry) {
        return dir;
      }
    }
    return opposite;
  }

  private drawLinearPath(
    entry: CardinalDir,
    exit: CardinalDir,
    progress: number,
    geometry: PipeGeometry,
    drawCenter: boolean
  ) {
    const normalized = Math.max(0, Math.min(1, progress));
    const entryArm = this.getArmLength(entry, geometry);
    const exitArm = this.getArmLength(exit, geometry);
    const isCurve = entry !== exit && OPPOSITE_DIR[entry] !== exit;
    const centerLength =
      drawCenter && geometry.channel > 0
        ? isCurve
          ? geometry.channel * Math.SQRT2
          : geometry.channel
        : 0;
    const totalLength = entryArm + centerLength + exitArm;

    if (totalLength <= 0 || normalized <= 0) {
      return;
    }

    const fillLength = normalized * totalLength;
    const entryFill = Math.min(entryArm, fillLength);
    this.drawEntrySection(entry, entryFill, geometry);

    const centerFill =
      centerLength > 0 ? Math.max(0, Math.min(centerLength, fillLength - entryArm)) : 0;
    const centerProgress = centerLength > 0 ? centerFill / centerLength : 0;
    if (centerProgress > 0) {
      this.drawCenterFill(entry, exit, centerProgress, geometry);
    }

    const exitFill = Math.min(exitArm, Math.max(0, fillLength - entryArm - centerLength));
    this.drawExitSection(exit, exitFill, geometry);
  }

  private drawEntrySection(dir: CardinalDir, length: number, geometry: PipeGeometry) {
    if (length <= 0) {
      return;
    }

    const { leftStart, rightStart, topStart, bottomStart, channel, centerStartX, centerStartY } =
      geometry;
    const epsilon = Math.max(0.25, channel * 0.02);
    const expansion = Math.min(epsilon, length);

    switch (dir) {
      case 'left':
        this.graphics.rect(leftStart - expansion, centerStartY, length + expansion, channel);
        break;
      case 'right':
        this.graphics.rect(rightStart - length - expansion, centerStartY, length + expansion, channel);
        break;
      case 'top':
        this.graphics.rect(centerStartX, topStart - expansion, channel, length + expansion);
        break;
      case 'bottom':
        this.graphics.rect(centerStartX, bottomStart - length - expansion, channel, length + expansion);
        break;
      default:
        break;
    }
  }

  private drawExitSection(dir: CardinalDir, length: number, geometry: PipeGeometry) {
    if (length <= 0) {
      return;
    }

    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const epsilon = Math.max(0.25, channel * 0.02);
    const expansion = Math.min(epsilon, length);

    switch (dir) {
      case 'left':
        this.graphics.rect(centerStartX - length - expansion, centerStartY, length + expansion, channel);
        break;
      case 'right':
        this.graphics.rect(centerEndX, centerStartY, length + expansion, channel);
        break;
      case 'top':
        this.graphics.rect(centerStartX, centerStartY - length - expansion, channel, length + expansion);
        break;
      case 'bottom':
        this.graphics.rect(centerStartX, centerEndY, channel, length + expansion);
        break;
      default:
        break;
    }
  }

  private drawCenterFill(
    entry: CardinalDir,
    exit: CardinalDir,
    progress: number,
    geometry: PipeGeometry
  ) {
    if (progress <= 0) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, progress));
    const isCurve = entry !== exit && OPPOSITE_DIR[entry] !== exit;

    if (!isCurve) {
      this.drawStraightCenter(entry, exit, clamped, geometry);
      return;
    }

    const firstPhase = Math.min(clamped, 0.5);
    if (firstPhase > 0) {
      const ratio = Math.min(1, firstPhase / 0.5);
      this.fillCenterArm(entry, ratio, geometry);
    }

    const secondPhase = clamped - 0.5;
    if (secondPhase > 0) {
      const ratio = Math.min(1, secondPhase / 0.5);
      this.fillCenterArm(exit, ratio, geometry);
    }
  }

  private drawStraightCenter(
    entry: CardinalDir,
    exit: CardinalDir,
    progress: number,
    geometry: PipeGeometry
  ) {
    if (progress <= 0) {
      return;
    }
    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const length = channel * Math.max(0, Math.min(1, progress));

    if (entry === 'left' && exit === 'right') {
      this.graphics.rect(centerStartX, centerStartY, length, channel);
    } else if (entry === 'right' && exit === 'left') {
      this.graphics.rect(centerEndX - length, centerStartY, length, channel);
    } else if (entry === 'top' && exit === 'bottom') {
      this.graphics.rect(centerStartX, centerStartY, channel, length);
    } else if (entry === 'bottom' && exit === 'top') {
      this.graphics.rect(centerStartX, centerEndY - length, channel, length);
    } else {
      this.graphics.rect(
        geometry.centerStartX,
        geometry.centerStartY,
        geometry.channel,
        geometry.channel
      );
    }
  }

  private fillCenterArm(dir: CardinalDir, ratio: number, geometry: PipeGeometry) {
    if (ratio <= 0) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, ratio));
    const { centerStartX, centerEndX, centerStartY, centerEndY, channel } = geometry;
    const length = channel * clamped;

    switch (dir) {
      case 'left':
        this.graphics.rect(centerStartX, centerStartY, length, channel);
        break;
      case 'right':
        this.graphics.rect(centerEndX - length, centerStartY, length, channel);
        break;
      case 'top':
        this.graphics.rect(centerStartX, centerStartY, channel, length);
        break;
      case 'bottom':
        this.graphics.rect(centerStartX, centerEndY - length, channel, length);
        break;
      default:
        break;
    }
  }

  private getArmLength(dir: CardinalDir, geometry: PipeGeometry): number {
    return dir === 'left' || dir === 'right' ? geometry.horizontalArm : geometry.verticalArm;
  }

  private resetEntryDirs() {
    this.entryDir = undefined;
    this.secondaryEntryDir = undefined;
  }

  private selectEntryDirs() {
    this.resetEntryDirs();
    const connections = this.getActiveConnections();
    if (connections.length === 0) {
      return;
    }

    const idx = Math.floor(Math.random() * connections.length);
    this.entryDir = connections[Math.max(0, Math.min(idx, connections.length - 1))];

    if (this.currentKind === 'cross' && this.entryDir) {
      this.secondaryEntryDir = this.selectPerpendicularEntry(this.entryDir, connections);
    } else {
      this.secondaryEntryDir = undefined;
    }
  }

  private selectPerpendicularEntry(
    entry: CardinalDir,
    connections: CardinalDir[]
  ): CardinalDir | undefined {
    const opposite = OPPOSITE_DIR[entry];
    const candidates = connections.filter(dir => dir !== entry && dir !== opposite);
    if (candidates.length === 0) {
      return undefined;
    }
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[Math.max(0, Math.min(idx, candidates.length - 1))];
  }
}

