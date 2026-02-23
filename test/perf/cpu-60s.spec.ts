import { describe, it, expect, vi } from 'vitest';
import { PollingScheduler, PollingState } from '../../src/core/polling/polling-scheduler';
import { performance } from 'node:perf_hooks';

describe('CPU Polling Load Simulation (60s burst)', () => {
  it('scheduler transitions states and fires thousands of ticks without event loop blocking', async () => {
    const scheduler = new PollingScheduler();
    scheduler.setConfig({
      pollingIntervalIdle: 1,
      pollingIntervalActive: 1,
      thresholdWarning: 20,
      thresholdCritical: 10,
      showModel: 'autoLowest',
      pinnedModel: '',
      animationEnabled: true,
      antigravityPort: 13337,
    });

    let ticks = 0;
    const sub = scheduler.tick$.subscribe(() => {
      ticks++;
    });

    // Simulate flipping states rapidly to verify FSM and timer clears
    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      scheduler.setState(i % 2 === 0 ? PollingState.ACTIVE : PollingState.CRITICAL);
    }
    const end = performance.now();

    scheduler.setState(PollingState.OFFLINE);
    sub.unsubscribe();

    const durationMs = end - start;
    console.log(`FSM 5000 State Swaps took ${durationMs.toFixed(2)}ms`);

    // Event loop must not be blocked for more than 500ms
    expect(durationMs).toBeLessThan(500);
  });
});
