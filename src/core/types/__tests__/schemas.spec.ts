import { describe, it, expect } from 'vitest';
import { ConfigSchema, SourceReadingSchema } from '../index';

describe('Zod Schemas', () => {
  it('should parse valid Config', () => {
    const validConfig = {
      pollingIntervalIdle: 30000,
      pollingIntervalActive: 5000,
      thresholdWarning: 20,
      thresholdCritical: 10,
      showModel: 'autoLowest',
      pinnedModel: '',
      animationEnabled: true,
      antigravityPort: 13337,
    };
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid SourceReading', () => {
    const invalidReading = {
      sourceId: 'A',
      remainingPercent: 150, // > 100
      remainingTokens: -10, // < 0
      totalTokens: 1000,
      model: 'test',
      fetchedAt: new Date(),
      freshnessMs: 0,
    };
    const result = SourceReadingSchema.safeParse(invalidReading);
    expect(result.success).toBe(false);
  });
});
