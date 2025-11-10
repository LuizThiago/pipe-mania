import { DIRS } from '@core/constants';
import { log } from '@core/logger';
import type { PipeKind, Rot } from '@core/types';
import type { Dir } from '@core/types';
import { getBasePorts } from './pipeDefinitions';

export function getPorts(kind: PipeKind, rot: Rot): Dir[] {
  const dirs = getBasePorts(kind);
  if (!dirs || dirs.length === 0) {
    log.error('Invalid pipe kind or no ports defined:', kind);
    return [];
  }

  return dirs.map(dir => rotateDir(dir, rot));
}

function rotateDir(dir: Dir, rot: Rot): Dir {
  const index = DIRS.indexOf(dir);
  const newIndex = (index + rot) % DIRS.length;
  return DIRS[newIndex];
}
