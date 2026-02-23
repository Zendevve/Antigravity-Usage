import * as vscode from 'vscode';
import { log } from '../../../util/logger';
import { getQuotaState } from '../../../core/state/quota-state';
import { connectionState$ } from '../../../platform/connection/connection-state';

export function createShowDiagnosticsHandler() {
  return async () => {
    log.info('Executing command: k1.showDiagnostics');

    // Create or reuse an output channel
    const channel = vscode.window.createOutputChannel('K1 Antigravity Diagnostics');
    channel.clear();

    channel.appendLine('=== K1 Antigravity Diagnostics ===');
    channel.appendLine(`Time: ${new Date().toISOString()}`);
    channel.appendLine('');

    // Connection
    const connection = connectionState$.value;
    channel.appendLine('--- Connection State ---');
    channel.appendLine(`Status: ${connection.status}`);
    channel.appendLine(`Port: ${connection.port || 'Unknown'}`);
    if (connection.error) {
      channel.appendLine(`Error: ${connection.error}`);
    }
    channel.appendLine('');

    // Quota State
    const states = getQuotaState();
    channel.appendLine('--- Quota Readings ---');
    if (states.length === 0) {
      channel.appendLine('No readings available in memory buffer.');
    } else {
      states.forEach((state) => {
        channel.appendLine(`Model: ${state.model}`);
        channel.appendLine(`  Remaining Percent: ${state.remainingPercent.toFixed(2)}%`);
        channel.appendLine(`  Remaining Tokens: ${state.remainingTokens.toLocaleString()}`);
        channel.appendLine(`  Total Tokens: ${state.totalTokens.toLocaleString()}`);
        channel.appendLine(`  Last Fetched: ${new Date(state.fetchedAt).toISOString()}`);
      });
    }

    channel.show(true); // show but preserve focus
  };
}
