import { describe, it, expect } from 'vitest';
import {
  WebhookConfigSchema,
  WebhookEventType,
  buildWebhookPayload,
  isValidWebhookUrl,
  getAvailableWebhookEvents,
  DEFAULT_WEBHOOK_CONFIG,
} from '../webhook-config';

describe('WebhookConfigSchema', () => {
  it('should validate a valid webhook config', () => {
    const config = {
      enabled: true,
      url: 'https://example.com/webhook',
      method: 'POST' as const,
      events: ['quota.warning', 'quota.critical'],
    };

    const result = WebhookConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.url).toBe('https://example.com/webhook');
      expect(result.data.events).toContain('quota.warning');
    }
  });

  it('should reject an invalid URL', () => {
    const config = {
      enabled: true,
      url: 'not-a-url',
      method: 'POST',
      events: ['quota.warning'],
    };

    const result = WebhookConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('should use defaults for optional fields', () => {
    const config = {
      url: 'https://example.com/webhook',
    };

    const result = WebhookConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
      expect(result.data.method).toBe('POST');
      expect(result.data.retryEnabled).toBe(true);
    }
  });

  it('should validate event types', () => {
    const validConfig = {
      url: 'https://example.com/webhook',
      events: ['quota.warning', 'forecast.updated', 'source.connected'],
    };

    const result = WebhookConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);

    const invalidConfig = {
      url: 'https://example.com/webhook',
      events: ['invalid.event'],
    };

    const invalidResult = WebhookConfigSchema.safeParse(invalidConfig);
    expect(invalidResult.success).toBe(false);
  });
});

describe('isValidWebhookUrl', () => {
  it('should validate HTTPS URLs', () => {
    expect(isValidWebhookUrl('https://example.com')).toBe(true);
    expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
  });

  it('should validate HTTP URLs', () => {
    expect(isValidWebhookUrl('http://localhost:8080')).toBe(true);
    expect(isValidWebhookUrl('http://192.168.1.1/webhook')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidWebhookUrl('not-a-url')).toBe(false);
    expect(isValidWebhookUrl('')).toBe(false);
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
  });
});

describe('getAvailableWebhookEvents', () => {
  it('should return all available events', () => {
    const events = getAvailableWebhookEvents();
    expect(events).toContain('quota.warning');
    expect(events).toContain('quota.critical');
    expect(events).toContain('quota.exhausted');
    expect(events).toContain('forecast.updated');
    expect(events).toContain('source.connected');
    expect(events).toContain('source.disconnected');
    expect(events.length).toBe(6);
  });
});

describe('buildWebhookPayload', () => {
  it('should build a payload without template', () => {
    const data = {
      quota: {
        model: 'claude-3',
        remainingPercent: 50,
        remainingTokens: 500000,
        totalTokens: 1000000,
        sourceId: 'antigravity-api',
      },
      alert: {
        severity: 'warning' as const,
        message: 'Quota low',
        currentValue: 50,
      },
    };

    const payload = buildWebhookPayload('quota.warning', data);
    const parsed = JSON.parse(payload);

    expect(parsed.event).toBe('quota.warning');
    expect(parsed.data.quota?.model).toBe('claude-3');
    expect(parsed.data.quota?.remainingPercent).toBe(50);
  });

  it('should apply template replacements', () => {
    const data = {
      quota: {
        model: 'claude-3',
        remainingPercent: 50,
        remainingTokens: 500000,
        totalTokens: 1000000,
        sourceId: 'antigravity-api',
      },
    };

    const template = '{"event": "{{event}}", "model": "{{data.quota.model}}", "percent": {{data.quota.remainingPercent}}}';
    const payload = buildWebhookPayload('quota.warning', data, template);

    expect(payload).toContain('"event": "quota.warning"');
    expect(payload).toContain('"model": "claude-3"');
    expect(payload).toContain('"percent": 50');
  });
});

describe('DEFAULT_WEBHOOK_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_WEBHOOK_CONFIG.enabled).toBe(false);
    expect(DEFAULT_WEBHOOK_CONFIG.method).toBe('POST');
    expect(DEFAULT_WEBHOOK_CONFIG.retryEnabled).toBe(true);
    expect(DEFAULT_WEBHOOK_CONFIG.retryMaxAttempts).toBe(3);
    expect(DEFAULT_WEBHOOK_CONFIG.timeoutMs).toBe(5000);
  });
});
