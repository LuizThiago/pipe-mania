import type { Dir } from './types';
import {
  ALL_PIPE_KINDS as PIPE_KINDS_FROM_DEFINITIONS,
  getRandomizablePipeKinds,
  PIPE_DEFINITIONS,
  type PipeKind,
} from './logic/pipeDefinitions';

export const ALL_PIPE_KINDS = PIPE_KINDS_FROM_DEFINITIONS;

export const RANDOMIZABLE_PIPE_KINDS = getRandomizablePipeKinds() as readonly Exclude<
  PipeKind,
  'empty' | 'start'
>[];

export const WATER_COLOR = 0x3399ff;

export const ASSETS = Object.fromEntries(
  ALL_PIPE_KINDS.map(kind => [kind, PIPE_DEFINITIONS[kind].assetPath])
) as Record<PipeKind, string>;

export const Z_ORDERS = {
  tiles_bg: 0,
  pipes: 1,
  water: 2,
} as const;

export const DIRS: readonly Dir[] = ['top', 'right', 'bottom', 'left'] as const;

export const OPPOSED_DIRS: Record<Dir, Dir> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};
