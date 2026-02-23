import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBarController } from '../status-bar-controller';
import { ConfigSchema } from '../../../../core/types/config';
import { ConnectionStatus } from '../../../connection/connection-state';

const mockStatusBarItem = {
  show: vi.fn(),
  text: '',
  color: undefined,
  tooltip: undefined,
  hide: vi.fn(),
  dispose: vi.fn(),
  command: undefined,
  alignment: undefined,
  priority: undefined,
};

vi.mock('../../../../i18n/setup', () => ({
  t: vi.fn((key: string) => {
    if (key === 'statusBar.warning.calculating') return 'Calculating';
    return key;
  }),
}));

vi.mock('vscode', () => ({
  MarkdownString: class {
    value = '';
    isTrusted = false;
    supportThemeIcons = false;
    appendMarkdown(s: string) { this.value += s; return this; }
  },
  ThemeColor: class {
    constructor(public id: string) { }
  },
  window: {
    createStatusBarItem: vi.fn(() => mockStatusBarItem)
  },
  StatusBarAlignment: { Right: 2 },
}));

// Assuming QuotaState is defined elsewhere or will be defined.
// For the purpose of this edit, we'll define a minimal type if not present.
type QuotaState = {
  model: string;
  totalQuota: number;
  usedQuota: number;
  remainingPercentage: number;
  remainingTokens: number; // Added as per instruction
  timestamp: number;
};

describe('Status Bar Controller', () => {
  let contextMock: any;
  const config = ConfigSchema.parse({ showModel: 'autoLowest', thresholdCritical: 10 });

  beforeEach(() => {
    contextMock = { subscriptions: { push: vi.fn() } };
  });

  it('shows offline state when disconnected', () => {
    const controller = new StatusBarController(contextMock);
    controller.update([], config, { status: ConnectionStatus.DISCONNECTED });

    // access the private item for testing
    const item = (controller as any).item;
    expect(item.text).toContain('Offline');
  });

  it('shows computing state when connected but no readings', () => {
    const controller = new StatusBarController(contextMock);
    controller.update([], config, { status: ConnectionStatus.CONNECTED });

    const item = (controller as any).item;
    expect(item.text).toContain('Calculating');
  });

  it('auto-selects the lowest model reading', () => {
    const controller = new StatusBarController(contextMock);
    const mockState1: QuotaState = {
      model: 'claude-3-haiku',
      totalQuota: 1000,
      usedQuota: 200,
      remainingPercentage: 80,
      remainingTokens: 800,
      timestamp: Date.now()
    };
    const mockState2: QuotaState = {
      model: 'claude-3-opus',
      totalQuota: 1000,
      usedQuota: 900,
      remainingPercentage: 10,
      remainingTokens: 100,
      timestamp: Date.now()
    };
    const readings = [
      { remainingPercent: 50, remainingTokens: 500, totalTokens: 1000, model: 'A', fetchedAt: new Date(), timestamp: Date.now() } as any,
      { remainingPercent: 20, remainingTokens: 200, totalTokens: 1000, model: 'B', fetchedAt: new Date(), timestamp: Date.now() } as any,
      { remainingPercent: 80, remainingTokens: 800, totalTokens: 1000, model: 'C', fetchedAt: new Date(), timestamp: Date.now() } as any,
    ];

    controller.update(readings, config, { status: ConnectionStatus.CONNECTED });
    const item = (controller as any).item;

    // lowest is B (20%)
    expect(item.text).toContain('20.0%');
  });
});
