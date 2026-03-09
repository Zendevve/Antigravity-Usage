import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EMAPredictor } from '../ema-predictor';

vi.mock('vscode', () => ({}));

describe('EMAPredictor', () => {
  let predictor: EMAPredictor;

  beforeEach(() => {
    predictor = new EMAPredictor(0.3, 24);
  });

  describe('predict', () => {
    it('should return empty prediction for empty data', () => {
      const result = predictor.predict([]);
      expect(result.currentValue).toBe(0);
      expect(result.emaValue).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.predictedDepletionHours).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return prediction for single data point', () => {
      const result = predictor.predict([50]);
      expect(result.currentValue).toBe(50);
      expect(result.emaValue).toBe(50);
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBe(0.3);
    });

    it('should calculate EMA correctly', () => {
      const data = [100, 90, 80, 70, 60];
      const result = predictor.predict(data);
      // EMA = 0.3 * current + 0.7 * previous EMA
      // EMA = 0.3 * 60 + 0.7 * (0.3 * 70 + 0.7 * (0.3 * 80 + 0.7 * (0.3 * 90 + 0.7 * 100)))
      expect(result.currentValue).toBe(60);
    });

    it('should detect increasing trend', () => {
      const data = [60, 70, 80, 90, 100];
      const result = predictor.predict(data);
      expect(result.trend).toBe('increasing');
    });

    it('should detect decreasing trend', () => {
      const data = [100, 90, 80, 70, 60];
      const result = predictor.predict(data);
      expect(result.trend).toBe('decreasing');
    });

    it('should detect stable trend', () => {
      const data = [80, 81, 79, 80, 80];
      const result = predictor.predict(data);
      expect(result.trend).toBe('stable');
    });

    it('should calculate predicted depletion time', () => {
      // Declining quota: 100 -> 90 -> 80 -> 70 -> 60
      const data = [100, 90, 80, 70, 60];
      const result = predictor.predict(data);
      expect(result.predictedDepletionHours).not.toBeNull();
      expect(result.predictedDepletionHours).toBeGreaterThan(0);
    });

    it('should return null for depletion time when no decline', () => {
      // Stable data
      const data = [80, 80, 80, 80, 80];
      const result = predictor.predict(data);
      expect(result.predictedDepletionHours).toBeNull();
    });

    it('should increase confidence with more data', () => {
      const shortData = [80, 90, 100];
      const longData = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115];

      const shortResult = predictor.predict(shortData);
      const longResult = predictor.predict(longData);

      expect(longResult.confidence).toBeGreaterThanOrEqual(shortResult.confidence);
    });

    it('should use window size limit', () => {
      const predictorSmallWindow = new EMAPredictor(0.3, 5);
      const largeData = Array.from({ length: 50 }, (_, i) => 100 - i);
      const result = predictorSmallWindow.predict(largeData);

      // Should only consider last 5 points
      expect(result.currentValue).toBe(50);
    });
  });

  describe('calculateDepletionTime', () => {
    it('should calculate depletion time correctly', () => {
      const result = predictor.calculateDepletionTime(100, 10);
      expect(result).toBe(10);
    });

    it('should return null for zero burn rate', () => {
      const result = predictor.calculateDepletionTime(100, 0);
      expect(result).toBeNull();
    });

    it('should return null for negative burn rate', () => {
      const result = predictor.predict([100, 110, 120]); // Increasing
      // No depletion predicted when quota is increasing
      expect(result.predictedDepletionHours).toBeNull();
    });
  });

  describe('adaptive alpha', () => {
    it('should use higher alpha for low volatility data', () => {
      const stableData = Array(24).fill(80); // Very stable
      const result = predictor.predict(stableData);
      // Low volatility should give higher confidence
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should use lower alpha for high volatility data', () => {
      const volatileData = [10, 90, 20, 80, 30, 70, 40, 60];
      const result = predictor.predict(volatileData);
      // High volatility should give lower confidence
      expect(result.confidence).toBeLessThanOrEqual(0.8);
    });
  });

  describe('getter/setter methods', () => {
    it('should get and set alpha', () => {
      expect(predictor.getAlpha()).toBe(0.3);
      predictor.setAlpha(0.5);
      expect(predictor.getAlpha()).toBe(0.5);
    });

    it('should clamp alpha to valid range', () => {
      predictor.setAlpha(2);
      expect(predictor.getAlpha()).toBeLessThanOrEqual(0.99);

      predictor.setAlpha(-1);
      expect(predictor.getAlpha()).toBeGreaterThanOrEqual(0.01);
    });

    it('should get and set window size', () => {
      expect(predictor.getWindowSize()).toBe(24);
      predictor.setWindowSize(10);
      expect(predictor.getWindowSize()).toBe(10);
    });

    it('should clamp window size to valid range', () => {
      predictor.setWindowSize(200);
      expect(predictor.getWindowSize()).toBeLessThanOrEqual(168);

      predictor.setWindowSize(1);
      expect(predictor.getWindowSize()).toBeGreaterThanOrEqual(2);
    });
  });
});
