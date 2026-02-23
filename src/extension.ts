import * as vscode from 'vscode';
import { initI18n, t } from './i18n/setup';
import { detectConnection } from './platform/connection/detector';
import { connectionState$, ConnectionStatus } from './platform/connection/connection-state';
import { log } from './util/logger';
import { DisposableStore } from './util/disposable';
import { ConfigSchema } from './core/types/config';

export async function activate(context: vscode.ExtensionContext) {
  const disposable = new DisposableStore();

  try {
    log.init(context);
    log.info('K1 Antigravity Monitor activating...');

    await initI18n();

    // Default configuration parsing
    const config = ConfigSchema.parse({
      pollingIntervalIdle: 30000,
      pollingIntervalActive: 5000,
      thresholdWarning: 20,
      thresholdCritical: 10,
      showModel: 'autoLowest',
      pinnedModel: '',
      animationEnabled: true,
      antigravityPort: 13337,
    });

    const connectionResult = await detectConnection(context);

    if (connectionResult) {
      log.info(`Antigravity detected on port ${connectionResult.port}`);
      connectionState$.next({
        status: ConnectionStatus.CONNECTED,
        port: connectionResult.port,
        token: connectionResult.token,
      });
    } else {
      log.warn('Could not auto-detect Antigravity.');
      connectionState$.next({ status: ConnectionStatus.DISCONNECTED });
    }

    // Register Phase 1 placeholder commands required by package.json
    disposable.add(vscode.commands.registerCommand('k1.refreshQuota', () => {
      vscode.window.showInformationMessage(t('commands.refreshQuota.title'));
    }));
    disposable.add(vscode.commands.registerCommand('k1.switchModel', () => {
      vscode.window.showInformationMessage(t('commands.switchModel.title'));
    }));
    disposable.add(vscode.commands.registerCommand('k1.togglePanel', () => {
      vscode.window.showInformationMessage(t('commands.togglePanel.title'));
    }));
    disposable.add(vscode.commands.registerCommand('k1.showDiagnostics', () => {
      vscode.window.showInformationMessage(t('commands.showDiagnostics.title'));
    }));

    context.subscriptions.push(disposable);
    log.info('K1 Antigravity Monitor activated successfully.');
  } catch (e) {
    if (e instanceof Error) {
      log.error(`Activation failed: ${e.message}`, e.stack);
    }
    vscode.window.showErrorMessage(t('extension.activationFailed'));
  }
}

export function deactivate() {
  // Handled by DisposableStore
}
