import { PrivacyManager } from '../platform/config/privacy-config';
import { log } from './logger';

/**
 * Telemetry event types
 */
export type TelemetryEventType =
  | 'extension.activated'
  | 'feature.used'
  | 'error.count'
  | 'quota.fetched';

/**
 * Telemetry event data
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  anonymousId: string;
  data?: Record<string, unknown>;
}

/**
 * Telemetry - tracks anonymous usage data when enabled
 *
 * What we track (when enabled):
 * - Extension activation count
 * - Feature usage counts (anonymous)
 * - Error counts (no stack traces)
 *
 * What we NEVER track:
 * - API keys, tokens, credentials
 * - User data, project content
 * - File paths, repository names
 */
export class Telemetry {
  private privacyManager: PrivacyManager;
  private eventQueue: TelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(privacyManager: PrivacyManager) {
    this.privacyManager = privacyManager;
  }

  /**
   * Start the telemetry service
   */
  public start(): void {
    if (!this.privacyManager.isTelemetryEnabled()) {
      log.info('Telemetry disabled, not starting');
      return;
    }

    log.info('Telemetry starting');

    // Flush events every 5 minutes
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the telemetry service
   */
  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining events
    this.flush();

    log.info('Telemetry stopped');
  }

  /**
   * Track an event (if telemetry is enabled)
   */
  public track(type: TelemetryEventType, data?: Record<string, unknown>): void {
    // Don't track if telemetry is disabled
    if (!this.privacyManager.isTelemetryEnabled()) {
      return;
    }

    // Don't track sensitive data
    const sanitizedData = this.sanitizeData(data);

    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      anonymousId: this.privacyManager.getAnonymizedId(),
      data: sanitizedData,
    };

    this.eventQueue.push(event);

    // Flush immediately if queue is large
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Track extension activation
   */
  public trackActivation(): void {
    this.track('extension.activated');
  }

  /**
   * Track feature usage
   */
  public trackFeature(featureName: string): void {
    this.track('feature.used', { feature: featureName });
  }

  /**
   * Track error (without stack trace)
   */
  public trackError(errorType: string): void {
    this.track('error.count', { errorType, hasStackTrace: false });
  }

  /**
   * Track quota fetch
   */
  public trackQuotaFetch(success: boolean): void {
    this.track('quota.fetched', { success });
  }

  /**
   * Flush queued events (send to telemetry endpoint)
   * In a real implementation, this would send to an analytics service
   */
  private flush(): void {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // In a real implementation, we would send these events to an analytics endpoint
    // For now, we just log them (development mode)
    if (process.env.NODE_ENV === 'development') {
      log.debug(`Telemetry: Flushing ${events.length} events`, events);
    }

    // TODO: Send to analytics endpoint when implemented
    // Example: fetch('https://analytics.example.com/api/telemetry', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ events }),
    // });
  }

  /**
   * Sanitize data to remove any potentially sensitive information
   */
  private sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    const sensitivePatterns = [
      'token', 'key', 'secret', 'password', 'auth', 'credential',
      'path', 'file', 'repo', 'user', 'email', 'name'
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Skip sensitive keys
      if (sensitivePatterns.some(pattern => lowerKey.includes(pattern))) {
        continue;
      }

      // Skip long strings (could contain paths or sensitive data)
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = '[redacted]';
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }
}

/**
 * Create telemetry instance
 */
export function createTelemetry(privacyManager: PrivacyManager): Telemetry {
  return new Telemetry(privacyManager);
}
