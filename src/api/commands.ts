import * as vscode from 'vscode';
import { QuotaState } from '../core/types/quota';
import { ForecastResult } from '../core/forecast/forecast-types';
import { Config } from '../core/types/config';
import { DateRange, QuotaUpdateEvent, WarningEvent, CriticalEvent, ForecastUpdateEvent } from './events';
import { HistoryStore } from '../platform/storage/history-store';

/**
 * Command interface for programmatic control
 */
export interface ExtensionCommands {
  /**
   * Refresh quota data from all sources
   */
  refreshQuota(): Promise<void>;

  /**
   * Get current quota state
   */
  getQuota(): Promise<QuotaState[]>;

  /**
   * Get forecast data
   */
  getForecast(): Promise<ForecastResult | null>;

  /**
   * Get quota history for a date range
   */
  getHistory(range: DateRange): Promise<import('../platform/storage/history-store').QuotaSnapshot[]>;

  /**
   * Get current configuration
   */
  getConfig(): Config;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<Config>): Promise<void>;

  /**
   * Show the dashboard
   */
  showDashboard(): Promise<void>;

  /**
   * Toggle the dashboard panel
   */
  togglePanel(): Promise<void>;
}

/**
 * Creates the extension commands implementation
 */
export function createExtensionCommands(
  context: vscode.ExtensionContext,
  getQuotaState: () => QuotaState[],
  getForecast: () => ForecastResult | null,
  historyStore: HistoryStore,
  refreshSources: () => Promise<void>
): ExtensionCommands {
  return {
    async refreshQuota(): Promise<void> {
      await refreshSources();
    },

    getQuota(): Promise<QuotaState[]> {
      return Promise.resolve(getQuotaState());
    },

    getForecast(): Promise<ForecastResult | null> {
      return Promise.resolve(getForecast());
    },

    async getHistory(range: DateRange): Promise<import('../platform/storage/history-store').QuotaSnapshot[]> {
      return historyStore.getHistory(range.start, range.end);
    },

    getConfig(): Config {
      const config = vscode.workspace.getConfiguration('k1-antigravity');
      const defaultQuietHoursSchedule = {
        daysOfWeek: [0, 6] as number[],
        startTime: '22:00',
        endTime: '08:00',
      };
      return {
        pollingIntervalIdle: config.get<number>('pollingIntervalIdle', 30000),
        pollingIntervalActive: config.get<number>('pollingIntervalActive', 5000),
        thresholdWarning: config.get<number>('thresholdWarning', 20),
        thresholdCritical: config.get<number>('thresholdCritical', 10),
        showModel: config.get<'autoLowest' | 'pinned'>('showModel', 'autoLowest'),
        pinnedModel: config.get<string>('pinnedModel', ''),
        animationEnabled: config.get<boolean>('animationEnabled', true),
        antigravityPort: config.get<number>('antigravityPort', 13337),
        antigravityToken: config.get<string | undefined>('antigravityToken', undefined),
        sparklineEnabled: config.get<boolean>('sparklineEnabled', true),
        sparklineWindowHours: config.get<number>('sparklineWindowHours', 24),
        historyRetentionDays: config.get<number>('historyRetentionDays', 30),
        historySnapshotIntervalMinutes: config.get<number>('historySnapshotIntervalMinutes', 5),
        alertHysteresisWarning: config.get<number>('alertHysteresisWarning', 5),
        alertHysteresisCritical: config.get<number>('alertHysteresisCritical', 5),
        alertCooldownWarning: config.get<number>('alertCooldownWarning', 300000),
        alertCooldownCritical: config.get<number>('alertCooldownCritical', 120000),
        quietHoursEnabled: config.get<boolean>('quietHoursEnabled', false),
        quietHoursSchedule: config.get<import('../core/types/config').Config['quietHoursSchedule']>('quietHoursSchedule', defaultQuietHoursSchedule) ?? defaultQuietHoursSchedule,
        quietHoursTimezone: config.get<string>('quietHoursTimezone', 'UTC'),
        telemetryEnabled: config.get<boolean>('telemetryEnabled', false),
        localOnlyMode: config.get<boolean>('localOnlyMode', false),
      };
    },

    async updateConfig(config: Partial<Config>): Promise<void> {
      const wsConfig = vscode.workspace.getConfiguration('k1-antigravity');

      for (const [key, value] of Object.entries(config)) {
        await wsConfig.update(key, value, vscode.ConfigurationTarget.Global);
      }
    },

    async showDashboard(): Promise<void> {
      await vscode.commands.executeCommand('k1.showDashboard');
    },

    async togglePanel(): Promise<void> {
      await vscode.commands.executeCommand('k1.togglePanel');
    },
  };
}

/**
 * Subscribe to events using VSCode commands
 */
export function createEventSubscriptions(
  context: vscode.ExtensionContext,
  eventBus: import('./events').ExtensionEventBus,
  onQuotaUpdate: (callback: (event: QuotaUpdateEvent) => void) => void,
  onWarning: (callback: (event: WarningEvent) => void) => void,
  onCritical: (callback: (event: CriticalEvent) => void) => void,
  onForecastUpdate: (callback: (event: ForecastUpdateEvent) => void) => void
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Subscribe to quota updates from internal event system
  onQuotaUpdate((event) => {
    eventBus.emitQuotaUpdate(event.quotas);
  });

  onWarning((event) => {
    eventBus.emitWarning(event.quota, event.message, event.previousValue, event.currentValue);
  });

  onCritical((event) => {
    eventBus.emitCritical(event.quota, event.message, event.previousValue, event.currentValue);
  });

  onForecastUpdate((event) => {
    eventBus.emitForecastUpdate(event.forecast);
  });

  return disposables;
}
