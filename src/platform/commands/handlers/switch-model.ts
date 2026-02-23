import * as vscode from 'vscode';
import { log } from '../../../util/logger';
import { Config } from '../../../core/types/config';

export function createSwitchModelHandler(config: Config) {
  return async () => {
    log.info('Executing command: k1.switchModel');

    // We fetch current known models from config or state
    // For now, we will offer 'autoLowest' and some known models
    const options: vscode.QuickPickItem[] = [
      {
        label: '$(device-mobile) Auto-select Lowest',
        description: 'Dynamically tracking the lowest remaining model',
        detail: 'autoLowest'
      },
      {
        label: '$(server) claude-3-opus',
        description: 'Pin tracking to Claude 3 Opus',
        detail: 'pinned'
      },
      {
        label: '$(server) claude-3-sonnet',
        description: 'Pin tracking to Claude 3 Sonnet',
        detail: 'pinned'
      },
      {
        label: '$(server) claude-3-haiku',
        description: 'Pin tracking to Claude 3 Haiku',
        detail: 'pinned'
      }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select a quota model to track on the status bar',
    });

    if (selected) {
      log.info(`k1.switchModel User selected: ${selected.label}`);
      const configuration = vscode.workspace.getConfiguration('k1-antigravity');

      if (selected.detail === 'autoLowest') {
        await configuration.update('showModel', 'autoLowest', vscode.ConfigurationTarget.Global);
      } else {
        await configuration.update('showModel', 'pinned', vscode.ConfigurationTarget.Global);
        const modelName = selected.label.replace('$(server) ', '').trim();
        await configuration.update('pinnedModel', modelName, vscode.ConfigurationTarget.Global);
      }
    }
  };
}
