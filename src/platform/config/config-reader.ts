import * as vscode from 'vscode';
import { Config, ConfigSchema } from '../../core/types/config';

export function readConfig(): Config {
  const wsConfig = vscode.workspace.getConfiguration('k1-antigravity');

  const raw = {
    pollingIntervalIdle: wsConfig.get('pollingIntervalIdle'),
    pollingIntervalActive: wsConfig.get('pollingIntervalActive'),
    thresholdWarning: wsConfig.get('thresholdWarning'),
    thresholdCritical: wsConfig.get('thresholdCritical'),
    showModel: wsConfig.get('showModel'),
    pinnedModel: wsConfig.get('pinnedModel'),
    animationEnabled: wsConfig.get('animationEnabled'),
    antigravityPort: wsConfig.get('antigravityPort'),
  };

  try {
    return ConfigSchema.parse(raw);
  } catch (e) {
    // If invalid, return defaults by parsing empty object
    return ConfigSchema.parse({});
  }
}
