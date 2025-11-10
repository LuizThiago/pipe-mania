import type { PipeKind as PipeKindImport } from './logic/pipeDefinitions';

export type PipeKind = PipeKindImport;

export type Rot = 0 | 1 | 2 | 3; // 0, 90, 180, 270 degrees

export type RandomPipeKind = Exclude<PipeKind, 'empty' | 'start'>;

export type Dir = 'top' | 'bottom' | 'left' | 'right';

export type PathNode = {
  col: number;
  row: number;
};

export type TileState = {
  kind?: PipeKind;
  rot?: Rot;
  blocked?: boolean;
};

export type FlowTerminationReason =
  | 'missingPipe'
  | 'noExit'
  | 'outOfBounds'
  | 'disconnected'
  | 'manualStop';

export type FlowCompletionPayload = {
  reason: FlowTerminationReason;
  totalTraversed: number;
  targetLength: number;
  goalAchieved: boolean;
};
