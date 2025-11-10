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
  animations: z
    .object({
      tilePlaceBounceMs: z.number().int().min(16).max(2000).default(220),
      queueShiftOutMs: z.number().int().min(16).max(2000).default(180),
      queueShiftMoveMs: z.number().int().min(16).max(2000).default(220),
      queueShiftInMs: z.number().int().min(16).max(2000).default(220),
      ghostHideMs: z.number().int().min(0).max(60000).default(220),
      ghostSnapLerpInside: z.number().min(0).max(1).default(0.22),
      ghostSnapLerpOutside: z.number().min(0).max(1).default(0.14),
      ghostPulseSpeed: z.number().min(0.01).max(0.5).default(0.05),
      ghostOutlineColor: z.string().default('#2b80ff'),
    })
    .default({
      tilePlaceBounceMs: 220,
      queueShiftOutMs: 180,
      queueShiftMoveMs: 220,
      queueShiftInMs: 220,
      ghostHideMs: 220,
      ghostSnapLerpInside: 0.22,
      ghostSnapLerpOutside: 0.14,
      ghostPulseSpeed: 0.05,
      ghostOutlineColor: '#2b80ff',
    }),
  gameplay: z.object({
    allowedPipes: z.array(z.enum(['straight', 'curve', 'cross', 'start'])).min(1),
    rngSeed: z.number().int().optional(),
    difficulty: z
      .object({
        blockedPercentStart: z.number().min(0).max(1).default(0),
        blockedPercentPerStage: z.number().min(0).max(1).default(0.05),
        blockedPercentMax: z.number().min(0).max(1).default(0.35),
        targetLengthStart: z.number().int().min(1).default(5),
        targetLengthPerStage: z.number().int().min(0).default(1),
        targetLengthMax: z.number().int().min(1).default(30),
        flowAutoStart: z
          .object({
            multiplierPerStage: z.number().min(0.1).max(2).default(1),
            minMs: z.number().int().min(0).max(60000).default(0),
          })
          .optional(),
      })
      .default({
        blockedPercentStart: 0,
        blockedPercentPerStage: 0.05,
        blockedPercentMax: 0.35,
        targetLengthStart: 5,
        targetLengthPerStage: 1,
        targetLengthMax: 30,
      }),
    scoring: z.object({
      flowTileReward: z.number().int().min(0).default(100),
      replacementPenalty: z.number().int().min(0).default(50),
      allowNegativeScore: z.boolean().default(false),
    }),
  }),
  strings: z.object({
    targetLabel: z.string().default('target'),
    scoreLabel: z.string().default('score'),
    flowCountdownLabel: z.string().default('flow in'),
    nextLabel: z.string().default('next'),
    stageLabel: z.string().default('stage'),
    branding: z.string().default('pipe-mania by Luiz Thiago'),
    endModalWinTitle: z.string().default('stage completed'),
    endModalLoseTitle: z.string().default('game over'),
    endModalWinAction: z.string().default('next stage'),
    endModalLoseAction: z.string().default('play again'),
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
  endModal: z.object({
    width: z.number().int().min(120).max(1600).default(420),
    height: z.number().int().min(120).max(1200).default(240),
    cornerRadius: z.number().int().min(0).max(120).default(16),
    backgroundColor: z.string().default('#FAFAFA'),
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
    rngSeed: 233233,
    allowedPipes: ['straight', 'curve', 'cross'],
    difficulty: {
      blockedPercentStart: 0,
      blockedPercentPerStage: 0.05,
      blockedPercentMax: 0.35,
      targetLengthStart: 5,
      targetLengthPerStage: 1,
      targetLengthMax: 30,
      flowAutoStart: {
        multiplierPerStage: 1,
        minMs: 0,
      },
    },
    scoring: {
      flowTileReward: 100,
      replacementPenalty: 50,
      allowNegativeScore: false,
    },
  },
  strings: {
    targetLabel: 'target',
    scoreLabel: 'score',
    flowCountdownLabel: 'flow in',
    nextLabel: 'next',
    stageLabel: 'stage',
    branding: 'pipe-mania by Luiz Thiago',
    endModalWinTitle: 'stage completed',
    endModalLoseTitle: 'game over',
    endModalWinAction: 'next stage',
    endModalLoseAction: 'play again',
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
  animations: {
    tilePlaceBounceMs: 220,
    queueShiftOutMs: 180,
    queueShiftMoveMs: 220,
    queueShiftInMs: 220,
    ghostHideMs: 220,
    ghostSnapLerpInside: 0.22,
    ghostSnapLerpOutside: 0.14,
    ghostPulseSpeed: 0.2,
    ghostOutlineColor: '#2b80ff',
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
  endModal: {
    width: 420,
    height: 240,
    cornerRadius: 16,
    backgroundColor: '#FAFAFA',
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
