import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoReconnect } from '../auto-reconnect';
import { connectionState$, ConnectionStatus } from '../../../platform/connection/connection-state';

vi.mock('vscode', () => ({}));

vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('AutoReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('triggers reconnect loop on DISCONNECTED and stops on CONNECTED', async () => {
    let connectCalls = 0;
    const connectFn = vi.fn().mockImplementation(async () => {
      connectCalls++;
      // fail first time, succeed second time
      return connectCalls === 2;
    });

    const reconnect = new AutoReconnect(connectFn, { initialMs: 1000, maxMs: 10000, multiplier: 2 });
    reconnect.start();

    // Trigger disconnect
    connectionState$.next({ status: ConnectionStatus.DISCONNECTED });

    // Should schedule first attempt in 1000ms (+ maybe jitter)
    await vi.advanceTimersByTimeAsync(1100);
    expect(connectFn).toHaveBeenCalledTimes(1);

    // First attempt failed, backoff schedules next in 2000ms
    await vi.advanceTimersByTimeAsync(2100);
    expect(connectFn).toHaveBeenCalledTimes(2);

    // Second attempt succeeded! Internal state pushes CONNECTED globally
    // Ensure loop is stopped and reset
    expect(connectionState$.value.status).toBe(ConnectionStatus.CONNECTED);

    // Advancing won't trigger more calls
    await vi.advanceTimersByTimeAsync(10000);
    expect(connectFn).toHaveBeenCalledTimes(2);

    reconnect.stop();
  });
});
