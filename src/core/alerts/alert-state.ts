import { AlertSeverity } from '../types/alert';

/**
 * Alert hysteresis configuration - prevents alert flapping near threshold boundaries
 * Reset threshold = alert threshold + hysteresis margin
 */
export interface AlertHysteresis {
  warning: {
    triggerAt: number;      // e.g., 20%
    resetAt: number;        // e.g., 25% (triggerAt + hysteresis)
  };
  critical: {
    triggerAt: number;      // e.g., 10%
    resetAt: number;         // e.g., 15% (triggerAt + hysteresis)
  };
}

/**
 * Alert cooldown configuration - minimum time between repeated alerts
 */
export interface AlertCooldown {
  warningCooldownMs: number;   // default: 300000 (5 min)
  criticalCooldownMs: number;  // default: 120000 (2 min)
}

/**
 * Quiet hours configuration - scheduled periods when alerts are suppressed
 */
export interface QuietHours {
  enabled: boolean;
  schedule: {
    daysOfWeek?: number[];    // 0-6, Sunday = 0
    startTime?: string;       // "HH:mm" format
    endTime?: string;         // "HH:mm" format
  };
  timezone: string;            // IANA timezone
}

/**
 * Snooze duration options
 */
export type SnoozeDuration = 15 | 60 | 240 | 'until-tomorrow';

/**
 * Alert snooze state
 */
export interface AlertSnooze {
  isSnoozed: boolean;
  snoozeUntil?: Date;
  snoozedLevels: AlertSeverity[];  // which levels are snoozed
}

/**
 * Per-model alert state tracking
 */
export interface ModelAlertState {
  warningTriggered: boolean;
  criticalTriggered: boolean;
  lastWarningAlert?: Date;
  lastCriticalAlert?: Date;
  warningHysteresisState: 'idle' | 'triggered' | 'waiting-reset';
  criticalHysteresisState: 'idle' | 'triggered' | 'waiting-reset';
}

/**
 * Complete alert state for the engine
 */
export interface AlertState {
  modelStates: Map<string, ModelAlertState>;
  snooze: AlertSnooze;
  quietHours: QuietHours;
  hysteresis: AlertHysteresis;
  cooldown: AlertCooldown;
}

/**
 * Default alert hysteresis configuration
 */
export const DEFAULT_HYSTERESIS: AlertHysteresis = {
  warning: {
    triggerAt: 20,
    resetAt: 25,
  },
  critical: {
    triggerAt: 10,
    resetAt: 15,
  },
};

/**
 * Default alert cooldown configuration
 */
export const DEFAULT_COOLDOWN: AlertCooldown = {
  warningCooldownMs: 300000,   // 5 minutes
  criticalCooldownMs: 120000,  // 2 minutes
};

/**
 * Default quiet hours configuration (disabled)
 */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  schedule: {
    daysOfWeek: [0, 6],  // Weekends
    startTime: '22:00',
    endTime: '08:00',
  },
  timezone: 'UTC',
};

/**
 * Create default alert state
 */
export function createDefaultAlertState(): AlertState {
  return {
    modelStates: new Map<string, ModelAlertState>(),
    snooze: {
      isSnoozed: false,
      snoozedLevels: [],
    },
    quietHours: DEFAULT_QUIET_HOURS,
    hysteresis: DEFAULT_HYSTERESIS,
    cooldown: DEFAULT_COOLDOWN,
  };
}

/**
 * Create model alert state for a specific model
 */
export function createModelAlertState(): ModelAlertState {
  return {
    warningTriggered: false,
    criticalTriggered: false,
    warningHysteresisState: 'idle',
    criticalHysteresisState: 'idle',
  };
}

/**
 * Alert state manager - handles hysteresis, cooldown, quiet hours, and snooze
 */
export class AlertStateManager {
  private state: AlertState;

  constructor() {
    this.state = createDefaultAlertState();
  }

  /**
   * Get current alert state
   */
  public getState(): AlertState {
    return this.state;
  }

  /**
   * Update hysteresis configuration
   */
  public setHysteresis(hysteresis: Partial<AlertHysteresis>): void {
    this.state.hysteresis = {
      ...this.state.hysteresis,
      ...hysteresis,
    };
  }

  /**
   * Update cooldown configuration
   */
  public setCooldown(cooldown: Partial<AlertCooldown>): void {
    this.state.cooldown = {
      ...this.state.cooldown,
      ...cooldown,
    };
  }

  /**
   * Update quiet hours configuration
   */
  public setQuietHours(quietHours: Partial<QuietHours>): void {
    this.state.quietHours = {
      ...this.state.quietHours,
      ...quietHours,
    };
  }

