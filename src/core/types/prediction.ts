import { z } from 'zod';

export enum PredictionConfidence {
  CERTAIN = 'CERTAIN',
  LIKELY = 'LIKELY',
  PROJECTED = 'PROJECTED',
}

export const PredictionRecordSchema = z.object({
  model: z.string(),
  exhaustionTimeMedian: z.date().nullable(),
  exhaustionTimeP10: z.date().nullable(),
  exhaustionTimeP90: z.date().nullable(),
  confidence: z.nativeEnum(PredictionConfidence),
  calculatedAt: z.date(),
});

export type PredictionRecord = z.infer<typeof PredictionRecordSchema>;
