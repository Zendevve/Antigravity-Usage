import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject, Subscription } from 'rxjs';
import { QuotaState } from '../../src/core/types/quota';
import { quotaState$, updateQuotaState } from '../../src/core/state/quota-state';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

describe('Memory Leak Simulation (8 Hours Simulated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaState$.next([]);
  });

  it('keeps heap memory stable over 10,000 quota payload updates', async () => {
    // Warm up the v8 engine
    global.gc?.();
    const initialMem = process.memoryUsage().heapUsed;

    const iterations = 10000;

    // Subscribe just like the AlertEngine to build up any hypothetical stream queue
    let calls = 0;
    const sub = quotaState$.subscribe((states) => {
      calls += states.length; // fake work
    });

    for (let i = 0; i < iterations; i++) {
      // Mock payload changes over time
      const mockStates: QuotaState[] = [{
        sourceId: 'src-1',
        remainingPercent: (Math.random() * 100),
        remainingTokens: 5000,
        totalTokens: 10000,
        model: `model-${i % 5}`,
        fetchedAt: new Date(),
        freshnessMs: i
      }];

      updateQuotaState(mockStates);
    }

    expect(calls).toBeGreaterThan(0);
    sub.unsubscribe();

    // Force GC if exposed, otherwise we accept some variance
    global.gc?.();
    const finalMem = process.memoryUsage().heapUsed;

    const diffMb = (finalMem - initialMem) / 1024 / 1024;
    console.log(`Memory Difference after 10k iterations: ${diffMb.toFixed(2)} MB`);

    // Memory should not grow by more than 15MB for this workload.
    // If it does, we are holding onto refs in the BehaviorSubject forever.
    expect(diffMb).toBeLessThan(15);
  });
});
