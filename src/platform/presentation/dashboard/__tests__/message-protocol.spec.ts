import { describe, it, expect } from 'vitest';
import {
  validateIncomingMessage,
  createQuotaUpdateMessage,
  createThemeChangeMessage,
  createErrorMessage,
  createReadyMessage,
  createExportResponseMessage,
  DEFAULT_DASHBOARD_SETTINGS,
  ToWebviewMessage,
} from '../message-protocol';

describe('Message Protocol', () => {
  describe('validateIncomingMessage', () => {
    it('should validate a valid request-quota message', () => {
      const message = { type: 'request-quota' };
      const result = validateIncomingMessage(message);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('request-quota');
    });

    it('should validate a valid request-history message', () => {
      const message = {
        type: 'request-history',
        range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
      };
      const result = validateIncomingMessage(message);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('request-history');
    });

    it('should validate a valid request-trends message', () => {
      const message = {
        type: 'request-trends',
        windowHours: 24,
        model: 'gpt-4',
      };
      const result = validateIncomingMessage(message);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('request-trends');
    });

    it('should validate a valid export-data message', () => {
      const message = {
        type: 'export-data',
        format: 'csv',
        options: {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-02'),
          },
          includeForecast: true,
          includeStats: true,
        },
      };
      const result = validateIncomingMessage(message);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('export-data');
    });

    it('should reject an invalid message', () => {
      const message = { type: 'invalid-type' };
      const result = validateIncomingMessage(message);
      expect(result).toBeNull();
    });

    it('should reject a message with invalid fields', () => {
      const message = {
        type: 'request-trends',
        windowHours: 'invalid', // Should be number
      };
      const result = validateIncomingMessage(message);
      expect(result).toBeNull();
    });

    it('should reject a message with out-of-range values', () => {
      const message = {
        type: 'request-trends',
        windowHours: 1000, // Should be max 720
      };
      const result = validateIncomingMessage(message);
      expect(result).toBeNull();
    });
  });

  describe('createQuotaUpdateMessage', () => {
    it('should create a valid quota-update message', () => {
      const data = [
        {
          sourceId: 'test',
          remainingPercent: 75.5,
          remainingTokens: 1000000,
          totalTokens: 2000000,
          model: 'gpt-4',
          fetchedAt: new Date(),
          freshnessMs: 5000,
          confidence: 'HIGH' as const,
          sources: [],
        },
      ];
      const message = createQuotaUpdateMessage(data) as ToWebviewMessage;
      expect(message.type).toBe('quota-update');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createThemeChangeMessage', () => {
    it('should create a valid theme-change message', () => {
      const message = createThemeChangeMessage('dark') as ToWebviewMessage;
      expect(message.type).toBe('theme-change');
      expect(message.timestamp).toBeDefined();
    });

    it('should handle light theme', () => {
      const message = createThemeChangeMessage('light') as ToWebviewMessage;
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createErrorMessage', () => {
    it('should create a valid error message', () => {
      const message = createErrorMessage('Test error', 'TEST_CODE') as ToWebviewMessage;
      expect(message.type).toBe('error');
      expect(message.timestamp).toBeDefined();
    });

    it('should create error message without code', () => {
      const message = createErrorMessage('Test error') as ToWebviewMessage;
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createReadyMessage', () => {
    it('should create a valid ready message', () => {
      const message = createReadyMessage() as ToWebviewMessage;
      expect(message.type).toBe('ready');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createExportResponseMessage', () => {
    it('should create a valid export-response message', () => {
      const data = {
        content: 'test,content\n1,2',
        mimeType: 'text/csv',
        filename: 'export.csv',
      };
      const message = createExportResponseMessage(data) as ToWebviewMessage;
      expect(message.type).toBe('export-response');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('DEFAULT_DASHBOARD_SETTINGS', () => {
    it('should have valid default settings', () => {
      expect(DEFAULT_DASHBOARD_SETTINGS.refreshInterval).toBe(30000);
      expect(DEFAULT_DASHBOARD_SETTINGS.defaultTimeRange).toBe('24h');
      expect(DEFAULT_DASHBOARD_SETTINGS.defaultChartType).toBe('line');
      expect(DEFAULT_DASHBOARD_SETTINGS.showForecast).toBe(true);
      expect(DEFAULT_DASHBOARD_SETTINGS.showConfidenceInterval).toBe(true);
      expect(DEFAULT_DASHBOARD_SETTINGS.theme).toBe('system');
    });
  });
});
