import { RANDOMIZABLE_PIPE_KINDS } from './constants';
import type { RandomPipeKind } from './types';

// Temporary — randomization is NOT deterministic.
export const PIPES = RANDOMIZABLE_PIPE_KINDS;

export function randomPipe(): RandomPipeKind {
  if (PIPES.length === 0) {
    throw new Error('PIPES array is empty');
  }
  const i = Math.floor(Math.random() * PIPES.length);
  return PIPES[i];
}
export function randomRot(): 0 | 1 | 2 | 3 {
  return Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
}
