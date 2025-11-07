import { z } from 'zod';

export const ConfigSchema = z.object({
  grid: z.object({
    cols: z.number().int().min(3),
    rows: z.number().int().min(3),
    tileSize: z.number().int().min(32).max(256),
    blockedTilesPercentage: z.number().min(0).max(0.5).default(0.24),
    tileGap: z.number().int().min(0).max(200).default(5),
  }),
  gameplay: z.object({
    allowedPieces: z.array(z.enum(['straight', 'curve', 'cross', 'start'])).min(1),
    rngSeed: z.number().int().optional(),
  }),
});

export type GameConfig = z.infer<typeof ConfigSchema>;

export const DefaultConfig: GameConfig = {
  grid: {
    cols: 9,
    rows: 7,
    tileSize: 100,
    blockedTilesPercentage: 0.24,
    tileGap: 5,
  },
  gameplay: {
    allowedPieces: ['straight', 'curve', 'cross'],
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
