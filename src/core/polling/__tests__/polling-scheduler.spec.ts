import { describe, it, expect } from 'vitest';
import { PollingScheduler, PollingState } from '../polling-scheduler';
import { take, toArray } from 'rxjs/operators';
import { ConfigSchema } from '../../types/config';

describe('PollingScheduler', () => {
  it('defaults to IDLE interval', async () => {
    const scheduler = new PollingScheduler();
    const config = ConfigSchema.parse({});
    scheduler.setConfig(config);

    const result = await scheduler.interval$.pipe(take(1)).toPromise();
    expect(result).toBe(30000); // default idle
  });

  it('adjusts interval on state change', async () => {
    const scheduler = new PollingScheduler();
    const config = ConfigSchema.parse({});
    scheduler.setConfig(config);

    const intervals: number[] = [];
    const sub = scheduler.interval$.subscribe(v => intervals.push(v));

    scheduler.setState(PollingState.ACTIVE);
    scheduler.setState(PollingState.CRITICAL);
    scheduler.setState(PollingState.OFFLINE);

    sub.unsubscribe();

    // IDLE -> ACTIVE -> CRITICAL -> OFFLINE
    expect(intervals).toEqual([30000, 5000, 2000, 60000]);
  });
});
