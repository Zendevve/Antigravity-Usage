import { log } from '../../../util/logger';
import {
  ToExtensionMessage,
  ToWebviewMessage,
  validateIncomingMessage,
  createQuotaUpdateMessage,
  createForecastUpdateMessage,
  createHistoryUpdateMessage,
  createThemeChangeMessage,
  createErrorMessage,
  createReadyMessage,
  createExportResponseMessage,
  DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  ExportResponse,
} from './message-protocol';
import { getQuotaState } from '../../../core/state/quota-state';
import type { HistoryStore } from '../../storage/history-store';
import type { QueryApi , TrendData } from '../../storage/query-api';
import type { ForecastEngine } from '../../../core/forecast/forecast-engine';

import type { ExportService } from './export-service';

/**
 * Callback for sending messages to WebView
 */
export type WebviewSender = (message: ToWebviewMessage) => void;

/**
 * Dashboard message handler
 * Processes messages from the WebView and dispatches appropriate responses
 */
export class DashboardMessageHandler {
  private settings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS };
  private sender: WebviewSender | null = null;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private requestIdCounter = 0;

  constructor(
    private historyStore: HistoryStore,
    private queryApi: QueryApi,
    private exportService: ExportService,
    private forecastEngine: ForecastEngine
  ) { }

  /**
   * Set the message sender function
   */
  setSender(sender: WebviewSender): void {
    this.sender = sender;
  }

  /**
   * Send a message to the WebView
   */
  send(message: ToWebviewMessage): void {
    if (!this.sender) {
      log.warn('DashboardMessageHandler: No sender configured');
      return;
    }
    this.sender(message);
    log.debug(`DashboardMessageHandler: Sent ${message.type}`);
  }

  /**
   * Handle an incoming message from WebView
   */
  async handleMessage(message: unknown): Promise<void> {
    const validated = validateIncomingMessage(message);
    if (!validated) {
      this.send(createErrorMessage('Invalid message format', 'INVALID_FORMAT'));
      return;
    }

    log.debug(`DashboardMessageHandler: Received ${validated.type}`);

    try {
      switch (validated.type) {
        case 'request-quota':
          await this.handleRequestQuota();
          break;
        case 'request-forecast':
          await this.handleRequestForecast(validated.model);
          break;
        case 'request-history':
          await this.handleRequestHistory(validated.range, validated.model);
          break;
        case 'request-trends':
          await this.handleRequestTrends(validated.windowHours, validated.model);
          break;
        case 'request-model-stats':
          await this.handleRequestModelStats(validated.days);
          break;
        case 'export-data':
          await this.handleExportData(validated.format, validated.options);
          break;
        case 'change-settings':
          this.handleChangeSettings(validated.settings);
          break;
        case 'ping':
          this.send({ type: 'ready', version: '1.0', timestamp: new Date().toISOString() });
          break;
        default:
          this.send(createErrorMessage(`Unknown message type`, 'UNKNOWN_TYPE'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`DashboardMessageHandler: Error handling ${validated.type}:`, error);
      this.send(createErrorMessage(errorMessage, 'HANDLER_ERROR'));
    }
  }

  /**
   * Handle request for current quota data
   */
  private async handleRequestQuota(): Promise<void> {
    const quotaState = getQuotaState();
    this.send(createQuotaUpdateMessage(quotaState));
  }

  /**
   * Handle request for forecast data
   */
  private async handleRequestForecast(_model?: string): Promise<void> {
    try {
      // Get history for forecast
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
      const history = await this.queryApi.getHistory(start, now);

      if (history.length === 0) {
        this.send(createErrorMessage('No history data available for forecast', 'NO_DATA'));
        return;
      }

      // Get current quota
      const quotaState = getQuotaState();
      const currentQuota = quotaState.length > 0 ? quotaState[0].remainingPercent : 0;

      // Convert history to time series data
      const timeSeriesData = history.map(h => ({
        timestamp: h.timestamp,
        value: h.quota,
        model: h.model,
      }));

      const forecast = this.forecastEngine.generateForecast(currentQuota, timeSeriesData);
      this.send(createForecastUpdateMessage(forecast));
    } catch (error) {
      log.error('Forecast generation error:', error);
      this.send(createErrorMessage('Forecast generation failed', 'FORECAST_ERROR'));
    }
  }

  /**
   * Handle request for historical data
   */
  private async handleRequestHistory(range: { start: Date; end: Date }, model?: string): Promise<void> {
    try {
      const history = await this.queryApi.getHistory(range.start, range.end, model);
      this.send(createHistoryUpdateMessage(history));
    } catch (error) {
      this.send(createErrorMessage('Failed to retrieve history', 'HISTORY_ERROR'));
    }
  }

  /**
   * Handle request for trend data
   */
  private async handleRequestTrends(windowHours: number, model?: string): Promise<void> {
    try {
      const trends = await this.queryApi.getTrends(windowHours, model);
      // Send trends with timestamp as ISO string for JSON serialization
      const serializedTrends = trends.map((t: TrendData) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
      }));
      this.send({
        type: 'trend-update',
        data: serializedTrends,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.send(createErrorMessage('Failed to retrieve trends', 'TRENDS_ERROR'));
    }
  }

  /**
   * Handle request for model statistics
   */
  private async handleRequestModelStats(days: number): Promise<void> {
    try {
      const stats = await this.queryApi.getModelStats(days);
      this.send({
        type: 'model-stats-update',
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.send(createErrorMessage('Failed to retrieve model stats', 'STATS_ERROR'));
    }
  }

  /**
   * Handle export data request
   */
  private async handleExportData(
    format: 'csv' | 'json' | 'pdf',
    options: {
      dateRange: { start: Date; end: Date };
      models?: string[];
      includeCharts?: boolean;
      includeForecast?: boolean;
      includeStats?: boolean;
      filename?: string;
    }
  ): Promise<void> {
    try {
      const history = await this.queryApi.getHistory(options.dateRange.start, options.dateRange.end);
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case 'csv':
          content = await this.exportService.exportToCSV(history, options);
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          content = await this.exportService.exportToJSON(history, options);
          mimeType = 'application/json';
          extension = 'json';
          break;
        case 'pdf':
          content = await this.exportService.exportToPDF(history, options);
          mimeType = 'text/plain';
          extension = 'txt';
          break;
      }

      // Send the export content to WebView for download
      const exportResponse: ExportResponse = {
        content,
        mimeType,
        filename: options.filename || `quota-export-${Date.now()}.${extension}`,
      };
      this.send(createExportResponseMessage(exportResponse));
    } catch (error) {
      this.send(createErrorMessage('Export failed', 'EXPORT_ERROR'));
    }
  }

  /**
   * Handle settings change
   */
  private handleChangeSettings(newSettings: Partial<DashboardSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.send({
      type: 'settings-update',
      settings: this.settings,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current settings
   */
  getSettings(): DashboardSettings {
    return { ...this.settings };
  }

  /**
   * Send initial ready message
   */
  sendReady(): void {
    this.send(createReadyMessage());
  }

  /**
   * Send theme change notification
   */
  notifyThemeChange(theme: 'dark' | 'light'): void {
    this.send(createThemeChangeMessage(theme));
  }
}

/**
 * Create a message handler instance
 */
export function createDashboardMessageHandler(
  historyStore: HistoryStore,
  queryApi: QueryApi,
  exportService: ExportService,
  forecastEngine: ForecastEngine
): DashboardMessageHandler {
  return new DashboardMessageHandler(historyStore, queryApi, exportService, forecastEngine);
}
