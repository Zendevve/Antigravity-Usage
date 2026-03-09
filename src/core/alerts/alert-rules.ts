import { z } from 'zod';
import { AlertSeverity, AlertRule, AlertRuleSchema } from '../types/alert';
import { Config } from '../types/config';
import { AlertStateManager, AlertHysteresis, AlertCooldown, QuietHours } from './alert-state';

/**
 * Alert rules engine - evaluates quota against configured rules
 * and manages alert lifecycle including hysteresis, cooldown, quiet hours, and snooze
 */
export class AlertRulesEngine {
  private stateManager: AlertStateManager;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.stateManager = new AlertStateManager();
    this.applyConfigToState();
  }

  /**
   * Apply configuration to the alert state manager
   */
  private applyConfigToState(): void {
    // Apply hysteresis settings
    this.stateManager.setHysteresis({
      warning: {
        triggerAt: this.config.thresholdWarning,
        resetAt: this.config.thresholdWarning + (this.config.alertHysteresisWarning ?? 5),
      },
      critical: {
        triggerAt: this.config.thresholdCritical,
        resetAt: this.config.thresholdCritical + (this.config.alertHysteresisCritical ?? 5),
      },
    });

    // Apply cooldown settings
    this.stateManager.setCooldown({
      warningCooldownMs: this.config.alertCooldownWarning ?? 300000,
      criticalCooldownMs: this.config.alertCooldownCritical ?? 120000,
    });

    // Apply quiet hours settings
    this.stateManager.setQuietHours({
      enabled: this.config.quietHoursEnabled ?? false,
      schedule: this.config.quietHoursSchedule ?? {
        daysOfWeek: [0, 6],
        startTime: '22:00',
        endTime: '08:00',
      },
      timezone: this.config.quietHoursTimezone ?? 'UTC',
    });
  }

  /**
   * Update configuration and refresh state
   */
  public updateConfig(config: Config): void {
    this.config = config;
    this.applyConfigToState();
  }

  /**
   * Get the state manager for external access (e.g., snooze controls)
   */
  public getStateManager(): AlertStateManager {
    return this.stateManager;
  }

  /**
   * Check if an alert should be triggered for the given percentage
   * Returns the alert severity if an alert should fire, null otherwise
   */
  public evaluate(percentRemaining: number, modelId: string): AlertSeverity | null {
    // Check quiet hours
    if (this.stateManager.isQuietHoursActive()) {
      return null;
    }

    // Check snooze
    const warningSnoozed = this.stateManager.isSnoozed(AlertSeverity.WARNING);
    const criticalSnoozed = this.stateManager.isSnoozed(AlertSeverity.CRITICAL);

    // Evaluate with hysteresis
    const shouldTriggerCritical = this.stateManager.shouldTriggerCritical(percentRemaining, modelId);
    const shouldTriggerWarning = this.stateManager.shouldTriggerWarning(percentRemaining, modelId);

    // Check critical first (highest priority)
    if (shouldTriggerCritical && !criticalSnoozed) {
      if (this.stateManager.isCooldownComplete(AlertSeverity.CRITICAL, modelId)) {
        // Update hysteresis state
        this.stateManager.updateHysteresisState(shouldTriggerWarning, shouldTriggerCritical, modelId);
        // Record the alert
        this.stateManager.recordAlertSent(AlertSeverity.CRITICAL, modelId);
        return AlertSeverity.CRITICAL;
      }
    }

    // Check warning
    if (shouldTriggerWarning && !warningSnoozed) {
      if (this.stateManager.isCooldownComplete(AlertSeverity.WARNING, modelId)) {
        // Update hysteresis state
        this.stateManager.updateHysteresisState(shouldTriggerWarning, shouldTriggerCritical, modelId);
        // Record the alert
        this.stateManager.recordAlertSent(AlertSeverity.WARNING, modelId);
        return AlertSeverity.WARNING;
      }
    }

    // Update hysteresis state even if we didn't trigger
    this.stateManager.updateHysteresisState(shouldTriggerWarning, shouldTriggerCritical, modelId);

    return null;
  }

  /**
   * Create an alert event from evaluation results
   */
  public createAlertEvent(
    severity: AlertSeverity,
    percentRemaining: number,
    modelId: string,
    message: string
  ): AlertEvent {
    return {
      ruleId: `threshold_${severity.toLowerCase()}`,
      message,
      severity,
      triggeredAt: new Date(),
      value: percentRemaining,
      modelId,
    };
  }
}

/**
 * Extended alert event with model ID
 */
export interface AlertEvent {
  ruleId: string;
  message: string;
  severity: AlertSeverity;
  triggeredAt: Date;
  value: number;
  modelId: string;
}

/**
 * Schema for extended alert event
 */
export const AlertEventExtendedSchema = z.object({
  ruleId: z.string(),
  message: z.string(),
  severity: z.nativeEnum(AlertSeverity),
  triggeredAt: z.date(),
  value: z.number(),
  modelId: z.string(),
});

export type AlertEventExtended = z.infer<typeof AlertEventExtendedSchema>;
