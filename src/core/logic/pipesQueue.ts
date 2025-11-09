import type { Rot } from '@core/types';
import type { GameConfig } from '@core/config';
import { log } from '@core/logger';

export type PipeQueueItem = {
  kind: Exclude<GameConfig['gameplay']['allowedPipes'][number], 'start'>;
  rot: Rot;
};

export class PipesQueue {
  private pipes: PipeQueueItem[] = [];

  constructor(
    private readonly size: number,
    private readonly rng: () => number,
    private readonly allowedPipes: readonly PipeQueueItem['kind'][]
  ) {
    if (size < 1) {
      log.error('Pipes queue size must be >= 1');
      throw new Error('Pipes queue size must be >= 1');
    }
    if (allowedPipes.length === 0) {
      log.error('Allowed pipes array must not be empty');
      throw new Error('Allowed pipes array must not be empty');
    }

    this.fillPipesQueue();
  }

  peekPipe(): PipeQueueItem {
    return this.pipes[0];
  }

  popAndPushPipe(): PipeQueueItem {
    const removedPipe = this.pipes.shift()!;
    // Cycling the queue by reusing the array avoids extra allocations and keeps
    // the preview list stable for the UI that subscribes to snapshot updates.
    this.pipes.push(this.createRandomPipeItem());
    return removedPipe;
  }

  snapshotPipes(): readonly PipeQueueItem[] {
    return [...this.pipes];
  }

  private fillPipesQueue() {
    while (this.pipes.length < this.size) {
      this.pipes.push(this.createRandomPipeItem());
    }
  }

  private createRandomPipeItem(): PipeQueueItem {
    const kind = this.allowedPipes[Math.floor(this.rng() * this.allowedPipes.length)];
    const rot = Math.floor(this.rng() * 4) as Rot;
    const pipe = { kind, rot };
    return pipe;
  }
}
