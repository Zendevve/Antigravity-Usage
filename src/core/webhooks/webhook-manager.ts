import * as vscode from 'vscode';
import { Memento } from 'vscode';
import { z } from 'zod';
import {
  WebhookConfig,
  WebhookConfigSchema,
  WebhookEventType,
  WebhookEventData,
  buildWebhookPayload,
  DEFAULT_WEBHOOK_CONFIG,
  WEBHOOK_STORAGE_KEYS,
} from './webhook-config';
import { log } from '../../util/logger';

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  durationMs: number;
}

/**
 * Webhook delivery history entry
 */
export interface WebhookDeliveryHistory {
  event: WebhookEventType;
  url: string;
  timestamp: Date;
  result: WebhookDeliveryResult;
}

/**
 * Webhook manager - handles webhook delivery
 */
export class WebhookManager {
  private storage: Memento;
  private configs: Map<string, WebhookConfig> = new Map();
  private deliveryHistory: WebhookDeliveryHistory[] = [];
  private maxHistorySize = 100;
  private isDisposed = false;

  constructor(storage: Memento) {
    this.storage = storage;
    this.loadConfigs();
  }

  /**
   * Load webhook configurations from storage
   */
  private loadConfigs(): void {
    const stored = this.storage.get<WebhookConfig[]>(WEBHOOK_STORAGE_KEYS.CONFIGS, []);
    for (const config of stored) {
      const validated = WebhookConfigSchema.safeParse(config);
      if (validated.success) {
        this.configs.set(config.url, validated.data);
      }
    }
    log.info(`Loaded ${this.configs.size} webhook configurations`);
  }

  /**
   * Save webhook configurations to storage
   */
  private saveConfigs(): void {
    const configs = Array.from(this.configs.values());
    this.storage.update(WEBHOOK_STORAGE_KEYS.CONFIGS, configs);
  }

  /**
   * Add or update a webhook configuration
   */
  public async addWebhook(config: WebhookConfig): Promise<void> {
    const validated = WebhookConfigSchema.parse(config);
    this.configs.set(validated.url, validated);
    this.saveConfigs();
    log.info(`Added/updated webhook: ${validated.url}`);
  }

  /**
   * Remove a webhook configuration
   */
  public async removeWebhook(url: string): Promise<boolean> {
    const deleted = this.configs.delete(url);
    if (deleted) {
      this.saveConfigs();
      log.info(`Removed webhook: ${url}`);
    }
    return deleted;
  }

  /**
   * Get all webhook configurations
   */
  public getWebhooks(): WebhookConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get a specific webhook configuration
   */
  public getWebhook(url: string): WebhookConfig | undefined {
    return this.configs.get(url);
  }

  /**
   * Enable or disable a webhook
   */
  public async setWebhookEnabled(url: string, enabled: boolean): Promise<boolean> {
    const config = this.configs.get(url);
    if (!config) {
      return false;
    }

    config.enabled = enabled;
    this.saveConfigs();
    return true;
  }

  /**
   * Trigger webhooks for an event
   */
  public async triggerEvent(eventType: WebhookEventType, data: WebhookEventData): Promise<void> {
    const promises: Promise<WebhookDeliveryResult>[] = [];

    for (const [url, config] of this.configs) {
      if (!config.enabled) {
        continue;
      }

      if (!config.events.includes(eventType)) {
        continue;
      }

      // Check rate limiting
      const lastTriggered = this.getLastTriggered(url, eventType);
      if (lastTriggered && Date.now() - lastTriggered.getTime() < 5000) {
        log.debug(`Rate limiting webhook: ${url}`);
        continue;
      }

      promises.push(this.deliverWebhook(config, eventType, data));
    }

    await Promise.all(promises);
  }

