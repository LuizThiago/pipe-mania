import { z } from 'zod';

export const ConfigSchema = z.object({
  grid: z.object({
    cols: z.number().int().min(3),
    rows: z.number().int().min(3),
    tileSize: z.number().int().min(32).max(256),
  }),
  gameplay: z.object({
    allowedPieces: z.array(z.enum(['straight', 'curve', 'cross', 'start'])).min(1),
    rngSeed: z.number().int().optional(),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const DefaultConfig: AppConfig = {
  grid: {
    cols: 6,
    rows: 6,
    tileSize: 100,
  },
  gameplay: {
    allowedPieces: ['straight', 'curve', 'cross'],
    rngSeed: undefined,
  },
};

export function loadConfig(configObj?: unknown): AppConfig {
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
