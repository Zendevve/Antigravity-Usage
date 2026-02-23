import * as vscode from 'vscode';
import { Config } from '../../../core/types/config';

export function getSeverityColor(percent: number, config: Config): vscode.ThemeColor | undefined {
  if (percent <= config.thresholdCritical) {
    return new vscode.ThemeColor('errorForeground');
  }
  if (percent <= config.thresholdWarning) {
    return new vscode.ThemeColor('charts.orange'); // A nice warning color
  }
  return undefined; // default status bar foreground
}

export function getIcon(percent: number, config: Config, isError: boolean = false): string {
  if (isError) return '$(error)';
  if (percent <= config.thresholdCritical) return '$(flame)';
  if (percent <= config.thresholdWarning) return '$(warning)';
  return '$(pulse)';
}
