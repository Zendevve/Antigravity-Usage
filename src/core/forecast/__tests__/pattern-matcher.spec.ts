import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternMatcher } from '../pattern-matcher';
import { TimeSeriesData } from '../forecast-types';

vi.mock('vscode', () => ({}));

describe('PatternMatcher', () => {
  let matcher: PatternMatcher;

  beforeEach(() => {
    matcher = new PatternMatcher(2.0);
  });

  describe('detectPatterns', () => {
    it('should return empty array for insufficient data', () => {
      const result = matcher.detectPatterns([]);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for single data point', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T10:00:00'), value: 80 },
      ];
      const result = matcher.detectPatterns(data);
      expect(result).toHaveLength(0);
    });

    it('should detect daily pattern', () => {
      // Create 24 hours of data with peak at hours 10-14
      const data: TimeSeriesData[] = [];
      const baseTime = new Date('2024-01-01T00:00:00');

      for (let hour = 0; hour < 24; hour++) {
        // Higher values during business hours (10-14)
        const value = (hour >= 10 && hour <= 14) ? 80 : 40;
        data.push({
          timestamp: new Date(baseTime.getTime() + hour * 3600000),
          value,
        });
      }

      const patterns = matcher.detectPatterns(data);
      const dailyPattern = patterns.find(p => p.type === 'daily');

      expect(dailyPattern).toBeDefined();
      expect(dailyPattern?.peakHours).toContain(10);
      expect(dailyPattern?.peakHours).toContain(11);
    });

    it('should detect weekly pattern', () => {
      // Create 7 days of data with weekdays higher than weekend
      const data: TimeSeriesData[] = [];
      const baseTime = new Date('2024-01-01T00:00:00'); // Monday

      for (let day = 0; day < 7; day++) {
        // Higher values on weekdays (1-5), lower on weekend (0, 6)
        const value = (day >= 1 && day <= 5) ? 80 : 40;
        data.push({
          timestamp: new Date(baseTime.getTime() + day * 86400000),
          value,
        });
      }

      const patterns = matcher.detectPatterns(data);
      const weeklyPattern = patterns.find(p => p.type === 'weekly');

      expect(weeklyPattern).toBeDefined();
      expect(weeklyPattern?.peakDays).toContain(1); // Monday
      expect(weeklyPattern?.peakDays).toContain(5); // Friday
    });

    it('should return confidence based on pattern strength', () => {
      // Strong pattern with clear peaks
      const strongData: TimeSeriesData[] = [];
      const baseTime = new Date('2024-01-01T00:00:00');

      for (let hour = 0; hour < 48; hour++) {
        const value = (hour % 24 >= 10 && hour % 24 <= 14) ? 90 : 30;
        strongData.push({
          timestamp: new Date(baseTime.getTime() + hour * 3600000),
          value,
        });
      }

      const patterns = matcher.detectPatterns(strongData);
      const dailyPattern = patterns.find(p => p.type === 'daily');

      expect(dailyPattern?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('detectAnomalies', () => {
    it('should return empty array for insufficient data', () => {
      const result = matcher.detectAnomalies([]);
      expect(result).toHaveLength(0);
    });

    it('should detect spike anomaly', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T10:00:00'), value: 50 },
        { timestamp: new Date('2024-01-01T11:00:00'), value: 52 },
        { timestamp: new Date('2024-01-01T12:00:00'), value: 95 }, // Spike
        { timestamp: new Date('2024-01-01T13:00:00'), value: 51 },
        { timestamp: new Date('2024-01-01T14:00:00'), value: 49 },
      ];

      const anomalies = matcher.detectAnomalies(data);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe('spike');
    });

    it('should detect drop anomaly', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T10:00:00'), value: 50 },
        { timestamp: new Date('2024-01-01T11:00:00'), value: 52 },
        { timestamp: new Date('2024-01-01T12:00:00'), value: 5 }, // Drop
        { timestamp: new Date('2024-01-01T13:00:00'), value: 51 },
        { timestamp: new Date('2024-01-01T14:00:00'), value: 49 },
      ];

      const anomalies = matcher.detectAnomalies(data);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe('drop');
    });

    it('should not detect anomalies in normal data', () => {
      const data: TimeSeriesData[] = [
        { timestamp: new Date('2024-01-01T10:00:00'), value: 50 },
        { timestamp: new Date('2024-01-01T11:00:00'), value: 52 },
        { timestamp: new Date('2024-01-01T12:00:00'), value: 48 },
        { timestamp: new Date('2024-01-01T13:00:00'), value: 51 },
        { timestamp: new Date('2024-01-01T14:00:00'), value: 49 },
      ];

      const anomalies = matcher.detectAnomalies(data);
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('predictNextPeriod', () => {
    it('should generate predictions based on daily pattern', () => {
      const pattern = {
        type: 'daily' as const,
        peakHours: [10, 11, 12],
        peakDays: [],
        averageUsage: 50,
        variance: 100,
        confidence: 0.8,
      };

      const predictions = matcher.predictNextPeriod(pattern, 24);

      expect(predictions).toHaveLength(24);
      // Peak hours should have higher predictions
      const morningPredictions = predictions.slice(10, 13);
      const nightPredictions = predictions.slice(0, 6);

      const morningAvg = morningPredictions.reduce((a, b) => a + b, 0) / morningPredictions.length;
      const nightAvg = nightPredictions.reduce((a, b) => a + b, 0) / nightPredictions.length;

      expect(morningAvg).toBeGreaterThan(nightAvg);
    });

    it('should generate predictions based on weekly pattern', () => {
      const pattern = {
        type: 'weekly' as const,
        peakHours: [],
        peakDays: [1, 2, 3, 4, 5], // Weekdays
        averageUsage: 60,
        variance: 200,
        confidence: 0.7,
      };

      // Predict for 48 hours (2 days)
      const predictions = matcher.predictNextPeriod(pattern, 48);

      expect(predictions).toHaveLength(48);
    });
  });

  describe('getPrimaryPattern', () => {
    it('should return null for empty patterns', () => {
      const result = matcher.getPrimaryPattern([]);
      expect(result).toBeNull();
    });

    it('should return pattern with highest confidence', () => {
      const patterns = [
        { type: 'daily' as const, peakHours: [], peakDays: [], averageUsage: 50, variance: 100, confidence: 0.5 },
        { type: 'weekly' as const, peakHours: [], peakDays: [], averageUsage: 50, variance: 100, confidence: 0.8 },
      ];

      const result = matcher.getPrimaryPattern(patterns);
      expect(result?.type).toBe('weekly');
    });
  });

  describe('detectCyclicBehavior', () => {
    it('should return null for insufficient data', () => {
      const result = matcher.detectCyclicBehavior([]);
      expect(result).toBeNull();
    });

    it('should detect daily cycle in periodic data', () => {
      const data: TimeSeriesData[] = [];
      const baseTime = new Date('2024-01-01T00:00:00');

      // Create 3 days of sinusoidal data
      for (let hour = 0; hour < 72; hour++) {
        const value = 50 + 30 * Math.sin((2 * Math.PI * hour) / 24);
        data.push({
          timestamp: new Date(baseTime.getTime() + hour * 3600000),
          value,
        });
      }

      const result = matcher.detectCyclicBehavior(data);
      expect(result).not.toBeNull();
    });
  });

  describe('anomaly threshold', () => {
    it('should get and set anomaly threshold', () => {
      expect(matcher.getAnomalyThreshold()).toBe(2.0);
      matcher.setAnomalyThreshold(3.0);
      expect(matcher.getAnomalyThreshold()).toBe(3.0);
    });

    it('should clamp threshold to valid range', () => {
      matcher.setAnomalyThreshold(10);
      expect(matcher.getAnomalyThreshold()).toBeLessThanOrEqual(5.0);

      matcher.setAnomalyThreshold(0.5);
      expect(matcher.getAnomalyThreshold()).toBeGreaterThanOrEqual(1.0);
    });
  });
});
