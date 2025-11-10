import type { Dir } from '@core/types';

export type PipeDefinition = {
  readonly kind: string; // Unique identifier for this pipe type
  readonly displayName: string; // Display name for UI/debugging
  readonly ports: readonly Dir[]; // Connection ports in base rotation (0 degrees)
  readonly assetPath: string; // Path to the sprite asset
  readonly randomizable: boolean; // Whether this pipe can be randomly generated in the queue
  readonly maxFlowVisits: number; // Maximum number of times water can flow through this pipe (for scoring)
};

export const PIPE_DEFINITIONS = {
  empty: {
    kind: 'empty',
    displayName: 'Empty Tile',
    ports: [],
    assetPath: '/assets/pipes/tile.png',
    randomizable: false,
    maxFlowVisits: 0,
  },

  straight: {
    kind: 'straight',
    displayName: 'Straight Pipe',
    ports: ['left', 'right'],
    assetPath: '/assets/pipes/straight-pipe.png',
    randomizable: true,
    maxFlowVisits: 1,
  },

  curve: {
    kind: 'curve',
    displayName: 'Curved Pipe',
    ports: ['right', 'bottom'],
    assetPath: '/assets/pipes/curved-pipe.png',
    randomizable: true,
    maxFlowVisits: 1,
  },

  cross: {
    kind: 'cross',
    displayName: 'Cross Pipe',
    ports: ['top', 'right', 'bottom', 'left'],
    assetPath: '/assets/pipes/cross-pipe.png',
    randomizable: true,
    maxFlowVisits: 2, // Can be visited twice (horizontal + vertical)
  },

  start: {
    kind: 'start',
    displayName: 'Start Pipe',
    ports: ['right'],
    assetPath: '/assets/pipes/start-pipe.png',
    randomizable: false,
    maxFlowVisits: 0, // Start tile doesn't count for scoring
  },
} as const;

export type PipeKind = keyof typeof PIPE_DEFINITIONS;
export const ALL_PIPE_KINDS = Object.keys(PIPE_DEFINITIONS) as readonly PipeKind[];

// ---- Helper Functions ----

export function getPipeDefinition(kind: PipeKind): PipeDefinition {
  return PIPE_DEFINITIONS[kind];
}

export function getAllPipeKinds(): readonly PipeKind[] {
  return ALL_PIPE_KINDS;
}

export function getRandomizablePipeKinds(): PipeKind[] {
  return (Object.keys(PIPE_DEFINITIONS) as PipeKind[]).filter(
    kind => PIPE_DEFINITIONS[kind].randomizable
  );
}

export function getBasePorts(kind: PipeKind): readonly Dir[] {
  return PIPE_DEFINITIONS[kind].ports;
}

export function getPipeAssetPath(kind: PipeKind): string {
  return PIPE_DEFINITIONS[kind].assetPath;
}

export function getMaxFlowVisits(kind: PipeKind): number {
  return PIPE_DEFINITIONS[kind].maxFlowVisits;
}

export function isRandomizable(kind: PipeKind): boolean {
  return PIPE_DEFINITIONS[kind].randomizable;
}
