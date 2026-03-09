import * as vscode from 'vscode';
import { initI18n, t } from './i18n/setup';
import { detectConnection } from './platform/connection/detector';
import { connectionState$, ConnectionStatus } from './platform/connection/connection-state';
import { log } from './util/logger';
import { DisposableStore } from './util/disposable';
import { ConfigSchema } from './core/types/config';

// Sprint 2 & 3 Imports
import { readConfig } from './platform/config/config-reader';
import { ConfigWatcher } from './platform/config/config-watcher';
import { SecretWrapper } from './platform/storage/secret-wrapper';
import { SourceRegistry } from './core/acquisition/source-registry';
import { AntigravityApiSource } from './core/acquisition/source-a-antigravity-api';
import { QuotaStreamTopology } from './core/state/streams';
import { quotaState$ } from './core/state/quota-state';
import { StatusBarController } from './platform/presentation/status-bar/status-bar-controller';
import { AlertEngine } from './core/alerts/alert-engine';
import { NotificationDispatcher } from './core/alerts/notification-dispatcher';
import { AutoReconnect } from './core/connection/auto-reconnect';
import { CommandRegistry } from './platform/commands/command-registry';

import { createRefreshQuotaHandler } from './platform/commands/handlers/refresh-quota';
import { createSwitchModelHandler } from './platform/commands/handlers/switch-model';
import { createTogglePanelHandler } from './platform/commands/handlers/toggle-panel';
import { createShowDiagnosticsHandler } from './platform/commands/handlers/show-diagnostics';

// Sprint 6 Imports
import { createQuotaTreeView } from './platform/presentation/treeview/quota-treeview-provider';
import { HistoryStore, QuotaSource } from './platform/storage/history-store';
import { createQueryApi } from './platform/storage/query-api';

// Global topology reference for clean deactivation
let topology: QuotaStreamTopology | undefined;
let alertEngine: AlertEngine | undefined;
let dispatcher: NotificationDispatcher | undefined;
let autoReconnect: AutoReconnect | undefined;
let commands: CommandRegistry | undefined;
let treeViewProvider: ReturnType<typeof createQuotaTreeView> | undefined;
let historyStore: HistoryStore | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const disposable = new DisposableStore();

  try {
    log.init(context);
    log.info('K1 Antigravity Monitor activating...');

    process.on('unhandledRejection', (reason, promise) => {
      log.error(`Unhandled Promise Rejection at: ${String(promise)}, reason: ${String(reason)}`);
    });

    process.on('uncaughtException', (err) => {
      log.error('Uncaught Exception thrown:', err);
    });

    await initI18n();

    // 1. Storage & Config
    const secrets = new SecretWrapper(context.secrets);
    const initialConfig = readConfig();
    const configWatcher = new ConfigWatcher(context, disposable);

    // Sprint 6: Initialize History Store
    historyStore = new HistoryStore(context.globalState, {
      retentionDays: initialConfig.historyRetentionDays,
      snapshotIntervalMinutes: initialConfig.historySnapshotIntervalMinutes,
    });
    const queryApi = createQueryApi(historyStore);

    // 2. Detection
    const connectionResult = await detectConnection();
    if (connectionResult) {
      log.info(`Antigravity detected on port ${connectionResult.port}`);
      if (connectionResult.token) await secrets.storeToken(connectionResult.token);

      connectionState$.next({
        status: ConnectionStatus.CONNECTED,
        port: connectionResult.port,
        token: connectionResult.token,
      });
    } else {
      log.warn('Could not auto-detect Antigravity.');
      connectionState$.next({ status: ConnectionStatus.DISCONNECTED });
    }

    // 3. Acquisition & Pipeline
    const registry = new SourceRegistry();
    const token = await secrets.getToken();
    registry.register(new AntigravityApiSource(initialConfig.antigravityPort, token));

    topology = new QuotaStreamTopology(registry, initialConfig);

    // 4. Alerts
    alertEngine = new AlertEngine(initialConfig);
    dispatcher = new NotificationDispatcher(alertEngine);

    // 5. Presentation (Status Bar)
    const statusBar = new StatusBarController(context);

    // Sprint 6: TreeView
    treeViewProvider = createQuotaTreeView(context);

    // 6. Subscribe to quota state updates
    // - Update TreeView
    // - Save to history
    const quotaSub = quotaState$.subscribe(async (readings) => {
      // Update TreeView
      treeViewProvider?.update(readings);

      // Save to history store
      if (historyStore && readings.length > 0) {
        for (const reading of readings) {
          await historyStore.saveSnapshot({
            timestamp: reading.fetchedAt,
            source: 'antigravity-api' as QuotaSource,
            model: reading.model,
            quota: reading.remainingPercent,
            used: reading.totalTokens - reading.remainingTokens,
            limit: reading.totalTokens,
          });
        }

        // Also save to sparkline for status bar
        const sparkline = statusBar.getSparkline();
        for (const reading of readings) {
          sparkline.addDataPoint(reading.remainingPercent, reading.fetchedAt);
        }
      }
    });
    disposable.add({ dispose: () => quotaSub.unsubscribe() });

    // 7. Config Watcher Subscriptions
    const configSub = configWatcher.config$.subscribe((cfg) => {
      topology?.updateConfig(cfg);
      alertEngine?.updateConfig(cfg);
    });
    disposable.add({ dispose: () => configSub.unsubscribe() });

    // 8. Auto-Reconnect
    autoReconnect = new AutoReconnect(async () => {
      const result = await detectConnection();
      if (result) {
        if (result.token) await secrets.storeToken(result.token);
        connectionState$.next({
          status: ConnectionStatus.CONNECTED,
          port: result.port,
          token: result.token,
        });
        return true;
      }
      return false;
    });

    // Start background services
    topology.start();
    alertEngine.start();
    dispatcher.start();
    autoReconnect.start();

    // 9. Commands wiring
    commands = new CommandRegistry();
    commands.register('k1.refreshQuota', createRefreshQuotaHandler(topology));
    commands.register('k1.switchModel', createSwitchModelHandler(initialConfig));
    commands.register('k1.togglePanel', createTogglePanelHandler());
    commands.register('k1.showDiagnostics', createShowDiagnosticsHandler());
    disposable.add(commands);

    // Sprint 6: Register history commands
    const historyCleanupCommand = vscode.commands.registerCommand(
      'k1-antigravity.cleanupHistory',
      async () => {
        if (!historyStore) return;
        const deleted = await historyStore.cleanup(initialConfig.historyRetentionDays);
        vscode.window.showInformationMessage(`Cleaned up ${deleted} old records`);
      }
    );
    disposable.add(historyCleanupCommand);

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
  topology?.stop();
  alertEngine?.stop();
  dispatcher?.stop();
  autoReconnect?.stop();
  log.info('K1 Antigravity Monitor deactivated.');
}
