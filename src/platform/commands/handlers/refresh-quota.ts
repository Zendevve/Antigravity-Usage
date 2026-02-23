import { QuotaStreamTopology } from '../../../core/state/streams';
import { log } from '../../../util/logger';
import * as vscode from 'vscode';

export function createRefreshQuotaHandler(topology: QuotaStreamTopology) {
  return async () => {
    log.info('Executing command: k1.refreshQuota');

    // In our streams topology, the scheduler controls polling.
    // For an immediate refresh, we can call a public forceFetch method on topology.
    // Assuming we add forceFetch() to QuotaStreamTopology mapping to fetchAllSources().

    try {
      await topology.forceFetch();
      vscode.window.setStatusBarMessage('$(sync) K1 Antigravity: Quota Refreshed', 2000);
    } catch (err) {
      log.error('Failed to force fetch quota', err);
      vscode.window.showErrorMessage('Failed to refresh Antigravity quota.');
    }
  };
}
