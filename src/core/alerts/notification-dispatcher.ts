import * as vscode from 'vscode';
import { Subscription } from 'rxjs';
import { AlertEngine } from './alert-engine';
import { AlertEvent, AlertSeverity } from '../types/alert';
import { log } from '../../util/logger';

export class NotificationDispatcher {
  private subscription?: Subscription;

  constructor(private readonly engine: AlertEngine) { }

  public start() {
    if (this.subscription) return;
    this.subscription = this.engine.alert$.subscribe((alert) => {
      this.dispatch(alert);
    });
    log.info('NotificationDispatcher started');
  }

  public stop() {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    log.info('NotificationDispatcher stopped');
  }

  private dispatch(alert: AlertEvent) {
    if (alert.severity === AlertSeverity.CRITICAL) {
      vscode.window.showErrorMessage(`K1 Antigravity: ${alert.message}`);
    } else if (alert.severity === AlertSeverity.WARNING) {
      vscode.window.showWarningMessage(`K1 Antigravity: ${alert.message}`);
    } else {
      vscode.window.showInformationMessage(`K1 Antigravity: ${alert.message}`);
    }
  }
}
