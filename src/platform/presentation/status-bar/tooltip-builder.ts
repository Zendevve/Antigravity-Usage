import * as vscode from 'vscode';
import { SourceReading } from '../../../core/types/quota';
import { t } from '../../../i18n/setup';

export function buildTooltip(reading: SourceReading | null, isStale: boolean): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;

  if (!reading) {
    md.appendMarkdown('**K1 Antigravity Monitor**\n\nNo data available.');
    return md;
  }

  md.appendMarkdown(`### 🛸 K1 Antigravity Monitor\n\n`);

  if (isStale) {
    md.appendMarkdown(`> **${t('statusBar.warning.stale')}**: ${t('statusBar.tooltip.stale')}\n\n`);
  }

  md.appendMarkdown(`| Metric | Value |\n`);
  md.appendMarkdown(`|---|---|\n`);
  md.appendMarkdown(`| **${t('statusBar.tooltip.model')}** | \`${reading.model}\` |\n`);
  md.appendMarkdown(`| **${t('statusBar.tooltip.remaining')}** | \`${reading.remainingPercent.toFixed(1)}%\` (${reading.remainingTokens.toLocaleString()} / ${reading.totalTokens.toLocaleString()}) |\n`);
  md.appendMarkdown(`| **${t('statusBar.tooltip.updated')}** | \`${new Date(reading.fetchedAt).toLocaleTimeString()}\` |\n`);

  return md;
}
