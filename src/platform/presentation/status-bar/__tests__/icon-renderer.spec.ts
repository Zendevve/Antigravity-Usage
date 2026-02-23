import { describe, it, expect, vi } from 'vitest';
import { getIcon, getSeverityColor } from '../icon-renderer';
import { ConfigSchema } from '../../../../core/types/config';

vi.mock('vscode', () => ({
  ThemeColor: class {
    constructor(public id: string) { }
  }
}));

describe('Status Bar Icon Renderer', () => {
  const config = ConfigSchema.parse({
    thresholdWarning: 20,
    thresholdCritical: 10
  });

  it('returns normal icon for 50%', () => {
    expect(getIcon(50, config)).toBe('$(pulse)');
  });

  it('returns warning icon for 15%', () => {
    expect(getIcon(15, config)).toBe('$(warning)');
  });

  it('returns critical icon for 5%', () => {
    expect(getIcon(5, config)).toBe('$(flame)');
  });

  it('returns error icon if flagged', () => {
    expect(getIcon(50, config, true)).toBe('$(error)');
  });

  it('returns correct severity colors based on thresholds', () => {
    expect(getSeverityColor(50, config)).toBeUndefined();
    expect(getSeverityColor(15, config)?.id).toBe('charts.orange');
    expect(getSeverityColor(5, config)?.id).toBe('errorForeground');
  });
});
