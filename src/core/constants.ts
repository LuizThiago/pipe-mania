import type { PipeKind } from './types';

export const ALL_PIPE_KINDS = ['empty', 'straight', 'curve', 'cross', 'start'] as const;

export const RANDOMIZABLE_PIECE_KINDS = ALL_PIPE_KINDS.filter(
  (kind): kind is Exclude<PipeKind, 'empty' | 'start'> => kind !== 'empty' && kind !== 'start'
) as readonly Exclude<PipeKind, 'empty' | 'start'>[];

export const WATER_COLOR = 0x3399ff;

export const ASSETS = {
  empty: '/assets/pipes/tile.png',
  straight: '/assets/pipes/straight-pipe.png',
  curve: '/assets/pipes/curved-pipe.png',
  cross: '/assets/pipes/cross-pipe.png',
  start: '/assets/pipes/start-pipe.png',
} as const;

export const Z_ORDERS = {
  tiles_bg: 0,
  pieces: 1,
  water: 2,
} as const;
