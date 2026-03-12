import * as vscode from 'vscode';
import { QuotaState } from '../core/types/quota';
import { AlertSeverity } from '../core/types/alert';
import { ForecastResult } from '../core/forecast/forecast-types';
import { log } from '../util/logger';

/**
 * Date range for querying historical data
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Warning event payload
 */
export interface WarningEvent {
  type: 'warning';
  severity: AlertSeverity.WARNING;
  quota: QuotaState;
  message: string;
  timestamp: Date;
  previousValue?: number;
  currentValue: number;
}

/**
 * Critical event payload
 */
export interface CriticalEvent {
  type: 'critical';
  severity: AlertSeverity.CRITICAL;
  quota: QuotaState;
  message: string;
  timestamp: Date;
  previousValue?: number;
  currentValue: number;
}

/**
 * Quota update event payload
 */
export interface QuotaUpdateEvent {
  type: 'quotaUpdate';
  quotas: QuotaState[];
  timestamp: Date;
}

/**
 * Source connection event payload
 */
export interface SourceConnectionEvent {
  type: 'sourceConnected' | 'sourceDisconnected';
  sourceId: string;
  sourceName: string;
  timestamp: Date;
}

/**
 * Forecast update event payload
 */
export interface ForecastUpdateEvent {
  type: 'forecastUpdate';
  forecast: ForecastResult;
  timestamp: Date;
}

/**
 * Union type of all public events
 */
export type PublicExtensionEvent =
  | QuotaUpdateEvent
  | WarningEvent
  | CriticalEvent
  | SourceConnectionEvent
  | ForecastUpdateEvent;

/**
 * Event subscription callback
 */
export type EventCallback<T extends PublicExtensionEvent> = (event: T) => void;

/**
 * Event subscription with dispose method
 */
export interface Subscription {
  dispose(): void;
}

/**
 * Event Bus for public extension events
 * Implements the observer pattern for third-party integrations
 */
export class ExtensionEventBus {
  private listeners: Map<string, Set<EventCallback<PublicExtensionEvent>>> = new Map();
  private disposableStore: vscode.Disposable[] = [];

  /**
   * Subscribe to quota update events
   */
  public onQuotaUpdate(callback: EventCallback<QuotaUpdateEvent>): Subscription {
    return this.addListener('quotaUpdate', callback);
  }

  /**
   * Subscribe to warning events
   */
  public onWarning(callback: EventCallback<WarningEvent>): Subscription {
    return this.addListener('warning', callback);
  }

  /**
   * Subscribe to critical events
   */
  public onCritical(callback: EventCallback<CriticalEvent>): Subscription {
    return this.addListener('critical', callback);
  }

  /**
   * Subscribe to forecast update events
   */
  public onForecastUpdate(callback: EventCallback<ForecastUpdateEvent>): Subscription {
    return this.addListener('forecastUpdate', callback);
  }

  /**
   * Subscribe to source connection events
   */
  public onSourceConnected(callback: EventCallback<SourceConnectionEvent>): Subscription {
    return this.addListener('sourceConnected', callback);
  }

  /**
   * Subscribe to source disconnection events
   */
  public onSourceDisconnected(callback: EventCallback<SourceConnectionEvent>): Subscription {
    return this.addListener('sourceDisconnected', callback);
  }

  /**
   * Emit a quota update event
   */
  public emitQuotaUpdate(quotas: QuotaState[]): void {
    const event: QuotaUpdateEvent = {
      type: 'quotaUpdate',
      quotas,
      timestamp: new Date(),
    };
    this.emit('quotaUpdate', event);
  }

  /**
   * Emit a warning event
   */
  public emitWarning(
    quota: QuotaState,
    message: string,
    previousValue?: number,
    currentValue?: number
  ): void {
    const event: WarningEvent = {
      type: 'warning',
      severity: AlertSeverity.WARNING,
      quota,
      message,
      timestamp: new Date(),
      previousValue,
      currentValue: currentValue ?? quota.remainingPercent,
    };
    this.emit('warning', event);
  }

  /**
   * Emit a critical event
   */
  public emitCritical(
    quota: QuotaState,
    message: string,
    previousValue?: number,
    currentValue?: number
  ): void {
    const event: CriticalEvent = {
      type: 'critical',
      severity: AlertSeverity.CRITICAL,
      quota,
      message,
      timestamp: new Date(),
      previousValue,
      currentValue: currentValue ?? quota.remainingPercent,
    };
    this.emit('critical', event);
  }

  /**
   * Emit a forecast update event
   */
  public emitForecastUpdate(forecast: ForecastResult): void {
    const event: ForecastUpdateEvent = {
      type: 'forecastUpdate',
      forecast,
      timestamp: new Date(),
    };
    this.emit('forecastUpdate', event);
  }

  /**
   * Emit a source connection event
   */
  public emitSourceConnected(sourceId: string, sourceName: string): void {
    const event: SourceConnectionEvent = {
      type: 'sourceConnected',
      sourceId,
      sourceName,
      timestamp: new Date(),
    };
    this.emit('sourceConnected', event);
  }

  /**
   * Emit a source disconnection event
   */
  public emitSourceDisconnected(sourceId: string, sourceName: string): void {
    const event: SourceConnectionEvent = {
      type: 'sourceDisconnected',
      sourceId,
      sourceName,
      timestamp: new Date(),
    };
    this.emit('sourceDisconnected', event);
  }

  /**
   * Add a listener for an event type
   */
  private addListener<T extends PublicExtensionEvent>(
    eventType: string,
    callback: EventCallback<T>
  ): Subscription {
    const wrappedCallback = callback as EventCallback<PublicExtensionEvent>;

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(wrappedCallback);

    return {
      dispose: () => {
        const callbacks = this.listeners.get(eventType);
        if (callbacks) {
          callbacks.delete(wrappedCallback);
        }
      },
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: string, event: PublicExtensionEvent): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(event);
        } catch (error) {
          log.error(`Error in event callback for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Dispose all subscriptions
   */
  public dispose(): void {
    this.listeners.clear();
    for (const disposable of this.disposableStore) {
      disposable.dispose();
    }
    this.disposableStore = [];
  }
}

/**
 * Create a new extension event bus
 */
export function createExtensionEventBus(): ExtensionEventBus {
  return new ExtensionEventBus();
}
