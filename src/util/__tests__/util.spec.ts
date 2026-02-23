import { describe, it, expect, vi } from 'vitest';
import { ema, percentile } from '../math';
import { DisposableStore } from '../disposable';
import { isEnabled, Phase } from '../feature-flags';

describe('Math Utils', () => {
  it('calculates ema correctly', () => {
    expect(ema(0.5, 10, 20)).toBe(15);
  });
  it('calculates percentile correctly', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(percentile(arr, 50)).toBe(3);
  });
});

describe('DisposableStore', () => {
  it('disposes all added items', () => {
    const store = new DisposableStore();
    const mockDispose = vi.fn();
    store.add({ dispose: mockDispose });
    store.dispose();
    expect(mockDispose).toHaveBeenCalledOnce();
  });
});

describe('Feature Flags', () => {
  it('returns true for Phase.MVP since default is 1', () => {
    expect(isEnabled(Phase.MVP)).toBe(true);
  });
  it('returns false for Phase.STANDARD since default is 1', () => {
    expect(isEnabled(Phase.STANDARD)).toBe(false);
  });
});
