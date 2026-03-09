import * as vscode from 'vscode';
import { Config } from '../core/types/config';
import { QuotaState } from '../core/types/quota';
import { ForecastResult } from '../core/forecast/forecast-types';
import { HistoryStore, QuotaSnapshot } from '../platform/storage/history-store';
import { ExtensionEventBus, DateRange, QuotaUpdateEvent, WarningEvent, CriticalEvent, ForecastUpdateEvent, SourceConnectionEvent, Subscription } from './events';
import { ExtensionCommands, createExtensionCommands } from './commands';

/**
 * Public API interface for third-party extensions
 * This is the main entry point for other VSCode extensions to interact with K1 Antigravity
 */
export interface K1AntigravityAPI {
  // Events - Subscribe to quota events
  onQuotaUpdate(callback: (event: QuotaUpdateEvent) => void): Subscription;
  onWarning(callback: (event: WarningEvent) => void): Subscription;
  onCritical(callback: (event: CriticalEvent) => void): Subscription;
  onForecastUpdate(callback: (event: ForecastUpdateEvent) => void): Subscription;
  onSourceConnected(callback: (event: SourceConnectionEvent) => void): Subscription;
  onSourceDisconnected(callback: (event: SourceConnectionEvent) => void): Subscription;

  // Commands - Programmatic control
  refreshQuota(): Promise<void>;
  getQuota(): Promise<QuotaState[]>;
  getForecast(): Promise<ForecastResult | null>;
  getHistory(range: DateRange): Promise<QuotaSnapshot[]>;

  // Settings - Configuration access
  getConfig(): Config;
  updateConfig(config: Partial<Config>): Promise<void>;

  // UI - Dashboard control
  showDashboard(): Promise<void>;
  togglePanel(): Promise<void>;

  // Dispose - Clean up
  dispose(): void;
}

/**
 * Extension configuration for API access
 */
export interface ExtensionConfig extends Config {
  apiEnabled: boolean;
  apiKey?: string;
  webhookEnabled: boolean;
  restApiEnabled: boolean;
  restApiPort: number;
}

/**
 * Default API configuration
 */
export const DEFAULT_API_CONFIG: Omit<ExtensionConfig, 'antigravityToken' | 'apiKey'> = {
  pollingIntervalIdle: 30000,
  pollingIntervalActive: 5000,
  thresholdWarning: 20,
  thresholdCritical: 10,
  showModel: 'autoLowest',
  pinnedModel: '',
  animationEnabled: true,
  antigravityPort: 13337,
  sparklineEnabled: true,
  sparklineWindowHours: 24,
  historyRetentionDays: 30,
  historySnapshotIntervalMinutes: 5,
  alertHysteresisWarning: 5,
  alertHysteresisCritical: 5,
  alertCooldownWarning: 300000,
  alertCooldownCritical: 120000,
  quietHoursEnabled: false,
  quietHoursSchedule: {
    daysOfWeek: [0, 6],
    startTime: '22:00',
    endTime: '08:00',
  },
  quietHoursTimezone: 'UTC',
  telemetryEnabled: false,
  localOnlyMode: false,
  apiEnabled: false,
  webhookEnabled: false,
  restApiEnabled: false,
  restApiPort: 13338,
};

/**
 * Implementation of the K1 Antigravity Public API
 */
class K1AntigravityAPIImpl implements K1AntigravityAPI {
  private eventBus: ExtensionEventBus;
  private commands: ExtensionCommands;
  private context: vscode.ExtensionContext;
  private isDisposed = false;

  constructor(
    context: vscode.ExtensionContext,
    eventBus: ExtensionEventBus,
    commands: ExtensionCommands
  ) {
    this.context = context;
    this.eventBus = eventBus;
    this.commands = commands;
  }

  // Events
  public onQuotaUpdate(callback: (event: QuotaUpdateEvent) => void): Subscription {
    return this.eventBus.onQuotaUpdate(callback);
  }

  public onWarning(callback: (event: WarningEvent) => void): Subscription {
    return this.eventBus.onWarning(callback);
  }

  public onCritical(callback: (event: CriticalEvent) => void): Subscription {
    return this.eventBus.onCritical(callback);
  }

  public onForecastUpdate(callback: (event: ForecastUpdateEvent) => void): Subscription {
    return this.eventBus.onForecastUpdate(callback);
  }

  public onSourceConnected(callback: (event: SourceConnectionEvent) => void): Subscription {
    return this.eventBus.onSourceConnected(callback);
  }

  public onSourceDisconnected(callback: (event: SourceConnectionEvent) => void): Subscription {
    return this.eventBus.onSourceDisconnected(callback);
  }

  // Commands
  public async refreshQuota(): Promise<void> {
    return this.commands.refreshQuota();
  }

  public async getQuota(): Promise<QuotaState[]> {
    return this.commands.getQuota();
  }

  public async getForecast(): Promise<ForecastResult | null> {
    return this.commands.getForecast();
  }

  public async getHistory(range: DateRange): Promise<QuotaSnapshot[]> {
    return this.commands.getHistory(range);
  }

  // Settings
  public getConfig(): Config {
    return this.commands.getConfig();
  }

  public async updateConfig(config: Partial<Config>): Promise<void> {
    return this.commands.updateConfig(config);
  }

  // UI
  public async showDashboard(): Promise<void> {
    return this.commands.showDashboard();
  }

  public async togglePanel(): Promise<void> {
    return this.commands.togglePanel();
  }

  // Dispose
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.eventBus.dispose();
  }
}

/**
 * API Factory - Creates the public API instance
 */
export class K1AntigravityAPIFactory {
  private apiInstance: K1AntigravityAPIImpl | null = null;

  /**
   * Create and register the public API
   */
  public register(
    context: vscode.ExtensionContext,
    getQuotaState: () => QuotaState[],
    getForecast: () => ForecastResult | null,
    historyStore: HistoryStore,
    refreshSources: () => Promise<void>
  ): K1AntigravityAPI {
    if (this.apiInstance) {
      return this.apiInstance;
    }

    const eventBus = new ExtensionEventBus();
    const commands = createExtensionCommands(
      context,
      getQuotaState,
      getForecast,
      historyStore,
      refreshSources
    );

    this.apiInstance = new K1AntigravityAPIImpl(context, eventBus, commands);

    // Store the API in the extension context for third-party access
    // Third-party extensions can access it via vscode.extensions.getExtension('zendevve.k1-antigravity-monitor')
    context.subscriptions.push(new vscode.Disposable(() => {
      this.dispose();
    }));

    return this.apiInstance;
  }

  /**
   * Get the registered API instance
   */
  public getAPI(): K1AntigravityAPI | null {
    return this.apiInstance;
  }

  /**
   * Dispose the API
   */
  public dispose(): void {
    if (this.apiInstance) {
      this.apiInstance.dispose();
      this.apiInstance = null;
    }
  }
}

// Export singleton factory
export const apiFactory = new K1AntigravityAPIFactory();

/**
 * Get API version for compatibility checking
 */
export function getAPIVersion(): string {
  return '1.0.0';
}

/**
 * API Version compatibility check
 */
export function isAPIVersionCompatible(version: string): boolean {
  const [major] = version.split('.').map(Number);
  const [apiMajor] = getAPIVersion().split('.').map(Number);
  return major === apiMajor;
}
