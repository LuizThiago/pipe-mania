import type { GameConfig } from '@core/config';
import { log } from '@core/logger';
import type { FlowCompletionPayload, FlowTerminationReason, PipeKind } from '@core/types';
import { getMaxFlowVisits } from '@core/logic/pipeDefinitions';

type PipePlacementContext = {
  wasReplacement: boolean;
};

type FlowStepContext = {
  tile: TileCoordinate;
  kind: PipeKind;
};

type ScoreListener = (score: number) => void;
type FlowCompletionListener = (payload: FlowCompletionPayload) => void;
type FlowProgressListener = (progress: number) => void;

type TileCoordinate = {
  col: number;
  row: number;
};

export class ScoreController {
  private readonly flowTileReward: number;
  private readonly replacementPenalty: number;
  private targetFlowLength: number;
  private readonly allowNegativeScore: boolean;
  private score: number = 0;
  private currentFlowTiles: Map<string, number> = new Map();
  private currentFlowDistance: number = 0;
  private flowActive: boolean = false;
  private scoreListener?: ScoreListener;
  private flowListener?: FlowCompletionListener;
  private flowProgressListener?: FlowProgressListener;

  constructor(config: GameConfig['gameplay']['scoring']) {
    this.flowTileReward = config.flowTileReward;
    this.replacementPenalty = config.replacementPenalty;
    // Target will be set by GameController according to difficulty/stage
    this.targetFlowLength = 1;
    this.allowNegativeScore = config.allowNegativeScore;
  }

  set onScoreChange(listener: ScoreListener | undefined) {
    this.scoreListener = listener;
    if (listener) {
      listener(this.score);
    }
  }

  set onFlowComplete(listener: FlowCompletionListener | undefined) {
    this.flowListener = listener;
  }

  set onFlowProgress(listener: FlowProgressListener | undefined) {
    this.flowProgressListener = listener;
    if (listener) {
      listener(this.currentFlowDistance);
    }
  }

  getScore(): number {
    return this.score;
  }

  resetScore(): void {
    this.score = 0;
    this.emitScoreUpdate();
  }

  getTargetFlowLength(): number {
    return this.targetFlowLength;
  }

  setTargetFlowLength(length: number): void {
    if (!Number.isFinite(length)) {
      log.warn(`Invalid target flow length: ${length}. Ignoring.`);
      return;
    }
    const next = Math.max(1, Math.floor(length));
    if (this.targetFlowLength === next) {
      return;
    }
    this.targetFlowLength = next;
    this.emitFlowProgress(this.currentFlowDistance);
  }
  handlePipePlacement(context: PipePlacementContext): void {
    if (!context.wasReplacement) {
      return;
    }
    this.applyScoreDelta(-this.replacementPenalty, 'Replacement penalty applied');
  }

  beginFlow(): void {
    this.flowActive = true;
    this.currentFlowTiles.clear();
    this.currentFlowDistance = 0;
    this.emitFlowProgress(this.currentFlowDistance);
  }

  registerFlowStep({ tile, kind }: FlowStepContext): void {
    log.info(`Registering flow step: ${tile.col}, ${tile.row}`);
    if (!this.flowActive) {
      return;
    }

    const key = this.toCoordinate(tile);
    const currentVisits = this.currentFlowTiles.get(key) ?? 0;
    const maxVisits = this.resolveMaxVisits(kind);
    if (currentVisits >= maxVisits) {
      return;
    }

    this.currentFlowTiles.set(key, currentVisits + 1);
    this.currentFlowDistance += 1;
    this.applyScoreDelta(this.flowTileReward, 'Flow tile reward applied');
    this.emitFlowProgress(this.currentFlowDistance);
  }

  completeFlow(reason: FlowTerminationReason): void {
    if (!this.flowActive) {
      return;
    }

    this.flowActive = false;
    const totalTraversed = this.currentFlowDistance;
    const goalAchieved = totalTraversed >= this.targetFlowLength;
    this.emitFlowProgress(totalTraversed);
    this.currentFlowTiles.clear();
    this.currentFlowDistance = 0;

    if (reason === 'manualStop') {
      log.info('Water flow interrupted manually.');
    } else if (goalAchieved) {
      log.info(
        `Stage clear! Reached target flow length ${this.targetFlowLength} with ${totalTraversed} tiles.`
      );
    } else {
      log.info(
        `Stage failed. Needed ${this.targetFlowLength} tiles but water flowed through ${totalTraversed}.`
      );
    }

    this.flowListener?.({
      reason,
      totalTraversed,
      targetLength: this.targetFlowLength,
      goalAchieved,
    });
  }

  private emitScoreUpdate(): void {
    this.scoreListener?.(this.score);
    log.info(`Score updated: ${this.score}`);
  }

  private resolveMaxVisits(kind: PipeKind): number {
    return getMaxFlowVisits(kind);
  }

  private applyScoreDelta(delta: number, context: string): void {
    const previous = this.score;
    let next = previous + delta;
    if (!this.allowNegativeScore && next < 0) {
      next = 0;
    }

    if (previous === next) {
      log.info(`${context} skipped. Score unchanged at ${this.score}`);
      return;
    }

    this.score = next;
    log.info(`${context}. Score updated from ${previous} to ${next}`);
    this.emitScoreUpdate();
  }

  private emitFlowProgress(progress: number): void {
    this.flowProgressListener?.(progress);
  }

  private toCoordinate({ col, row }: TileCoordinate): string {
    return `${col}:${row}`;
  }
}
