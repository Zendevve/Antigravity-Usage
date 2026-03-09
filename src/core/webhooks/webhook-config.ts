import { z } from 'zod';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'quota.warning'
  | 'quota.critical'
  | 'quota.exhausted'
  | 'forecast.updated'
  | 'source.connected'
  | 'source.disconnected';

/**
 * Webhook HTTP method
 */
export type WebhookMethod = 'POST' | 'PUT';

/**
 * Webhook configuration schema
 */
export const WebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  headers: z.record(z.string()).optional(),
  events: z.array(z.enum([
    'quota.warning',
    'quota.critical',
    'quota.exhausted',
    'forecast.updated',
    'source.connected',
    'source.disconnected'
  ])).default([]),
  template: z.string().optional(),
  retryEnabled: z.boolean().default(true),
  retryMaxAttempts: z.number().min(1).max(10).default(3),
  retryDelayMs: z.number().min(100).max(60000).default(1000),
  timeoutMs: z.number().min(1000).max(30000).default(5000),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

/**
 * Webhook payload for events
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: WebhookEventData;
}

export interface WebhookEventData {
  // Quota event data
  quota?: {
    model: string;
    remainingPercent: number;
    remainingTokens: number;
    totalTokens: number;
    sourceId: string;
  };
  // Warning/Critical event data
  alert?: {
    severity: 'warning' | 'critical';
    message: string;
    previousValue?: number;
    currentValue: number;
  };
  // Forecast event data
  forecast?: {
    estimatedHoursRemaining: number;
    confidence: number;
    riskLevel: string;
  };
  // Source event data
  source?: {
    sourceId: string;
    sourceName: string;
  };
}

/**
 * Default webhook configuration
 */
export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  enabled: false,
  url: '',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  events: [],
  retryEnabled: true,
  retryMaxAttempts: 3,
  retryDelayMs: 1000,
  timeoutMs: 5000,
};

/**
 * Webhook manager state
 */
export interface WebhookManagerState {
  configs: WebhookConfig[];
  lastTriggered: Map<string, Date>;
}

/**
 * Webhook storage keys
 */
export const WEBHOOK_STORAGE_KEYS = {
  CONFIGS: 'k1-antigravity.webhooks',
  STATE: 'k1-antigravity.webhookState',
} as const;

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Build webhook payload with template
 */
export function buildWebhookPayload(
  eventType: WebhookEventType,
  data: WebhookEventData,
  template?: string
): string {
  const basePayload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  if (!template) {
    return JSON.stringify(basePayload);
  }

  // Simple template replacement
  return template
    .replace(/\{\{event\}\}/g, eventType)
    .replace(/\{\{timestamp\}\}/g, basePayload.timestamp)
    .replace(/\{\{data\.quota\.model\}\}/g, data.quota?.model ?? '')
    .replace(/\{\{data\.quota\.remainingPercent\}\}/g, String(data.quota?.remainingPercent ?? ''))
    .replace(/\{\{data\.alert\.message\}\}/g, data.alert?.message ?? '')
    .replace(/\{\{data\.forecast\.estimatedHoursRemaining\}\}/g, String(data.forecast?.estimatedHoursRemaining ?? ''));
}

/**
 * Get all available webhook events
 */
export function getAvailableWebhookEvents(): WebhookEventType[] {
  return [
    'quota.warning',
    'quota.critical',
    'quota.exhausted',
    'forecast.updated',
    'source.connected',
    'source.disconnected',
  ];
}

/**
 * Webhook event descriptions for UI
 */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  'quota.warning': 'Triggered when quota falls below warning threshold',
  'quota.critical': 'Triggered when quota falls below critical threshold',
  'quota.exhausted': 'Triggered when quota is exhausted (0%)',
  'forecast.updated': 'Triggered when forecast is recalculated',
  'source.connected': 'Triggered when a data source connects',
  'source.disconnected': 'Triggered when a data source disconnects',
};
