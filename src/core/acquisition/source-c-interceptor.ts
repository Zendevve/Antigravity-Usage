import { z } from 'zod';
import { QuotaSource } from './source-registry';
import { SourceReading, SourceReadingSchema } from '../types';
import { log } from '../../util/logger';

/**
 * Known quota-consuming API endpoints
 */
export interface QuotaEndpoint {
  host: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  quotaCost: number; // tokens consumed per request
}

/**
 * Default monitored endpoints
 */
const DEFAULT_ENDPOINTS: QuotaEndpoint[] = [
  // OpenAI-compatible endpoints
  { host: 'api.openai.com', path: '/v1/chat/completions', method: 'POST', quotaCost: 1000 },
  { host: 'api.openai.com', path: '/v1/completions', method: 'POST', quotaCost: 1000 },
  { host: 'api.openai.com', path: '/v1/embeddings', method: 'POST', quotaCost: 100 },
  // Anthropic endpoints
  { host: 'api.anthropic.com', path: '/v1/messages', method: 'POST', quotaCost: 1000 },
  // Google AI
  { host: 'generativelanguage.googleapis.com', path: '/v1beta/models', method: 'POST', quotaCost: 1000 },
  // Azure OpenAI
  { host: '*.openai.azure.com', path: '/openai/deployments/*/chat/completions', method: 'POST', quotaCost: 1000 },
  // AWS Bedrock
  { host: 'bedrock.*.amazonaws.com', path: '/invocations', method: 'POST', quotaCost: 1000 },
];

/**
 * HTTP request record for quota tracking
 */
interface RequestRecord {
  timestamp: Date;
  endpoint: QuotaEndpoint;
  tokensConsumed: number;
  responseSize?: number;
}

/**
 * Configuration for HTTP Interceptor Source
 */
export interface HttpInterceptorConfig {
  /**
   * List of endpoints to monitor. If not provided, uses defaults.
   */
  endpoints?: QuotaEndpoint[];

  /**
   * Log file path for fallback monitoring (if direct interception unavailable)
   */
  logFilePath?: string;

  /**
   * Initial quota allocation (tokens)
   */
  initialQuota: number;

  /**
   * Time window for quota calculation (ms)
   */
  windowMs?: number;

  /**
   * Whether to enable verbose logging
   */
  verbose?: boolean;
}

/**
 * Request log entry schema (for file-based monitoring)
 */
const RequestLogEntrySchema = z.object({
  timestamp: z.string(),
  method: z.string(),
  url: z.string(),
  statusCode: z.number().optional(),
  responseTokens: z.number().optional(),
});

/**
 * Source C: HTTP Interceptor Source
 * Monitors HTTP requests to known quota-consuming endpoints
 * and calculates quota consumption based on tracked requests
 */
export class HttpInterceptorSource implements QuotaSource {
  public readonly id = 'http-interceptor';

  private config: HttpInterceptorConfig;
  private endpoints: QuotaEndpoint[];
  private requestHistory: RequestRecord[] = [];
  private windowMs: number;
  private verbose: boolean;

  constructor(config: HttpInterceptorConfig) {
    this.config = config;
    this.endpoints = config.endpoints ?? DEFAULT_ENDPOINTS;
    this.windowMs = config.windowMs ?? 3600000; // 1 hour default
    this.verbose = config.verbose ?? false;
  }

  /**
   * Fetch quota data based on tracked HTTP requests
   */
  async fetch(): Promise<SourceReading | null> {
    try {
      // Clean old requests outside the window
      this.pruneOldRequests();

      // Calculate total consumed in the window
      const consumed = this.calculateConsumed();
      const remaining = Math.max(0, this.config.initialQuota - consumed);
      const remainingPercent = (remaining / this.config.initialQuota) * 100;

      if (this.verbose) {
        log.debug(`[${this.id}] Quota: ${remaining}/${this.config.initialQuota} (${remainingPercent.toFixed(1)}%)`);
      }

      return SourceReadingSchema.parse({
        sourceId: this.id,
        remainingPercent: Math.max(0, Math.min(100, remainingPercent)),
        remainingTokens: Math.max(0, remaining),
        totalTokens: this.config.initialQuota,
        model: 'http-interceptor',
        fetchedAt: new Date(),
        freshnessMs: 0,
      });
    } catch (e) {
      log.error(`[${this.id}] Fetch failed`, e);
      return null;
    }
  }

