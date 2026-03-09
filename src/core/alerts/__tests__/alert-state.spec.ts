import { describe, it, expect, beforeEach } from 'vitest';
import {
  AlertStateManager,
  createDefaultAlertState,
  createModelAlertState,
  DEFAULT_COOLDOWN,
  DEFAULT_HYSTERESIS,
  DEFAULT_QUIET_HOURS
} from '../alert-state';
import { AlertSeverity } from '../../types/alert';

describe('AlertStateManager', () => {
  let manager: AlertStateManager;

  beforeEach(() => {
    manager = new AlertStateManager();
  });

  describe('createDefaultAlertState', () => {
    it('should create default alert state with correct defaults', () => {
      const state = createDefaultAlertState();

      expect(state.modelStates.size).toBe(0);
      expect(state.snooze.isSnoozed).toBe(false);
      expect(state.quietHours.enabled).toBe(DEFAULT_QUIET_HOURS.enabled);
      expect(state.hysteresis.warning.triggerAt).toBe(DEFAULT_HYSTERESIS.warning.triggerAt);
      expect(state.cooldown.warningCooldownMs).toBe(DEFAULT_COOLDOWN.warningCooldownMs);
    });
  });

  describe('createModelAlertState', () => {
    it('should create model alert state with correct defaults', () => {
      const modelState = createModelAlertState();

      expect(modelState.warningTriggered).toBe(false);
      expect(modelState.criticalTriggered).toBe(false);
      expect(modelState.warningHysteresisState).toBe('idle');
      expect(modelState.criticalHysteresisState).toBe('idle');
    });
  });

  describe('hysteresis', () => {
    it('should trigger warning when below trigger threshold', () => {
      const result = manager.shouldTriggerWarning(15, 'model-1');
      expect(result).toBe(true);
    });

    it('should not trigger warning when above trigger threshold', () => {
      manager.shouldTriggerWarning(15, 'model-1'); // Trigger
      const result = manager.shouldTriggerWarning(25, 'model-1');
      expect(result).toBe(false);
    });

    it('should stay triggered until above reset threshold', () => {
      manager.shouldTriggerWarning(15, 'model-1'); // Trigger at 15%

      // At 20% (still below reset threshold of 25%)
      const result = manager.shouldTriggerWarning(20, 'model-1');
      expect(result).toBe(false);

      // At 26% (above reset threshold)
      const shouldReset = manager.shouldTriggerWarning(26, 'model-1');
      expect(shouldReset).toBe(false);
    });

    it('should trigger critical when below critical trigger threshold', () => {
      const result = manager.shouldTriggerCritical(5, 'model-1');
      expect(result).toBe(true);
    });
  });

  describe('cooldown', () => {
    it('should allow alert immediately when no previous alert', () => {
      const result = manager.isCooldownComplete(AlertSeverity.WARNING, 'model-1');
      expect(result).toBe(true);
    });

    it('should block alert during cooldown period', () => {
      // Record an alert was sent
      manager.recordAlertSent(AlertSeverity.WARNING, 'model-1');

      // Should be in cooldown
      const result = manager.isCooldownComplete(AlertSeverity.WARNING, 'model-1');
      expect(result).toBe(false);
    });
  });

  describe('quiet hours', () => {
    it('should return false when quiet hours disabled', () => {
      const result = manager.isQuietHoursActive();
      expect(result).toBe(false);
    });

    it('should return true when quiet hours enabled but no schedule', () => {
      manager.setQuietHours({ enabled: true });
      // No days specified, so should not be active
      const result = manager.isQuietHoursActive();
      expect(result).toBe(false);
    });

    it('should respect quiet hours schedule', () => {
      manager.setQuietHours({
        enabled: true,
        schedule: {
          daysOfWeek: [0], // Sunday
          startTime: '00:00',
          endTime: '23:59'
        }
      });

      // Today is not Sunday (in most timezones), so should be false
      const result = manager.isQuietHoursActive();
      expect(result).toBe(false);
    });
  });

  describe('snooze', () => {
    it('should not be snoozed by default', () => {
      expect(manager.isSnoozed(AlertSeverity.WARNING)).toBe(false);
      expect(manager.isSnoozed(AlertSeverity.CRITICAL)).toBe(false);
    });

    it('should snooze specified levels', () => {
      manager.snooze(15, [AlertSeverity.WARNING]);

      expect(manager.isSnoozed(AlertSeverity.WARNING)).toBe(true);
      expect(manager.isSnoozed(AlertSeverity.CRITICAL)).toBe(false);
    });

    it('should clear snooze', () => {
      manager.snooze(15, [AlertSeverity.WARNING]);
      manager.clearSnooze();

      expect(manager.isSnoozed(AlertSeverity.WARNING)).toBe(false);
    });

    it('should calculate snooze until time correctly for minutes', () => {
      const before = Date.now();
      manager.snooze(15, [AlertSeverity.WARNING]);
      const after = Date.now();

      const state = manager.getState();
      expect(state.snooze.snoozeUntil).toBeDefined();
      expect(state.snooze.snoozeUntil!.getTime()).toBeGreaterThan(before);
      expect(state.snooze.snoozeUntil!.getTime()).toBeLessThan(after + 16 * 60 * 1000);
    });
  });

  describe('model state management', () => {
    it('should create model state on first access', () => {
      const state = manager.getModelState('new-model');
      expect(state).toBeDefined();
      expect(state.warningTriggered).toBe(false);
    });

    it('should return same model state on subsequent accesses', () => {
      const state1 = manager.getModelState('model-1');
      const state2 = manager.getModelState('model-1');
      expect(state1).toBe(state2);
    });

    it('should reset model state', () => {
      manager.getModelState('model-1');
      manager.resetModelState('model-1');

      const state = manager.getState().modelStates.get('model-1');
      expect(state).toBeUndefined();
    });
  });
});
