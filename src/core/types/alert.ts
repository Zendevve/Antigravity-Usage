import { z } from 'zod';

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export const ChannelSchema = z.union([
  z.literal('STATUS_BAR'),
  z.literal('NOTIFICATION'),
  z.literal('WEBHOOK'),
]);

export type Channel = z.infer<typeof ChannelSchema>;

export const AlertRuleSchema = z.object({
  id: z.string(),
  type: z.enum(['percentageBelow', 'timeRemainingBelow']),
  threshold: z.number(),
  severity: z.nativeEnum(AlertSeverity),
  channels: z.array(ChannelSchema),
  cooldownMs: z.number().default(0),
  hysteresisWaitMs: z.number().default(0),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const AlertEventSchema = z.object({
  ruleId: z.string(),
  message: z.string(),
  severity: z.nativeEnum(AlertSeverity),
  triggeredAt: z.date(),
  value: z.number(),
});

export type AlertEvent = z.infer<typeof AlertEventSchema>;
