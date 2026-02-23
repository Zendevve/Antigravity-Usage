import { z } from 'zod';

export const ConfigSchema = z.object({
  pollingIntervalIdle: z.number().min(1000).default(30000),
  pollingIntervalActive: z.number().min(1000).default(5000),
  thresholdWarning: z.number().min(0).max(100).default(20),
  thresholdCritical: z.number().min(0).max(100).default(10),
  showModel: z.enum(['autoLowest', 'pinned']).default('autoLowest'),
  pinnedModel: z.string().default(''),
  animationEnabled: z.boolean().default(true),
  antigravityPort: z.number().min(1024).max(65535).default(13337),
  antigravityToken: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
