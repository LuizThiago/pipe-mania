import type { Dir } from '@core/types';

/**
 * Flow strategy determines how water chooses exit direction(s) in a pipe.
 * This eliminates hardcoded logic in WaterFlowController.
 */
export type FlowStrategy =
  | 'first-port' // Always exits through first port (for start pipes)
  | 'straight-through' // Prioritizes opposite direction, then alternates (for cross pipes)
  | 'any-available'; // Exits through first available port that isn't the entrance (default)

export type PipeDefinition = {
  readonly kind: string; // Unique identifier for this pipe type
  readonly displayName: string; // Display name for UI/debugging
  readonly ports: readonly Dir[]; // Connection ports in base rotation (0 degrees)
  readonly assetPath: string; // Path to the sprite asset
  readonly randomizable: boolean; // Whether this pipe can be randomly generated in the queue
  readonly maxFlowVisits: number; // Maximum number of times water can flow through this pipe (for scoring)
  readonly flowStrategy: FlowStrategy; // How water chooses exit direction
};

export const PIPE_DEFINITIONS = {
  empty: {
    kind: 'empty',
    displayName: 'Empty Tile',
    ports: [],
    assetPath: '/assets/pipes/tile.png',
    randomizable: false,
    maxFlowVisits: 0,
    flowStrategy: 'any-available',
  },

  straight: {
    kind: 'straight',
    displayName: 'Straight Pipe',
    ports: ['left', 'right'],
    assetPath: '/assets/pipes/straight-pipe.png',
    randomizable: true,
    maxFlowVisits: 1,
    flowStrategy: 'any-available', // Enter from any side, exit through the other
  },

  curve: {
    kind: 'curve',
    displayName: 'Curved Pipe',
    ports: ['right', 'bottom'],
    assetPath: '/assets/pipes/curved-pipe.png',
    randomizable: true,
    maxFlowVisits: 1,
    flowStrategy: 'any-available', // Enter from one side, exit through the other
  },

  cross: {
    kind: 'cross',
    displayName: 'Cross Pipe',
    ports: ['top', 'right', 'bottom', 'left'],
    assetPath: '/assets/pipes/cross-pipe.png',
    randomizable: true,
    maxFlowVisits: 2, // Can be visited twice (horizontal + vertical)
    flowStrategy: 'straight-through', // Water goes straight through, then can use alternate path
  },

  start: {
    kind: 'start',
    displayName: 'Start Pipe',
    ports: ['right'],
    assetPath: '/assets/pipes/start-pipe.png',
    randomizable: false,
    maxFlowVisits: 0, // Start tile doesn't count for scoring
    flowStrategy: 'first-port', // Always exits through its single port
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

/**
 * Get the flow strategy for a pipe kind
 */
export function getFlowStrategy(kind: PipeKind): FlowStrategy {
  return PIPE_DEFINITIONS[kind].flowStrategy;
}
