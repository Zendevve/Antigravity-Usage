import { Subject, Subscription } from 'rxjs';
import { QuotaState } from '../types/quota';
import { Config } from '../types/config';
import { AlertEvent, AlertSeverity } from '../types/alert';
import { quotaState$ } from '../state/quota-state';
import { log } from '../../util/logger';
import { t } from '../../i18n/setup';

export class AlertEngine {
  public readonly alert$ = new Subject<AlertEvent>();
  private subscription?: Subscription;
  private config: Config;

  // Track the triggered state per model
  private warningTriggered: Map<string, boolean> = new Map();
  private criticalTriggered: Map<string, boolean> = new Map();

  constructor(initialConfig: Config) {
    this.config = initialConfig;
  }

  public updateConfig(config: Config) {
    this.config = config;
  }

  public start() {
    if (this.subscription) return;
    this.subscription = quotaState$.subscribe((states) => {
      this.evaluate(states);
    });
    log.info('AlertEngine started');
  }

  public stop() {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    log.info('AlertEngine stopped');
  }

  private evaluate(states: QuotaState[]) {
    for (const state of states) {
      this.checkModel(state);
    }
  }

  private checkModel(state: QuotaState) {
    const p = state.remainingPercent;

    // Check critical first
    if (p <= this.config.thresholdCritical) {
      if (!this.criticalTriggered.get(state.model)) {
        this.emitAlert(state, AlertSeverity.CRITICAL, `Critical quota reached for ${state.model} (${p.toFixed(1)}% remaining)`);
        this.warningTriggered.set(state.model, true); // implicitly crossed warning
        this.criticalTriggered.set(state.model, true);
      }
    } else if (p <= this.config.thresholdWarning) {
      // In warning zone, but above critical
      if (!this.warningTriggered.get(state.model)) {
        this.emitAlert(state, AlertSeverity.WARNING, `Warning: Quota low for ${state.model} (${p.toFixed(1)}% remaining)`);
        this.warningTriggered.set(state.model, true);
      }
      // If it recovered from critical, we can reset critical trigger
      if (this.criticalTriggered.get(state.model)) {
        this.criticalTriggered.set(state.model, false);
      }
    } else {
      // Above warning threshold, reset both
      if (this.warningTriggered.get(state.model)) {
        this.warningTriggered.set(state.model, false);
      }
      if (this.criticalTriggered.get(state.model)) {
        this.criticalTriggered.set(state.model, false);
      }
    }
  }

  private emitAlert(state: QuotaState, severity: AlertSeverity, message: string) {
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
}