  /**
   * Check if quiet hours are currently active
   */
  public isQuietHoursActive(): boolean {
    if (!this.state.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const schedule = this.state.quietHours.schedule;

    // Check day of week if specified
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      const dayOfWeek = now.getDay();
      if (!schedule.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check time range if specified
    if (schedule.startTime && schedule.endTime) {
      const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"

      // Handle overnight ranges (e.g., 22:00-08:00)
      if (schedule.startTime > schedule.endTime) {
        // Overnight: either after start time OR before end time
        if (currentTime < schedule.startTime && currentTime > schedule.endTime) {
          return false;
        }
      } else {
        // Same day range: must be between start and end
        if (currentTime < schedule.startTime || currentTime > schedule.endTime) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if alerts are snoozed for a specific level
   */
  public isSnoozed(severity: AlertSeverity): boolean {
    if (!this.state.snooze.isSnoozed) {
      return false;
    }

    // Check if snooze has expired
    if (this.state.snooze.snoozeUntil && new Date() > this.state.snooze.snoozeUntil) {
      this.clearSnooze();
      return false;
    }

    // Check if this severity level is snoozed
    return this.state.snooze.snoozedLevels.includes(severity);
  }

  /**
   * Snooze alerts for specified duration and levels
   */
  public snooze(duration: SnoozeDuration, levels: AlertSeverity[]): void {
    let snoozeUntil: Date | undefined;

    if (duration === 'until-tomorrow') {
      // Set to 9:00 AM tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      snoozeUntil = tomorrow;
    } else {
      // Add minutes to current time
      snoozeUntil = new Date(Date.now() + duration * 60 * 1000);
    }

    this.state.snooze = {
      isSnoozed: true,
      snoozeUntil,
      snoozedLevels: levels,
    };
  }

  /**
   * Clear snooze state
   */
  public clearSnooze(): void {
    this.state.snooze = {
      isSnoozed: false,
      snoozedLevels: [],
    };
  }

  /**
   * Get or create model-specific state
   */
  public getModelState(modelId: string): ModelAlertState {
    let modelState = this.state.modelStates.get(modelId);
    if (!modelState) {
      modelState = createModelAlertState();
      this.state.modelStates.set(modelId, modelState);
    }
    return modelState;
  }

  /**
   * Check if cooldown has passed since last alert
   */
  public isCooldownComplete(severity: AlertSeverity, modelId: string): boolean {
    const modelState = this.getModelState(modelId);
    const now = Date.now();
    const cooldownMs = severity === AlertSeverity.CRITICAL
      ? this.state.cooldown.criticalCooldownMs
      : this.state.cooldown.warningCooldownMs;

    const lastAlert = severity === AlertSeverity.CRITICAL
      ? modelState.lastCriticalAlert
      : modelState.lastWarningAlert;

    if (!lastAlert) {
      return true;
    }

    return (now - lastAlert.getTime()) >= cooldownMs;
  }

  /**
   * Record that an alert was sent
   */
  public recordAlertSent(severity: AlertSeverity, modelId: string): void {
    const modelState = this.getModelState(modelId);
    const now = new Date();

    if (severity === AlertSeverity.CRITICAL) {
      modelState.lastCriticalAlert = now;
    } else if (severity === AlertSeverity.WARNING) {
      modelState.lastWarningAlert = now;
    }
  }

  /**
   * Reset model alert state
   */
  public resetModelState(modelId: string): void {
    this.state.modelStates.delete(modelId);
  }

  /**
   * Check if warning should be triggered with hysteresis
   * Returns true if warning should fire, false if in hysteresis wait state
   */
  public shouldTriggerWarning(percentRemaining: number, modelId: string): boolean {
    const modelState = this.getModelState(modelId);
    const { triggerAt, resetAt } = this.state.hysteresis.warning;

    switch (modelState.warningHysteresisState) {
      case 'idle':
        return percentRemaining <= triggerAt;

      case 'triggered':
        // After triggering, wait until above reset threshold
        if (percentRemaining > resetAt) {
          modelState.warningHysteresisState = 'idle';
          return false;
        }
        return false;

      case 'waiting-reset':
        // Waiting to reset, trigger again if drops below trigger threshold
        if (percentRemaining <= triggerAt) {
          modelState.warningHysteresisState = 'triggered';
          return true;
        }
        // Also reset if we go above reset threshold
        if (percentRemaining > resetAt) {
          modelState.warningHysteresisState = 'idle';
        }
        return false;
    }
  }

  /**
   * Check if critical should be triggered with hysteresis
   * Returns true if critical should fire, false if in hysteresis wait state
   */
  public shouldTriggerCritical(percentRemaining: number, modelId: string): boolean {
    const modelState = this.getModelState(modelId);
    const { triggerAt, resetAt } = this.state.hysteresis.critical;

    switch (modelState.criticalHysteresisState) {
      case 'idle':
        return percentRemaining <= triggerAt;

      case 'triggered':
        // After triggering, wait until above reset threshold
        if (percentRemaining > resetAt) {
          modelState.criticalHysteresisState = 'idle';
          return false;
        }
        return false;

      case 'waiting-reset':
        // Waiting to reset, trigger again if drops below trigger threshold
        if (percentRemaining <= triggerAt) {
          modelState.criticalHysteresisState = 'triggered';
          return true;
        }
        // Also reset if we go above reset threshold
        if (percentRemaining > resetAt) {
          modelState.criticalHysteresisState = 'idle';
        }
        return false;
    }
  }

  /**
   * Update hysteresis state after alert evaluation
   */
  public updateHysteresisState(wasWarningTriggered: boolean, wasCriticalTriggered: boolean, modelId: string): void {
    const modelState = this.getModelState(modelId);

    // Update warning state
    if (wasWarningTriggered && modelState.warningHysteresisState === 'idle') {
      modelState.warningHysteresisState = 'triggered';
    } else if (!wasWarningTriggered && modelState.warningHysteresisState === 'triggered') {
      modelState.warningHysteresisState = 'waiting-reset';
    }

    // Update critical state
    if (wasCriticalTriggered && modelState.criticalHysteresisState === 'idle') {
      modelState.criticalHysteresisState = 'triggered';
    } else if (!wasCriticalTriggered && modelState.criticalHysteresisState === 'triggered') {
      modelState.criticalHysteresisState = 'waiting-reset';
    }
  }
}
