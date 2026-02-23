import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertEngine } from '../alert-engine';
import { ConfigSchema } from '../../types/config';
import { AlertSeverity } from '../../types/alert';
import { quotaState$ } from '../../state/quota-state';
import { QuotaState } from '../../types/quota';

vi.mock('vscode', () => ({}));

describe('AlertEngine', () => {
  const config = ConfigSchema.parse({
    thresholdWarning: 20,
    thresholdCritical: 10
  });

  beforeEach(() => {
    vi.clearAllMocks();
    quotaState$.next([]); // Reset state
  });

  it('does not emit an alert when above thresholds', () => {
    const engine = new AlertEngine(config);
    const alertSpy = vi.fn();
    engine.alert$.subscribe(alertSpy);
    engine.start();

    quotaState$.next([
      { model: 'test-model', remainingPercent: 50, fetchedAt: new Date() } as unknown as QuotaState
    ]);

    expect(alertSpy).not.toHaveBeenCalled();
    engine.stop();
  });

  it('emits a WARNING when crossing warning threshold', () => {
    const engine = new AlertEngine(config);
    const alertSpy = vi.fn();
    engine.alert$.subscribe(alertSpy);
    engine.start();

    // Cross warning threshold
    quotaState$.next([
      { model: 'test-model', remainingPercent: 15, fetchedAt: new Date() } as unknown as QuotaState
    ]);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({
      severity: AlertSeverity.WARNING,
      value: 15
    }));

    // Trigger same state again (should debounce)
    quotaState$.next([
      { model: 'test-model', remainingPercent: 14, fetchedAt: new Date() } as unknown as QuotaState
    ]);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it('emits a CRITICAL when crossing critical threshold', () => {
    const engine = new AlertEngine(config);
    const alertSpy = vi.fn();
    engine.alert$.subscribe(alertSpy);
    engine.start();

    // Cross critical directly
    quotaState$.next([
      { model: 'test-model', remainingPercent: 5, fetchedAt: new Date() } as unknown as QuotaState
    ]);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({
      severity: AlertSeverity.CRITICAL,
      value: 5
    }));

    engine.stop();
  });

  it('resets alert state when recovering above thresholds', () => {
    const engine = new AlertEngine(config);
    const alertSpy = vi.fn();
    engine.alert$.subscribe(alertSpy);
    engine.start();

    // Drop to warning
    quotaState$.next([
      { model: 'test-model', remainingPercent: 15, fetchedAt: new Date() } as unknown as QuotaState
    ]);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // Recover
    quotaState$.next([
      { model: 'test-model', remainingPercent: 50, fetchedAt: new Date() } as unknown as QuotaState
    ]);

    // Drop to warning again
    quotaState$.next([
      { model: 'test-model', remainingPercent: 15, fetchedAt: new Date() } as unknown as QuotaState
    ]);

    // Should trigger again after resetting
    expect(alertSpy).toHaveBeenCalledTimes(2);

    engine.stop();
  });
});