  /**
   * Deliver a webhook
   */
  private async deliverWebhook(
    config: WebhookConfig,
    eventType: WebhookEventType,
    data: WebhookEventData
  ): Promise<WebhookDeliveryResult> {
    const payload = buildWebhookPayload(eventType, data, config.template);
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    const doRequest = async (): Promise<{ statusCode: number; error?: string }> => {
      try {
        // Use VSCode's simplified web request
        const response = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Sending webhook to ${config.url}`,
            cancellable: false,
          },
          async () => {
            // Create a minimal fetch-like request using VSCode APIs
            // Note: In production, you'd use node's http module via the extension host
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

            try {
              // Use fetch if available (Node.js 18+)
              const response = await fetch(config.url, {
                method: config.method,
                headers: {
                  'Content-Type': 'application/json',
                  ...config.headers,
                },
                body: payload,
                signal: controller.signal,
              });

              clearTimeout(timeout);
              return {
                statusCode: response.status,
                error: response.ok ? undefined : await response.text(),
              };
            } catch (error) {
              clearTimeout(timeout);
              throw error;
            }
          }
        );

        return response;
      } catch (error) {
        return {
          statusCode: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Retry logic
    for (let i = 0; i < config.retryMaxAttempts; i++) {
      attempts++;
      const result = await doRequest();

      if (result.statusCode >= 200 && result.statusCode < 300) {
        const durationMs = Date.now() - startTime;
        const deliveryResult: WebhookDeliveryResult = {
          success: true,
          statusCode: result.statusCode,
          attempts,
          durationMs,
        };

        this.recordDelivery(config.url, eventType, deliveryResult);
        log.info(`Webhook delivered successfully: ${config.url} (${attempts} attempts)`);
        return deliveryResult;
      }

      lastError = result.error;

      if (i < config.retryMaxAttempts - 1 && config.retryEnabled) {
        await this.delay(config.retryDelayMs * (i + 1)); // Exponential backoff
      }
    }

    const durationMs = Date.now() - startTime;
    const deliveryResult: WebhookDeliveryResult = {
      success: false,
      statusCode: 0,
      error: lastError,
      attempts,
      durationMs,
    };

    this.recordDelivery(config.url, eventType, deliveryResult);
    log.error(`Webhook delivery failed: ${config.url} - ${lastError}`);

    return deliveryResult;
  }

  /**
   * Record webhook delivery in history
   */
  private recordDelivery(
    url: string,
    eventType: WebhookEventType,
    result: WebhookDeliveryResult
  ): void {
    this.deliveryHistory.push({
      event: eventType,
      url,
      timestamp: new Date(),
      result,
    });

    // Trim history if needed
    while (this.deliveryHistory.length > this.maxHistorySize) {
      this.deliveryHistory.shift();
    }

    // Update last triggered
    const key = `${url}:${eventType}`;
    this.storage.update(WEBHOOK_STORAGE_KEYS.STATE, {
      lastTriggered: {
        [key]: new Date().toISOString(),
      },
    });
  }

  /**
   * Get last triggered time for a webhook
   */
  private getLastTriggered(url: string, eventType: WebhookEventType): Date | null {
    const state = this.storage.get<{ lastTriggered?: Record<string, string> }>(
      WEBHOOK_STORAGE_KEYS.STATE,
      {}
    );
    const key = `${url}:${eventType}`;
    const timestamp = state?.lastTriggered?.[key];
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Get delivery history
   */
  public getDeliveryHistory(limit?: number): WebhookDeliveryHistory[] {
    if (limit) {
      return this.deliveryHistory.slice(-limit);
    }
    return [...this.deliveryHistory];
  }

  /**
   * Test a webhook configuration
   */
  public async testWebhook(config: WebhookConfig): Promise<WebhookDeliveryResult> {
    const testData: WebhookEventData = {
      quota: {
        model: 'test-model',
        remainingPercent: 50,
        remainingTokens: 500000,
        totalTokens: 1000000,
        sourceId: 'test-source',
      },
      alert: {
        severity: 'warning',
        message: 'This is a test webhook',
        currentValue: 50,
      },
    };

    return this.deliverWebhook(config, 'quota.warning', testData);
  }

  /**
   * Clear all webhook configurations
   */
  public async clearAll(): Promise<void> {
    this.configs.clear();
    this.saveConfigs();
    log.info('Cleared all webhook configurations');
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose the webhook manager
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.configs.clear();
    this.deliveryHistory = [];
  }
}

/**
 * Create a webhook manager from extension context
 */
export function createWebhookManager(storage: Memento): WebhookManager {
  return new WebhookManager(storage);
}
