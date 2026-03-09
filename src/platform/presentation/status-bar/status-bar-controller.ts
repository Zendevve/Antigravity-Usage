import * as vscode from 'vscode';
import { QuotaState, SourceReading } from '../../../core/types/quota';
import { Config } from '../../../core/types/config';
import { getIcon, getSeverityColor } from './icon-renderer';
import { buildTooltip } from './tooltip-builder';
import { StatusBarAnimation } from './animation';
import { SparklineRenderer } from './sparkline-renderer';
import { t } from '../../../i18n/setup';
import { ConnectionInfo, ConnectionStatus } from '../../connection/connection-state';

export class StatusBarController {
  private item: vscode.StatusBarItem;
  private animation: StatusBarAnimation | null = null;
  private sparkline: SparklineRenderer;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'k1.switchModel'; // Placeholder for S2-07
    context.subscriptions.push(this.item);
    this.item.show();

    // Initialize sparkline
    this.sparkline = new SparklineRenderer({
      enabled: true,
      windowHours: 24,
    });
  }

  public update(
    readings: QuotaState[],
    config: Config,
    connection: ConnectionInfo
  ): void {
    if (connection.status === ConnectionStatus.DISCONNECTED) {
      this.item.text = `$(plug) Antigravity Offline`;
      this.item.color = new vscode.ThemeColor('disabledForeground');
      this.item.tooltip = 'Could not connect to local Antigravity instance';
      this.item.accessibilityInformation = { label: 'Antigravity Monitor Offline' };
      this.stopAnimation();
      return;
    }

    if (readings.length === 0) {
      this.item.text = `$(sync~spin) ${t('statusBar.warning.calculating')}`;
      this.item.color = undefined;
      this.item.tooltip = undefined;
      this.item.accessibilityInformation = { label: 'Antigravity Monitor Calculating Quota' };
      this.stopAnimation();
      return;
    }

    const activeReading = this.selectActiveReading(readings, config);
    if (!activeReading) return;

    // S2-08: Stale Data Handling (older than 2x polling interval)
    const isStale = Date.now() - activeReading.fetchedAt.getTime() > (config.pollingIntervalActive * 2);

    const icon = getIcon(activeReading.remainingPercent, config);
    const color = getSeverityColor(activeReading.remainingPercent, config);
    const text = `${activeReading.remainingPercent.toFixed(1)}%`;

    // Update sparkline with new data point
    if (config.sparklineEnabled) {
      this.sparkline.addDataPoint(activeReading.remainingPercent, activeReading.fetchedAt);
    }

    this.item.color = color;
    this.item.tooltip = buildTooltip(activeReading, isStale, this.sparkline);
    this.item.accessibilityInformation = {
      label: `Antigravity Quota: ${text} remaining for ${activeReading.model}${isStale ? ' (Stale)' : ''}`,
      role: 'button'
    };

    // S2-05: Critical Pulse Animation
    if (activeReading.remainingPercent <= config.thresholdCritical) {
      this.startAnimation(text, icon, config);
    } else {
      this.stopAnimation();
      this.item.text = `${icon} ${text}`;
    }
  }

  // S2-06: Auto-lowest model selection logic
  private selectActiveReading(readings: QuotaState[], config: Config): SourceReading | null {
    if (readings.length === 0) return null;

    if (config.showModel === 'pinned' && config.pinnedModel) {
      return readings.find(r => r.model === config.pinnedModel) || readings[0];
    }

    // Auto-lowest default
    return readings.reduce((lowest, current) =>
      current.remainingPercent < lowest.remainingPercent ? current : lowest
    );
  }

  private startAnimation(text: string, icon: string, config: Config) {
    if (!this.animation) {
      this.animation = new StatusBarAnimation(this.item, text, icon);
    }
    this.animation.start(config);
  }

  private stopAnimation() {
    if (this.animation) {
      this.animation.stop();
      this.animation = null;
    }
  }

  /**
   * Get the sparkline renderer for external access
   */
  public getSparkline(): SparklineRenderer {
    return this.sparkline;
  }
}
