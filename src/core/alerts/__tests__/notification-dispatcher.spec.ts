import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { Subject } from 'rxjs';
import { NotificationDispatcher } from '../notification-dispatcher';
import { AlertEngine } from '../alert-engine';
import { AlertEvent, AlertSeverity } from '../../types/alert';

vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
}));

vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('NotificationDispatcher', () => {
  let mockEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine = {
      alert$: new Subject<AlertEvent>()
    };
  });

  it('dispatches CRITICAL alerts as error messages', () => {
    const dispatcher = new NotificationDispatcher(mockEngine as AlertEngine);
    dispatcher.start();

    mockEngine.alert$.next({
      ruleId: 'test-rule',
      severity: AlertSeverity.CRITICAL,
      message: 'Critical message',
      triggeredAt: new Date(),
      value: 5
    });

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('K1 Antigravity: Critical message');
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();

    dispatcher.stop();
  });

  it('dispatches WARNING alerts as warning messages', () => {
    const dispatcher = new NotificationDispatcher(mockEngine as AlertEngine);
    dispatcher.start();

    mockEngine.alert$.next({
      ruleId: 'test-rule',
      severity: AlertSeverity.WARNING,
      message: 'Warning message',
      triggeredAt: new Date(),
      value: 15
    });

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('K1 Antigravity: Warning message');
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

    dispatcher.stop();
  });
});
