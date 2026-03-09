import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionEventBus } from '../events';
import { ConfidenceGrade } from '../../core/types/quota';

// Helper function to create a mock quota state
const createMockQuotaState = () => ({
  sourceId: 'test',
  remainingPercent: 50,
  remainingTokens: 500000,
  totalTokens: 1000000,
  model: 'claude-3',
  fetchedAt: new Date(),
  freshnessMs: 1000,
  confidence: ConfidenceGrade.HIGH,
  sources: [],
});

describe('ExtensionEventBus', () => {
  let eventBus: ExtensionEventBus;

  beforeEach(() => {
    eventBus = new ExtensionEventBus();
  });

  describe('Event Subscription', () => {
    it('should subscribe to quota update events', () => {
      const callback = vi.fn();
      const subscription = eventBus.onQuotaUpdate(callback);

      // Emit an event
      eventBus.emitQuotaUpdate([createMockQuotaState()]);

      expect(callback).toHaveBeenCalledTimes(1);
      subscription.dispose();
    });

    it('should subscribe to warning events', () => {
      const callback = vi.fn();
      eventBus.onWarning(callback);

      eventBus.emitWarning(createMockQuotaState(), 'Warning: Low quota');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].type).toBe('warning');
      expect(callback.mock.calls[0][0].severity).toBe('WARNING');
    });

    it('should subscribe to critical events', () => {
      const callback = vi.fn();
      eventBus.onCritical(callback);

      const lowQuota = {
        ...createMockQuotaState(),
        remainingPercent: 5,
        remainingTokens: 50000,
      };
      eventBus.emitCritical(lowQuota, 'Critical: Very low quota');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].type).toBe('critical');
      expect(callback.mock.calls[0][0].severity).toBe('CRITICAL');
    });

    it('should subscribe to forecast update events', () => {
      const callback = vi.fn();
      eventBus.onForecastUpdate(callback);

      const forecast = {
        timestamp: new Date(),
        currentQuota: 50,
        emaPrediction: {
          currentValue: 50,
          emaValue: 45,
          trend: 'decreasing' as const,
          predictedDepletionHours: 24,
          confidence: 0.8,
        },
        patternPrediction: {
          type: 'daily' as const,
          peakHours: [9, 10, 11],
          peakDays: [1, 2, 3, 4, 5],
          averageUsage: 1000,
          variance: 100,
          confidence: 0.7,
        },
        monteCarloResult: {
          p50: 24,
          p90: 48,
          p99: 72,
          probabilityExhaustion24h: 0.1,
          probabilityExhaustion7d: 0.5,
          probabilityExhaustion30d: 0.8,
          simulationCount: 10000,
        },
        estimatedHoursRemaining: 24,
        confidence: 0.75,
        riskLevel: 'medium' as const,
      };

      eventBus.emitForecastUpdate(forecast);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].type).toBe('forecastUpdate');
    });

    it('should subscribe to source connection events', () => {
      const connectedCallback = vi.fn();
      const disconnectedCallback = vi.fn();

      eventBus.onSourceConnected(connectedCallback);
      eventBus.onSourceDisconnected(disconnectedCallback);

      eventBus.emitSourceConnected('antigravity-api', 'Antigravity API');
      eventBus.emitSourceDisconnected('cloud-billing', 'Cloud Billing');

      expect(connectedCallback).toHaveBeenCalledTimes(1);
      expect(disconnectedCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Subscription Disposal', () => {
    it('should stop receiving events after disposal', () => {
      const callback = vi.fn();
      const subscription = eventBus.onWarning(callback);

      eventBus.emitWarning(createMockQuotaState(), 'Warning');

      expect(callback).toHaveBeenCalledTimes(1);

      subscription.dispose();

      const lowQuota = {
        ...createMockQuotaState(),
        remainingPercent: 10,
        remainingTokens: 100000,
      };
      eventBus.emitWarning(lowQuota, 'Warning 2');

      // Should still be 1 because subscription was disposed
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Data', () => {
    it('should include timestamp in events', () => {
      const callback = vi.fn();
      eventBus.onQuotaUpdate(callback);

      eventBus.emitQuotaUpdate([]);

      expect(callback.mock.calls[0][0].timestamp).toBeInstanceOf(Date);
    });

    it('should include previous and current values in warning events', () => {
      const callback = vi.fn();
      eventBus.onWarning(callback);

      eventBus.emitWarning(
        createMockQuotaState(),
        'Warning',
        20,
        15
      );

      expect(callback.mock.calls[0][0].previousValue).toBe(20);
      expect(callback.mock.calls[0][0].currentValue).toBe(15);
    });
  });

  describe('Disposal', () => {
    it('should clear all listeners on dispose', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.onWarning(callback1);
      eventBus.onCritical(callback2);

      eventBus.dispose();

      eventBus.emitWarning(createMockQuotaState(), 'Warning');

      expect(callback1).not.toHaveBeenCalled();
    });
  });
});
