import { z } from 'zod';

export const SourceReadingSchema = z.object({
  sourceId: z.string(),
  remainingPercent: z.number().min(0).max(100),
  remainingTokens: z.number().min(0),
  totalTokens: z.number().min(0),
  model: z.string(),
  fetchedAt: z.date(),
  freshnessMs: z.number().min(0),
});

export type SourceReading = z.infer<typeof SourceReadingSchema>;

export enum ConfidenceGrade {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export const ReconciledQuotaStateSchema = SourceReadingSchema.extend({
  confidence: z.nativeEnum(ConfidenceGrade),
  sources: z.array(SourceReadingSchema),
});

export type ReconciledQuotaState = z.infer<typeof ReconciledQuotaStateSchema>;

export type QuotaState = ReconciledQuotaState | SourceReading;