  /**
   * Record an HTTP request to a quota-consuming endpoint
   * This would be called by an HTTP interceptor/hook
   */
  recordRequest(
    url: string,
    method: string,
    responseTokens?: number,
    responseSize?: number
  ): void {
    const endpoint = this.findMatchingEndpoint(url, method);

    if (!endpoint) {
      if (this.verbose) {
        log.debug(`[${this.id}] Ignoring non-monitored request: ${method} ${url}`);
      }
      return;
    }

    const tokensConsumed = responseTokens ?? endpoint.quotaCost;

    const record: RequestRecord = {
      timestamp: new Date(),
      endpoint,
      tokensConsumed,
      responseSize,
    };

    this.requestHistory.push(record);

    if (this.verbose) {
      log.debug(
        `[${this.id}] Recorded request: ${method} ${url} -> ${tokensConsumed} tokens`
      );
    }
  }

  /**
   * Import request logs from a file (fallback method)
   */
  async importLogFile(filePath?: string): Promise<number> {
    const path = filePath ?? this.config.logFilePath;

    if (!path) {
      log.warn(`[${this.id}] No log file path configured`);
      return 0;
    }

    try {
      // In Node.js environment, we'd read the file
      // For browser/VSCode, this would need file system access
      // This is a simplified implementation
      log.info(`[${this.id}] Log file import not fully implemented for: ${path}`);
      return 0;
    } catch (e) {
      log.error(`[${this.id}] Failed to import log file`, e);
      return 0;
    }
  }

  /**
   * Parse and import a single log line
   */
  parseLogLine(line: string): RequestRecord | null {
    try {
      const parsed = RequestLogEntrySchema.parse(JSON.parse(line));

      const endpoint = this.findMatchingEndpoint(parsed.url, parsed.method);
      if (!endpoint) return null;

      return {
        timestamp: new Date(parsed.timestamp),
        endpoint,
        tokensConsumed: parsed.responseTokens ?? endpoint.quotaCost,
        responseSize: parsed.statusCode ? undefined : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Add parsed log entries to history
   */
  addLogEntries(entries: RequestRecord[]): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    const validEntries = entries.filter((e) => e.timestamp.getTime() > cutoff);
    this.requestHistory.push(...validEntries);

    log.info(`[${this.id}] Added ${validEntries.length} log entries`);
  }

  /**
   * Find a matching endpoint pattern for a given URL
   */
  private findMatchingEndpoint(url: string, method: string): QuotaEndpoint | null {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname;
      const path = parsedUrl.pathname;

      for (const endpoint of this.endpoints) {
        // Check method
        if (endpoint.method !== method) continue;

        // Check host (support wildcards)
        if (!this.matchHost(host, endpoint.host)) continue;

        // Check path (support wildcards)
        if (!this.matchPath(path, endpoint.path)) continue;

        return endpoint;
      }
    } catch {
      // Invalid URL format
    }

    return null;
  }

  /**
   * Match host pattern (supports wildcards like star-dot-openai-dot-azure-dot-com)
   */
  private matchHost(host: string, pattern: string): boolean {
    if (host === pattern) return true;

    // Handle wildcard patterns
    if (pattern.startsWith('*.')) {
      const suffix = pattern.substring(1);
      return host.endsWith(suffix) || host === suffix.substring(1);
    }

    return false;
  }

  /**
   * Match path pattern with wildcard support
   */
  private matchPath(path: string, pattern: string): boolean {
    if (path === pattern) return true;

    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = '^' + pattern.replace(/\*/g, '[^/]+') + '$';
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    }

    return false;
  }

  /**
   * Remove requests outside the time window
   */
  private pruneOldRequests(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requestHistory = this.requestHistory.filter(
      (r) => r.timestamp.getTime() > cutoff
    );
  }

  /**
   * Calculate total tokens consumed in the window
   */
  private calculateConsumed(): number {
    return this.requestHistory.reduce((sum, r) => sum + r.tokensConsumed, 0);
  }

  /**
   * Get request history for testing/debugging
   */
  getHistory(): RequestRecord[] {
    return [...this.requestHistory];
  }

  /**
   * Reset the interceptor state
   */
  reset(): void {
    this.requestHistory = [];
    log.info(`[${this.id}] Reset interceptor state`);
  }

  /**
   * Get current configuration
   */
  getConfig(): HttpInterceptorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<HttpInterceptorConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.windowMs) {
      this.windowMs = updates.windowMs;
    }
    if (updates.verbose !== undefined) {
      this.verbose = updates.verbose;
    }
    if (updates.endpoints) {
      this.endpoints = updates.endpoints;
    }
  }
}
