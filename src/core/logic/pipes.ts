import { DIRS } from '@core/constants';
import type { PipeKind, Rot } from '@core/types';
import type { Dir } from '@core/types';

const BASE_PORTS: Record<Exclude<PipeKind, 'empty'>, Dir[]> = {
  straight: ['left', 'right'],
  curve: ['right', 'bottom'],
  cross: ['top', 'right', 'bottom', 'left'],
  start: ['right'],
};

export function getPorts(kind: PipeKind, rot: Rot): Dir[] {
  const dirs = BASE_PORTS[kind as Exclude<PipeKind, 'empty'>];
  if (!dirs) {
    throw new Error(`Invalid pipe kind: ${kind}`);
  }

  return dirs.map(dir => rotateDir(dir, rot));
}

function rotateDir(dir: Dir, rot: Rot): Dir {
  const index = DIRS.indexOf(dir);
  const newIndex = (index + rot) % DIRS.length;
  return DIRS[newIndex];
}
