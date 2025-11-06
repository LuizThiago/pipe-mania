import { RANDOMIZABLE_PIECE_KINDS } from './constants';
import type { RandomPieceKind } from './types';

// Temporary — randomization is NOT deterministic.
export const PIECES = RANDOMIZABLE_PIECE_KINDS;

export function randomPiece(): RandomPieceKind {
  if (PIECES.length === 0) {
    throw new Error('PIECES array is empty');
  }
  const i = Math.floor(Math.random() * PIECES.length);
  return PIECES[i];
}
export function randomRot(): 0 | 1 | 2 | 3 {
  return Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
}
