import type { GameConfig } from '@core/config';
import { log } from '@core/logger';
import type { FlowCompletionPayload, FlowTerminationReason, PipeKind } from '@core/types';

type PipePlacementContext = {
  wasReplacement: boolean;
};

type FlowStepContext = {
  tile: TileCoordinate;
  kind: PipeKind;
};

type ScoreListener = (score: number) => void;
type FlowCompletionListener = (payload: FlowCompletionPayload) => void;

type TileCoordinate = {
  col: number;
  row: number;
};

export class ScoreController {
  private readonly flowTileReward: number;
  private readonly replacementPenalty: number;
  private readonly targetFlowLength: number;
  private readonly allowNegativeScore: boolean;
  private score: number = 0;
  private currentFlowTiles: Map<string, number> = new Map();
  private currentFlowDistance: number = 0;
  private flowActive: boolean = false;
  private scoreListener?: ScoreListener;
  private flowListener?: FlowCompletionListener;

  constructor(config: GameConfig['gameplay']['scoring']) {
    this.flowTileReward = config.flowTileReward;
    this.replacementPenalty = config.replacementPenalty;
    this.targetFlowLength = config.targetFlowLength;
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

  getScore(): number {
    return this.score;
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
  }

  completeFlow(reason: FlowTerminationReason): void {
    if (!this.flowActive) {
      return;
    }

    this.flowActive = false;
    const totalTraversed = this.currentFlowDistance;
    const goalAchieved = totalTraversed >= this.targetFlowLength;
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
    if (kind === 'cross') {
      return 2;
    }
    return 1;
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

  private toCoordinate({ col, row }: TileCoordinate): string {
    return `${col}:${row}`;
  }
}
