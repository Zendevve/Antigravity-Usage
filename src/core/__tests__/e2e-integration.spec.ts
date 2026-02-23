import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { QuotaStreamTopology } from '../state/streams';
import { SourceRegistry } from '../acquisition/source-registry';
import { AlertEngine } from '../alerts/alert-engine';
import { NotificationDispatcher } from '../alerts/notification-dispatcher';
import { ConfigSchema } from '../types/config';
import { quotaState$ } from '../state/quota-state';
import { ConnectionStatus, connectionState$ } from '../../platform/connection/connection-state';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
}));

vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('K1 Antigravity Monitoring - Integration Flow', () => {
  const config = ConfigSchema.parse({
    thresholdWarning: 20,
    thresholdCritical: 10,
    pollingIntervalActive: 1000 // min allowed by schema
  });

  let registry: SourceRegistry;
  let topology: QuotaStreamTopology;
  let engine: AlertEngine;
  let dispatcher: NotificationDispatcher;
  let mockSource: any;

  beforeEach(() => {
    vi.clearAllMocks();
    quotaState$.next([]);
    connectionState$.next({ status: ConnectionStatus.DISCONNECTED });

    mockSource = {
      id: 'test-source',
      fetch: vi.fn()
    };

    registry = new SourceRegistry();
    registry.register(mockSource);
    topology = new QuotaStreamTopology(registry, config);
    engine = new AlertEngine(config);
    dispatcher = new NotificationDispatcher(engine);
  });

  it('detects quota drop, processes state, and fires warning toast', async () => {
    // Start the system
    topology.start();
    engine.start();
    dispatcher.start();

    // 1. Simulate data coming from source that hits WARNING threshold (15%)
    mockSource.fetch.mockResolvedValue({
      sourceId: 'test-source',
      model: 'claude-3-opus',
      remainingPercent: 15, // Below 20, above 10
      remainingTokens: 1500,
      totalTokens: 10000,
      fetchedAt: new Date(),
      freshnessMs: 0
    });

    // 2. Trigger fetch
    await topology.forceFetch();

    // 3. State should be accumulated
    const state = quotaState$.value;
    expect(state.length).toBe(1);
    expect(state[0].remainingPercent).toBe(15);

    // 4. Alert Engine should have caught it and Dispatcher should have fired VS Code command
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Quota low for claude-3-opus (15.0% remaining)')
    );

    // Stop system
    topology.stop();
    engine.stop();
    dispatcher.stop();
  });
});
