import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonteCarloEngine } from '../monte-carlo';

vi.mock('vscode', () => ({}));

describe('MonteCarloEngine', () => {
  let engine: MonteCarloEngine;

  beforeEach(() => {
    engine = new MonteCarloEngine(1000);
  });

  describe('simulate', () => {
    it('should return empty result for empty historical data', () => {
      const result = engine.simulate(100, [], 720);
      expect(result.p50).toBeNull();
      expect(result.p90).toBeNull();
      expect(result.p99).toBeNull();
      expect(result.simulationCount).toBe(0);
    });

    it('should return empty result for zero quota', () => {
      const result = engine.simulate(0, [10, 20, 30], 720);
      expect(result.p50).toBeNull();
    });

    it('should run simulations and return percentiles', () => {
      // Create declining usage pattern
      const usage = [10, 10, 10, 10, 10, 10, 10, 10]; // 10 units per hour
      const result = engine.simulate(100, usage, 720);

      expect(result.simulationCount).toBe(1000);
      expect(result.p50).not.toBeNull();
      expect(result.p90).not.toBeNull();
      expect(result.p99).not.toBeNull();

      // P50 should be approximately 100/10 = 10 hours
      expect(result.p50).toBeGreaterThan(5);
      expect(result.p50).toBeLessThan(20);
    });

    it('should calculate P90 > P50 > P0', () => {
      const usage = [5, 5, 5, 5, 5]; // 5 units per hour
      const result = engine.simulate(100, usage, 720);

      expect(result.p90!).toBeGreaterThan(result.p50!);
      expect(result.p50!).toBeGreaterThan(0);
    });

    it('should calculate probability of exhaustion', () => {
      // High burn rate - should have high probability of exhaustion
      const highUsage = [8, 9, 10, 11, 12];
      const result = engine.simulate(50, highUsage, 24);

      expect(result.probabilityExhaustion24h).toBeGreaterThan(0);
      expect(result.probabilityExhaustion24h).toBeLessThanOrEqual(1);
    });

    it('should calculate probability for different time windows', () => {
      const usage = [5, 5, 5, 5, 5];
      const result = engine.simulate(100, usage, 720);

      // Probability should increase with longer time window
      expect(result.probabilityExhaustion7d).toBeGreaterThanOrEqual(result.probabilityExhaustion24h);
      expect(result.probabilityExhaustion30d).toBeGreaterThanOrEqual(result.probabilityExhaustion7d);
    });

    it('should handle low usage gracefully', () => {
      // Very low usage - quota might not exhaust
      const usage = [0.1, 0.1, 0.1];
      const result = engine.simulate(50, usage, 720);

      expect(result.probabilityExhaustion24h).toBe(0);
      expect(result.probabilityExhaustion7d).toBe(0);
    });

    it('should handle high variance in usage', () => {
      // High variance usage
      const usage = [1, 20, 5, 15, 10];
      const result = engine.simulate(100, usage, 720);

      expect(result.p90).toBeDefined();
      expect(result.p99).toBeDefined();
    });
  });

  describe('quickSimulate', () => {
    it('should run fewer iterations for quick mode', () => {
      const quickEngine = new MonteCarloEngine(10000);
      const result = quickEngine.quickSimulate(100, [10, 10, 10], 168);

      // Quick mode should use 1000 iterations max
      expect(result.simulationCount).toBeLessThanOrEqual(1000);
    });

    it('should return valid results', () => {
      const result = engine.quickSimulate(100, [10, 10, 10], 168);

      expect(result.p50).toBeDefined();
      expect(result.probabilityExhaustion24h).toBeDefined();
    });
  });

  describe('simulateWithBootstrap', () => {
    it('should run bootstrap-only simulation', () => {
      const usage = [10, 10, 10, 10, 10];
      const result = engine.simulateWithBootstrap(100, usage, 720);

      expect(result.simulationCount).toBe(1000);
      expect(result.p50).not.toBeNull();
    });

    it('should return empty result for empty data', () => {
      const result = engine.simulateWithBootstrap(100, [], 720);
      expect(result.p50).toBeNull();
    });
  });

  describe('calculateRiskScore', () => {
    it('should return high risk for imminent exhaustion', () => {
      const result = {
        p50: 10, // 10 hours
        p90: 15,
        p99: 20,
        probabilityExhaustion24h: 0.8,
        probabilityExhaustion7d: 1,
        probabilityExhaustion30d: 1,
        simulationCount: 1000,
      };

      const score = engine.calculateRiskScore(result);
      expect(score).toBeGreaterThan(70);
    });

    it('should return low risk for distant exhaustion', () => {
      const result = {
        p50: 500, // 500 hours
        p90: 600,
        p99: 700,
        probabilityExhaustion24h: 0,
        probabilityExhaustion7d: 0.1,
        probabilityExhaustion30d: 0.5,
        simulationCount: 1000,
      };

      const score = engine.calculateRiskScore(result);
      expect(score).toBeLessThan(30);
    });

    it('should handle null P50', () => {
      const result = {
        p50: null,
        p90: null,
        p99: null,
        probabilityExhaustion24h: 0,
        probabilityExhaustion7d: 0,
        probabilityExhaustion30d: 0,
        simulationCount: 0,
      };

      const score = engine.calculateRiskScore(result);
      expect(score).toBe(0);
    });
  });

  describe('getter/setter', () => {
    it('should get and set iterations', () => {
      expect(engine.getIterations()).toBe(1000);
      engine.setIterations(5000);
      expect(engine.getIterations()).toBe(5000);
    });

    it('should clamp iterations to valid range', () => {
      engine.setIterations(50);
      expect(engine.getIterations()).toBeGreaterThanOrEqual(100);

      engine.setIterations(200000);
      expect(engine.getIterations()).toBeLessThanOrEqual(100000);
    });
  });

  describe('performance', () => {
    it('should complete 10000 iterations in reasonable time', () => {
      const fastEngine = new MonteCarloEngine(10000);
      const usage = Array.from({ length: 24 }, () => Math.random() * 10);

      const start = Date.now();
      const result = fastEngine.simulate(1000, usage, 720);
      const duration = Date.now() - start;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      expect(result.simulationCount).toBe(10000);
    });
  });
});
