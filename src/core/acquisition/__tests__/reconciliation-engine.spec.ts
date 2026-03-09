import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconciliationEngine, ReconciliationConfig } from '../reconciliation-engine';
import { QuotaSource } from '../source-registry';
import { SourceReading } from '../../types';

// Mock the logger
vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine;
  let config: ReconciliationConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      maxDivergence: 0.2,
      fallbackPriority: ['antigravity-api', 'cloud-billing', 'http-interceptor'],
      minConfidence: 0.5,
    };

    engine = new ReconciliationEngine(config);
  });

  describe('initialization', () => {
    it('should create engine with default config', () => {
      const defaultEngine = new ReconciliationEngine();
      expect(defaultEngine).toBeDefined();
    });

    it('should create engine with custom config', () => {
      expect(engine).toBeDefined();
    });
  });

  describe('computeConsolidatedQuota', () => {
    it('should return null when no sources provided', async () => {
      const result = await engine.computeConsolidatedQuota([]);
      expect(result).toBeNull();
    });

    it('should return null when all sources fail', async () => {
      const failingSource: QuotaSource = {
        id: 'failing',
        fetch: vi.fn().mockResolvedValue(null),
      };

      const result = await engine.computeConsolidatedQuota([failingSource]);
      expect(result).toBeNull();
    });

    it('should compute weighted average from multiple sources', async () => {
      const source1: QuotaSource = {
        id: 'source-a',
        fetch: vi.fn().mockResolvedValue({
          sourceId: 'source-a',
          remainingPercent: 50,
          remainingTokens: 5000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        } as SourceReading),
      };

      const source2: QuotaSource = {
        id: 'source-b',
        fetch: vi.fn().mockResolvedValue({
          sourceId: 'source-b',
          remainingPercent: 60,
          remainingTokens: 6000,
          totalTokens: 10000,
          model: 'model-b',
          fetchedAt: new Date(),
          freshnessMs: 0,
        } as SourceReading),
      };

      const result = await engine.computeConsolidatedQuota([source1, source2]);

      expect(result).not.toBeNull();
      expect(result?.reading.sourceId).toBe('reconciled');
      expect(result?.sources.length).toBe(2);
    });
  });

  describe('calculateWeights', () => {
    it('should calculate equal weights for new sources', () => {
      const readings: SourceReading[] = [
        {
          sourceId: 'source-a',
          remainingPercent: 50,
          remainingTokens: 5000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
        {
          sourceId: 'source-b',
          remainingPercent: 60,
          remainingTokens: 6000,
          totalTokens: 10000,
          model: 'model-b',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
      ];

      const weights = engine.calculateWeights(readings);

      expect(weights.length).toBe(2);
      expect(weights[0].weight + weights[1].weight).toBeCloseTo(1, 5);
    });
  });

  describe('detectAnomaly', () => {
    it('should detect anomaly when sources diverge significantly', () => {
      const readings: SourceReading[] = [
        {
          sourceId: 'source-a',
          remainingPercent: 20,
          remainingTokens: 2000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
        {
          sourceId: 'source-b',
          remainingPercent: 80,
          remainingTokens: 8000,
          totalTokens: 10000,
          model: 'model-b',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
      ];

      const anomaly = engine.detectAnomaly(readings);
      expect(anomaly).toBe(true);
    });

    it('should not detect anomaly when sources are close', () => {
      const readings: SourceReading[] = [
        {
          sourceId: 'source-a',
          remainingPercent: 50,
          remainingTokens: 5000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
        {
          sourceId: 'source-b',
          remainingPercent: 52,
          remainingTokens: 5200,
          totalTokens: 10000,
          model: 'model-b',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
      ];

      const anomaly = engine.detectAnomaly(readings);
      expect(anomaly).toBe(false);
    });

    it('should not detect anomaly with single source', () => {
      const readings: SourceReading[] = [
        {
          sourceId: 'source-a',
          remainingPercent: 50,
          remainingTokens: 5000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        },
      ];

      const anomaly = engine.detectAnomaly(readings);
      expect(anomaly).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const currentConfig = engine.getConfig();
      expect(currentConfig.maxDivergence).toBe(0.2);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      engine.updateConfig({ maxDivergence: 0.3 });
      const currentConfig = engine.getConfig();
      expect(currentConfig.maxDivergence).toBe(0.3);
    });
  });

  describe('reset', () => {
    it('should clear engine state', async () => {
      const source: QuotaSource = {
        id: 'source-a',
        fetch: vi.fn().mockResolvedValue({
          sourceId: 'source-a',
          remainingPercent: 50,
          remainingTokens: 5000,
          totalTokens: 10000,
          model: 'model-a',
          fetchedAt: new Date(),
          freshnessMs: 0,
        } as SourceReading),
      };

      await engine.computeConsolidatedQuota([source]);
      engine.reset();

      const metadata = engine.getSourceMetadata();
      expect(metadata.size).toBe(0);
    });
  });
});

describe('ReconciliationEngine with fallback', () => {
  let engine: ReconciliationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ReconciliationEngine();
  });

  it('should use last known result as fallback', async () => {
    const source: QuotaSource = {
      id: 'source-a',
      fetch: vi.fn().mockResolvedValue({
        sourceId: 'source-a',
        remainingPercent: 50,
        remainingTokens: 5000,
        totalTokens: 10000,
        model: 'model-a',
        fetchedAt: new Date(),
        freshnessMs: 0,
      } as SourceReading),
    };

    // First call succeeds
    const firstResult = await engine.computeConsolidatedQuota([source]);
    expect(firstResult).not.toBeNull();

    // Second call with failing source should use fallback
    const failingSource: QuotaSource = {
      id: 'failing',
      fetch: vi.fn().mockResolvedValue(null),
    };

    const secondResult = await engine.computeConsolidatedQuota([failingSource]);
    expect(secondResult).not.toBeNull();
    expect(secondResult?.reading.sourceId).toBe('reconciled');
  });
});

describe('ReconciliationEngine with source metadata', () => {
  let engine: ReconciliationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ReconciliationEngine();
  });

  it('should track source metadata', async () => {
    const source: QuotaSource = {
      id: 'test-source',
      fetch: vi.fn().mockResolvedValue({
        sourceId: 'test-source',
        remainingPercent: 75,
        remainingTokens: 7500,
        totalTokens: 10000,
        model: 'test-model',
        fetchedAt: new Date(),
        freshnessMs: 100,
      } as SourceReading),
    };

    await engine.computeConsolidatedQuota([source]);

    const metadata = engine.getSourceMetadata();
    expect(metadata.has('test-source')).toBe(true);
  });
});
