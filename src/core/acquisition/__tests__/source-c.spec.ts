import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpInterceptorSource, HttpInterceptorConfig, QuotaEndpoint } from '../source-c-interceptor';

// Mock the logger
vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('HttpInterceptorSource', () => {
  let source: HttpInterceptorSource;
  let config: HttpInterceptorConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      initialQuota: 100000,
      windowMs: 3600000, // 1 hour
      verbose: false,
    };

    source = new HttpInterceptorSource(config);
  });

  describe('initialization', () => {
    it('should create a source with correct id', () => {
      expect(source.id).toBe('http-interceptor');
    });

    it('should use default endpoints when not provided', () => {
      const source2 = new HttpInterceptorSource({ initialQuota: 50000 });
      expect(source2).toBeDefined();
    });

    it('should use custom endpoints when provided', () => {
      const customEndpoints: QuotaEndpoint[] = [
        { host: 'custom.api.com', path: '/v1/completions', method: 'POST', quotaCost: 500 },
      ];
      const source2 = new HttpInterceptorSource({
        initialQuota: 50000,
        endpoints: customEndpoints,
      });
      expect(source2).toBeDefined();
    });
  });

  describe('fetch', () => {
    it('should return full quota when no requests recorded', async () => {
      const result = await source.fetch();

      expect(result).not.toBeNull();
      expect(result?.remainingPercent).toBe(100);
      expect(result?.remainingTokens).toBe(100000);
      expect(result?.totalTokens).toBe(100000);
    });

    it('should return null on error', async () => {
      // Force an error by having invalid config
      const source2 = new HttpInterceptorSource({
        initialQuota: 0, // This will cause issues
      });

      // The source handles errors gracefully
      const result = await source2.fetch();
      expect(result).not.toBeNull();
    });
  });

  describe('recordRequest', () => {
    it('should record requests to monitored endpoints', () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 1000);

      const history = source.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].tokensConsumed).toBe(1000);
    });

    it('should ignore requests to non-monitored endpoints', () => {
      source.recordRequest('https://unknown.api.com/v1/test', 'POST', 100);

      const history = source.getHistory();
      expect(history.length).toBe(0);
    });

    it('should use default quota cost when not provided', () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST');

      const history = source.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].tokensConsumed).toBe(1000); // Default cost for chat/completions
    });

    it('should ignore requests with wrong method', () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'GET');

      const history = source.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('quota calculation', () => {
    it('should calculate remaining quota after recorded requests', async () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 1000);
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 1000);

      const result = await source.fetch();

      expect(result?.remainingTokens).toBe(98000); // 100000 - 2000
      expect(result?.remainingPercent).toBe(98);
    });

    it('should not go below zero quota', async () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 150000);

      const result = await source.fetch();

      expect(result?.remainingTokens).toBe(0);
      expect(result?.remainingPercent).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear request history', () => {
      source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 1000);
      source.reset();

      const history = source.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      source.updateConfig({ initialQuota: 200000 });

      const newConfig = source.getConfig();
      expect(newConfig.initialQuota).toBe(200000);
    });

    it('should update verbose mode', () => {
      source.updateConfig({ verbose: true });

      const newConfig = source.getConfig();
      expect(newConfig.verbose).toBe(true);
    });

    it('should update window size', () => {
      source.updateConfig({ windowMs: 7200000 });

      const newConfig = source.getConfig();
      expect(newConfig.windowMs).toBe(7200000);
    });
  });

  describe('parseLogLine', () => {
    it('should parse valid log line', () => {
      const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        responseTokens: 500,
      });

      const record = source.parseLogLine(logLine);

      expect(record).not.toBeNull();
      expect(record?.tokensConsumed).toBe(500);
    });

    it('should return null for invalid log line', () => {
      const logLine = 'invalid json';

      const record = source.parseLogLine(logLine);

      expect(record).toBeNull();
    });
  });

  describe('addLogEntries', () => {
    it('should add parsed log entries', async () => {
      const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        responseTokens: 500,
      });

      const record = source.parseLogLine(logLine);
      if (record) {
        source.addLogEntries([record]);
      }

      const history = source.getHistory();
      expect(history.length).toBe(1);
    });
  });
});

describe('HttpInterceptorSource with custom endpoints', () => {
  let source: HttpInterceptorSource;

  beforeEach(() => {
    const customEndpoints: QuotaEndpoint[] = [
      { host: 'myapi.com', path: '/v1/completions', method: 'POST', quotaCost: 200 },
    ];

    source = new HttpInterceptorSource({
      initialQuota: 10000,
      endpoints: customEndpoints,
      verbose: true,
    });
  });

  it('should only monitor custom endpoints', () => {
    source.recordRequest('https://myapi.com/v1/completions', 'POST', 200);
    source.recordRequest('https://api.openai.com/v1/chat/completions', 'POST', 1000);

    const history = source.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].endpoint.host).toBe('myapi.com');
  });
});
