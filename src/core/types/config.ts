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
  // Sprint 6: Sparkline settings
  sparklineEnabled: z.boolean().default(true),
  sparklineWindowHours: z.number().min(1).max(168).default(24),
  // Sprint 6: History settings
  historyRetentionDays: z.number().min(1).max(365).default(30),
  historySnapshotIntervalMinutes: z.number().min(1).max(60).default(5),
  // Sprint 7: Alert hysteresis settings
  alertHysteresisWarning: z.number().min(0).max(50).default(5),
  alertHysteresisCritical: z.number().min(0).max(50).default(5),
  // Sprint 7: Alert cooldown settings (in milliseconds)
  alertCooldownWarning: z.number().min(0).default(300000),  // 5 minutes
  alertCooldownCritical: z.number().min(0).default(120000), // 2 minutes
  // Sprint 7: Quiet hours settings
  quietHoursEnabled: z.boolean().default(false),
  quietHoursSchedule: z.object({
    daysOfWeek: z.array(z.number().min(0).max(6)).default([0, 6]),
    startTime: z.string().default('22:00'),
    endTime: z.string().default('08:00'),
  }).default({}),
  quietHoursTimezone: z.string().default('UTC'),
  // Sprint 7: Privacy settings
  telemetryEnabled: z.boolean().default(false),
  localOnlyMode: z.boolean().default(false),
});
export type Config = z.infer<typeof ConfigSchema>;
