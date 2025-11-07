import type { ALL_PIPE_KINDS } from './constants';

export type PipeKind = (typeof ALL_PIPE_KINDS)[number];
export type Rot = 0 | 1 | 2 | 3; // 0, 90, 180, 270 degrees
export type RandomPieceKind = Exclude<PipeKind, 'empty' | 'start'>;
export type Dir = 'top' | 'bottom' | 'left' | 'right';
