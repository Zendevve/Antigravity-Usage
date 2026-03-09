import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForecastEngine, createForecastEngine } from '../forecast-engine';
import { TimeSeriesData } from '../forecast-types';

vi.mock('vscode', () => ({}));

describe('ForecastEngine', () => {
  let engine: ForecastEngine;

  beforeEach(() => {
    engine = createForecastEngine({
      alpha: 0.3,
      emaWindow: 24,
      monteCarloIterations: 500,
      cacheTtlMs: 5000,
    });
  });

  describe('generateForecast', () => {
    it('should return forecast for valid input', () => {
      const history: TimeSeriesData[] = [];
      const baseTime = new Date();

      // Generate 48 hours of declining quota
      for (let i = 0; i < 48; i++) {
        history.push({
          timestamp: new Date(baseTime.getTime() - (48 - i) * 3600000),
          value: 100 - i * 1.5, // Declining from 100 to 28
        });
      }

      const result = engine.generateForecast(50, history);

      expect(result.currentQuota).toBe(50);
      expect(result.emaPrediction).toBeDefined();
      expect(result.patternPrediction).toBeDefined();
      expect(result.monteCarloResult).toBeDefined();
      expect(result.estimatedHoursRemaining).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.riskLevel).toMatch(/low|medium|high|critical/);
    });

    it('should return forecast with all risk levels', () => {
      const baseTime = new Date();

      // Critical risk: quota depleting in < 24 hours
      const criticalHistory: TimeSeriesData[] = [];
      for (let i = 0; i < 24; i++) {
        criticalHistory.push({
          timestamp: new Date(baseTime.getTime() - (24 - i) * 3600000),
          value: 30 - i * 1,
        });
      }
      const criticalResult = engine.generateForecast(10, criticalHistory);
      expect(criticalResult.riskLevel).toBe('critical');

      // High risk: quota depleting in < 72 hours
      const highHistory: TimeSeriesData[] = [];
      for (let i = 0; i < 48; i++) {
        highHistory.push({
          timestamp: new Date(baseTime.getTime() - (48 - i) * 3600000),
          value: 80 - i * 1,
        });
      }
      const highResult = engine.generateForecast(40, highHistory);
      expect(highResult.riskLevel).toMatch(/high|critical/);

      // Low risk: stable or increasing quota
      const lowHistory: TimeSeriesData[] = [];
      for (let i = 0; i < 24; i++) {
        lowHistory.push({
          timestamp: new Date(baseTime.getTime() - (24 - i) * 3600000),
          value: 80 + Math.sin(i * 0.5) * 5,
        });
      }
      const lowResult = engine.generateForecast(80, lowHistory);
      expect(lowResult.riskLevel).toMatch(/low|medium/);
    });

    it('should cache results', () => {
      const history: TimeSeriesData[] = [];
      const baseTime = new Date();

      for (let i = 0; i < 24; i++) {
        history.push({
          timestamp: new Date(baseTime.getTime() - (24 - i) * 3600000),
          value: 80 - i,
        });
      }

      const result1 = engine.generateForecast(50, history);
      const cacheSize1 = engine.getCacheSize();

      const result2 = engine.generateForecast(50, history);
      const cacheSize2 = engine.getCacheSize();

      // Second call should use cache
      expect(cacheSize2).toBe(cacheSize1);
      expect(result1.estimatedHoursRemaining).toBe(result2.estimatedHoursRemaining);
    });
  });

  describe('getQuickForecast', () => {
    it('should return quick forecast for valid input', () => {
      const recentUsage = [5, 6, 7, 8, 9, 10, 11, 12];

      const result = engine.getQuickForecast(100, recentUsage);

      expect(result.estimatedHoursRemaining).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.riskLevel).toMatch(/low|medium|high|critical/);
    });

    it('should return low risk for insufficient data', () => {
      const result = engine.getQuickForecast(100, []);

      expect(result.confidence).toBe(0);
      expect(result.riskLevel).toBe('low');
    });

    it('should return low risk for zero quota', () => {
      const result = engine.getQuickForecast(0, [10, 20, 30]);

      expect(result.riskLevel).toBe('low');
    });
  });

  describe('caching', () => {
    it('should clear cache', () => {
      const history: TimeSeriesData[] = [];
      const baseTime = new Date();

      for (let i = 0; i < 24; i++) {
        history.push({
          timestamp: new Date(baseTime.getTime() - (24 - i) * 3600000),
          value: 80 - i,
        });
      }

      engine.generateForecast(50, history);
      expect(engine.getCacheSize()).toBeGreaterThan(0);

      engine.clearCache();
      expect(engine.getCacheSize()).toBe(0);
    });

    it('should respect cache TTL', async () => {
      const fastEngine = createForecastEngine({
        monteCarloIterations: 100,
        cacheTtlMs: 100, // 100ms TTL
      });

      const history: TimeSeriesData[] = [];
      const baseTime = new Date();

      for (let i = 0; i < 12; i++) {
        history.push({
          timestamp: new Date(baseTime.getTime() - (12 - i) * 3600000),
          value: 80 - i * 2,
        });
      }

      fastEngine.generateForecast(50, history);
      expect(fastEngine.getCacheSize()).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      fastEngine.generateForecast(50, history);
      // Cache should have new entry
      expect(fastEngine.getCacheSize()).toBe(1);
    });
  });

  describe('configuration', () => {
    it('should get and set weights', () => {
      const weights = engine.getWeights();
      expect(weights.ema).toBeDefined();
      expect(weights.pattern).toBeDefined();
      expect(weights.monteCarlo).toBeDefined();

      engine.setWeights({ ema: 0.5, pattern: 0.3, monteCarlo: 0.2 });
      const newWeights = engine.getWeights();

      expect(newWeights.ema).toBe(0.5);
      expect(newWeights.pattern).toBe(0.3);
      expect(newWeights.monteCarlo).toBe(0.2);
    });

    it('should provide access to sub-components', () => {
      const predictor = engine.getEMAPredictor();
      expect(predictor).toBeDefined();

      const matcher = engine.getPatternMatcher();
      expect(matcher).toBeDefined();

      const mcEngine = engine.getMonteCarloEngine();
      expect(mcEngine).toBeDefined();
    });
  });

  describe('createForecastEngine factory', () => {
    it('should create engine with custom config', () => {
      const customEngine = createForecastEngine({
        alpha: 0.5,
        emaWindow: 48,
        monteCarloIterations: 2000,
      });

      expect(customEngine).toBeInstanceOf(ForecastEngine);
    });
  });
});
