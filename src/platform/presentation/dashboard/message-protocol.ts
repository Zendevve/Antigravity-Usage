import { z } from 'zod';
import type { QuotaState } from '../../../core/types/quota';
import type { ForecastResult } from '../../../core/forecast/forecast-types';
import type { QuotaSnapshot } from '../../storage/history-store';
import type { TrendData, ModelStats } from '../../storage/query-api';
import { log } from '../../../util/logger';

/**
 * Message protocol version for backward compatibility
 */
export const MESSAGE_VERSION = '1.0';

/**
 * Date range for queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

export const DateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
});

export type DateRangeInput = z.infer<typeof DateRangeSchema>;

/**
 * User settings for dashboard
 */
export interface DashboardSettings {
  refreshInterval: number; // ms
  defaultTimeRange: '24h' | '7d' | '30d';
  defaultChartType: 'line' | 'bar' | 'area';
  showForecast: boolean;
  showConfidenceInterval: boolean;
  theme: 'dark' | 'light' | 'system';
}

export const DashboardSettingsSchema = z.object({
  refreshInterval: z.number().min(5000).max(60000),
  defaultTimeRange: z.enum(['24h', '7d', '30d']),
  defaultChartType: z.enum(['line', 'bar', 'area']),
  showForecast: z.boolean(),
  showConfidenceInterval: z.boolean(),
  theme: z.enum(['dark', 'light', 'system']),
});

export type DashboardSettingsInput = z.infer<typeof DashboardSettingsSchema>;

/**
 * Default dashboard settings
 */
export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  refreshInterval: 30000,
  defaultTimeRange: '24h',
  defaultChartType: 'line',
  showForecast: true,
  showConfidenceInterval: true,
  theme: 'system',
};

/**
 * Messages from Extension to WebView
 */
export interface SerializedTrendData {
  timestamp: string;
  value: number;
  model: string;
}

export type ToWebviewMessage =
  | { type: 'quota-update'; data: QuotaState[]; timestamp: string }
  | { type: 'forecast-update'; data: ForecastResult; timestamp: string }
  | { type: 'history-update'; data: QuotaSnapshot[]; timestamp: string }
  | { type: 'trend-update'; data: SerializedTrendData[]; timestamp: string }
  | { type: 'model-stats-update'; data: ModelStats[]; timestamp: string }
  | { type: 'theme-change'; theme: 'dark' | 'light'; timestamp: string }
  | { type: 'settings-update'; settings: DashboardSettings; timestamp: string }
  | { type: 'error'; message: string; code?: string; timestamp: string }
  | { type: 'ready'; version: string; timestamp: string }
  | { type: 'export-response'; data: ExportResponse; timestamp: string };

/**
 * Schema for validating outgoing messages (relaxed for compatibility)
 */
export const ToWebviewMessageSchema = z.object({
  type: z.enum([
    'quota-update',
    'forecast-update',
    'history-update',
    'trend-update',
    'model-stats-update',
    'theme-change',
    'settings-update',
    'error',
    'ready',
    'export-response',
  ]),
  data: z.unknown().optional(),
  timestamp: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  settings: z.unknown().optional(),
  version: z.string().optional(),
});

/**
 * Export response data
 */
export interface ExportResponse {
  content: string;
  mimeType: string;
  filename: string;
}

/**
 * Messages from WebView to Extension
 */
export type ToExtensionMessage =
  | { type: 'request-quota' }
  | { type: 'request-forecast'; model?: string }
  | { type: 'request-history'; range: DateRange; model?: string }
  | { type: 'request-trends'; windowHours: number; model?: string }
  | { type: 'request-model-stats'; days: number }
  | { type: 'export-data'; format: 'csv' | 'json' | 'pdf'; options: ExportOptions }
  | { type: 'change-settings'; settings: Partial<DashboardSettings> }
  | { type: 'ping' };

/**
 * Export options
 */
export interface ExportOptions {
  dateRange: DateRange;
  models?: string[];
  includeCharts?: boolean;
  includeForecast?: boolean;
  includeStats?: boolean;
  filename?: string;
}

export const ExportOptionsSchema = z.object({
  dateRange: DateRangeSchema,
  models: z.array(z.string()).optional(),
  includeCharts: z.boolean().default(true),
  includeForecast: z.boolean().default(true),
  includeStats: z.boolean().default(true),
  filename: z.string().optional(),
});

export type ExportOptionsInput = z.infer<typeof ExportOptionsSchema>;

/**
 * Schema for validating incoming messages
 */
export const ToExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('request-quota'),
  }),
  z.object({
    type: z.literal('request-forecast'),
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal('request-history'),
    range: DateRangeSchema,
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal('request-trends'),
    windowHours: z.number().min(1).max(720),
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal('request-model-stats'),
    days: z.number().min(1).max(365),
  }),
  z.object({
    type: z.literal('export-data'),
    format: z.enum(['csv', 'json', 'pdf']),
    options: ExportOptionsSchema,
  }),
  z.object({
    type: z.literal('change-settings'),
    settings: DashboardSettingsSchema.partial(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

/**
 * Response from Extension to WebView
 */
export type WebviewResponse<T> =
  | { success: true; data: T; requestId: string }
  | { success: false; error: string; code?: string; requestId: string };

/**
 * Validate incoming message from WebView
 */
export function validateIncomingMessage(message: unknown): ToExtensionMessage | null {
  const result = ToExtensionMessageSchema.safeParse(message);
  if (!result.success) {
    log.error('Invalid message from WebView:', result.error.errors);
    return null;
  }
  return result.data;
}

/**
 * Validate outgoing message to WebView
 */
export function validateOutgoingMessage(message: unknown): boolean {
  const result = ToWebviewMessageSchema.safeParse(message);
  if (!result.success) {
    log.error('Invalid message to WebView:', result.error.errors);
    return false;
  }
  return true;
}

/**
 * Create a quota update message
 */
export function createQuotaUpdateMessage(data: QuotaState[]): ToWebviewMessage {
  return {
    type: 'quota-update',
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a forecast update message
 */
export function createForecastUpdateMessage(data: ForecastResult): ToWebviewMessage {
  return {
    type: 'forecast-update',
    data: data as unknown as ForecastResult,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a history update message
 */
export function createHistoryUpdateMessage(data: QuotaSnapshot[]): ToWebviewMessage {
  return {
    type: 'history-update',
    data: data.map(s => ({
      ...s,
      timestamp: s.timestamp,
    })),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a theme change message
 */
export function createThemeChangeMessage(theme: 'dark' | 'light'): ToWebviewMessage {
  return {
    type: 'theme-change',
    theme,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(message: string, code?: string): ToWebviewMessage {
  return {
    type: 'error',
    message,
    code,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a ready message
 */
export function createReadyMessage(): ToWebviewMessage {
  return {
    type: 'ready',
    version: MESSAGE_VERSION,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an export response message
 */
export function createExportResponseMessage(data: ExportResponse): ToWebviewMessage {
  return {
    type: 'export-response',
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a date range string to Date objects
 */
export function parseDateRange(range: { start: string; end: string }): DateRange {
  return {
    start: new Date(range.start),
    end: new Date(range.end),
  };
}

/**
 * Convert DateRange to string for serialization
 */
export function serializeDateRange(range: DateRange): { start: string; end: string } {
  return {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  };
}
