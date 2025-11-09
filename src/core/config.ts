import { z } from 'zod';

export const ConfigSchema = z.object({
  grid: z.object({
    // Grid configuration
    cols: z.number().int().min(3).default(9),
    rows: z.number().int().min(3).default(7),
    tileGap: z.number().int().min(0).max(200).default(5),
    maxWidthRatio: z.number().min(0.1).max(1).default(0.75),
    maxHeightRatio: z.number().min(0.1).max(1).default(0.75),

    // Background configuration
    backgroundPadding: z.number().int().min(0).max(200).default(16),
    backgroundCornerRadius: z.number().int().min(0).max(200).default(12),
    backgroundColor: z.string().default('#CBE1DC'),
  }),
  gameplay: z.object({
    blockedTilesPercentage: z.number().min(0).max(1).default(0.24),
    allowedPipes: z.array(z.enum(['straight', 'curve', 'cross', 'start'])).min(1),
    rngSeed: z.number().int().optional(),
    scoring: z.object({
      flowTileReward: z.number().int().min(0).default(100),
      replacementPenalty: z.number().int().min(0).default(50),
      targetFlowLength: z.number().int().min(1).default(12),
      allowNegativeScore: z.boolean().default(false),
    }),
  }),
  strings: z.object({
    targetLabel: z.string().default('target'),
    scoreLabel: z.string().default('score'),
    flowCountdownLabel: z.string().default('flow in'),
    nextLabel: z.string().default('next'),
  }),
  water: z.object({
    fillProgress: z.number().min(0).max(1).default(0),
    fillColor: z.string().default('#3399ff'),
    fillAlpha: z.number().min(0).max(1).default(1),
    edgeInsetRatio: z.number().min(0).max(0.2).default(0.0025),
    channelWidthRatio: z.number().min(0.05).max(1).default(0.35),
    fillDurationMs: z.number().int().min(16).max(10000).default(1000),
    autoStartDelayMs: z.number().int().min(0).max(60000).default(15000),
  }),
  queue: z
    .object({
      queueSize: z.number().int().min(1).max(12).default(6),
      maxVisibleTiles: z.number().int().min(1).max(12).default(6),
      queueGap: z.number().int().min(0).max(200).default(12),
      queueTopMargin: z.number().int().min(0).max(200).default(16),
      queueBackgroundColor: z.string().default('#CBE1DC'),
    })
    .refine(data => data.maxVisibleTiles <= data.queueSize, {
      message: 'maxVisibleTiles cannot exceed queueSize',
    }),
  hud: z.object({
    labelFontSize: z.number().int().min(4).max(200).default(20),
    valueFontSize: z.number().int().min(4).max(200).default(30),
    topOffset: z.number().min(0).max(400).default(60),
    stackGap: z.number().min(0).max(200).default(12),
    sideOffset: z.number().min(0).max(400).default(24),
    safeMargin: z.number().min(0).max(400).default(16),
    minTopReserve: z.number().min(0).max(400).default(260),
  }),
});

export type GameConfig = z.infer<typeof ConfigSchema>;

export const DefaultConfig: GameConfig = {
  grid: {
    cols: 9,
    rows: 7,
    tileGap: 12,
    backgroundPadding: 16,
    backgroundCornerRadius: 12,
    maxWidthRatio: 0.75,
    maxHeightRatio: 0.7,
    backgroundColor: '#CBE1DC',
  },
  gameplay: {
    blockedTilesPercentage: 0.24,
    allowedPipes: ['straight', 'curve', 'cross'],
    scoring: {
      flowTileReward: 100,
      replacementPenalty: 50,
      targetFlowLength: 12,
      allowNegativeScore: false,
    },
  },
  strings: {
    targetLabel: 'target',
    scoreLabel: 'score',
    flowCountdownLabel: 'flow in',
    nextLabel: 'next',
  },
  water: {
    fillProgress: 0,
    fillColor: '#3399ff',
    fillAlpha: 1,
    edgeInsetRatio: 0.0025,
    channelWidthRatio: 0.35,
    fillDurationMs: 1000,
    autoStartDelayMs: 15000,
  },
  queue: {
    queueSize: 6,
    maxVisibleTiles: 5,
    queueGap: 12,
    queueTopMargin: 16,
    queueBackgroundColor: '#CBE1DC',
  },
  hud: {
    labelFontSize: 20,
    valueFontSize: 30,
    topOffset: 10,
    stackGap: 0,
    sideOffset: 24,
    safeMargin: 20,
    minTopReserve: 90,
  },
};

export function loadConfig(configObj?: unknown): GameConfig {
  if (!configObj) {
    return DefaultConfig;
  }

  const parseResult = ConfigSchema.safeParse(configObj);
  if (!parseResult.success) {
    console.warn('Invalid config provided, using default config.', parseResult.error);
    return DefaultConfig;
  }

  return parseResult.data;
}
