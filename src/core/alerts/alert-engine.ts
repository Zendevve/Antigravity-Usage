import { Subject, Subscription } from 'rxjs';
import { QuotaState } from '../types/quota';
import { Config } from '../types/config';
import { AlertEvent, AlertSeverity } from '../types/alert';
import { quotaState$ } from '../state/quota-state';
import { log } from '../../util/logger';
import { t } from '../../i18n/setup';
import { AlertRulesEngine } from './alert-rules';
import { AlertStateManager, SnoozeDuration } from './alert-state';

/**
 * Alert engine - evaluates quota states and emits alert events
 * Uses AlertRulesEngine for hysteresis, cooldown, quiet hours, and snooze handling
 */
export class AlertEngine {
  public readonly alert$ = new Subject<AlertEvent>();
  private subscription?: Subscription;
  private config: Config;
  private rulesEngine: AlertRulesEngine;

  constructor(initialConfig: Config) {
    this.config = initialConfig;
    this.rulesEngine = new AlertRulesEngine(initialConfig);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Config): void {
    this.config = config;
    this.rulesEngine.updateConfig(config);
  }

  /**
   * Get the state manager for external controls (snooze, etc.)
   */
  public getStateManager(): AlertStateManager {
    return this.rulesEngine.getStateManager();
  }

  /**
   * Start the alert engine
   */
  public start(): void {
    if (this.subscription) return;
    this.subscription = quotaState$.subscribe((states) => {
      this.evaluate(states);
    });
    log.info('AlertEngine started');
  }

  /**
   * Stop the alert engine
   */
  public stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    log.info('AlertEngine stopped');
  }

  /**
   * Evaluate quota states and emit alerts if needed
   */
  private evaluate(states: QuotaState[]): void {
    for (const state of states) {
      this.checkModel(state);
    }
  }

  /**
   * Check a single model and emit alerts if thresholds are crossed
   */
  private checkModel(state: QuotaState): void {
    const p = state.remainingPercent;
    const modelId = state.model;

    // Use the rules engine to evaluate with hysteresis, cooldown, quiet hours, snooze
    const alertSeverity = this.rulesEngine.evaluate(p, modelId);

    if (alertSeverity) {
      const message = this.buildAlertMessage(alertSeverity, p, modelId);
      this.emitAlert(state, alertSeverity, message);
    }
  }

  /**
   * Build localized alert message
   */
  private buildAlertMessage(severity: AlertSeverity, percent: number, modelId: string): string {
    const percentStr = percent.toFixed(1);

    if (severity === AlertSeverity.CRITICAL) {
      return t('alert.critical.message', { model: modelId, percent: percentStr });
    } else if (severity === AlertSeverity.WARNING) {
      return t('alert.warning.message', { model: modelId, percent: percentStr });
    }

    return `Quota alert for ${modelId} (${percentStr}% remaining)`;
  }

  /**
   * Emit an alert event
   */
  private emitAlert(state: QuotaState, severity: AlertSeverity, message: string): void {
    const event: AlertEvent = {
      ruleId: `threshold_${severity.toLowerCase()}`,
      message,
      severity,
      triggeredAt: new Date(state.fetchedAt || Date.now()),
      value: state.remainingPercent
    };
    log.warn(`Alert Triggered: [${severity}] ${message}`);
    this.alert$.next(event);
  }

  /**
   * Snooze alerts for a specified duration
   * @param duration - Duration in minutes or 'until-tomorrow'
   * @param levels - Which alert levels to snooze
   */
  public snooze(duration: SnoozeDuration, levels: AlertSeverity[]): void {
    const stateManager = this.getStateManager();
    stateManager.snooze(duration, levels);
    log.info(`Alerts snoozed: ${duration === 'until-tomorrow' ? 'until tomorrow' : duration + ' minutes'} for levels: ${levels.join(', ')}`);
  }

  /**
   * Clear snooze
   */
  public clearSnooze(): void {
    const stateManager = this.getStateManager();
    stateManager.clearSnooze();
    log.info('Alert snooze cleared');
  }

  /**
   * Check if currently in quiet hours
   */
  public isQuietHoursActive(): boolean {
    return this.getStateManager().isQuietHoursActive();
  }

  /**
   * Check if alerts are snoozed
   */
  public isSnoozed(severity: AlertSeverity): boolean {
    return this.getStateManager().isSnoozed(severity);
  }
}
