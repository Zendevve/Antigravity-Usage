import * as vscode from 'vscode';
import { log } from '../../../util/logger';

/**
 * Sparkline trend direction
 */
export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
}

/**
 * Configuration for sparkline rendering
 */
export interface SparklineConfig {
  enabled: boolean;
  windowHours: number;
  width: number;
  height: number;
  colors: {
    green: string;
    yellow: string;
    red: string;
    background: string;
  };
}

/**
 * Default sparkline configuration
 */
export const DEFAULT_SPARKLINE_CONFIG: SparklineConfig = {
  enabled: true,
  windowHours: 24,
  width: 60,
  height: 16,
  colors: {
    green: '#4ec9b0',
    yellow: '#dcdcaa',
    red: '#f14c4c',
    background: 'transparent',
  },
};

/**
 * Data point for sparkline
 */
export interface SparklineDataPoint {
  timestamp: Date;
  value: number; // percentage 0-100
}

/**
 * Result of sparkline rendering
 */
export interface SparklineResult {
  text: string;
  trend: TrendDirection;
  color: string;
  tooltip: string;
  svg?: string; // SVG alternative for webviews
}

/**
 * Canvas-based sparkline renderer for status bar tooltip
 * Uses text-based rendering for status bar and provides SVG for webviews
 */
export class SparklineRenderer {
  private config: SparklineConfig;
  private dataPoints: SparklineDataPoint[] = [];
  private lastRenderedText: string = '';

  constructor(config: Partial<SparklineConfig> = {}) {
    this.config = { ...DEFAULT_SPARKLINE_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SparklineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add a data point to the sparkline
   */
  public addDataPoint(value: number, timestamp: Date = new Date()): void {
    this.dataPoints.push({ timestamp, value });

    // Trim to window size
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.config.windowHours);
    this.dataPoints = this.dataPoints.filter(p => p.timestamp >= cutoff);

    log.debug(`Sparkline data points: ${this.dataPoints.length}`);
  }

  /**
   * Add multiple data points
   */
  public setDataPoints(points: SparklineDataPoint[]): void {
    this.dataPoints = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Trim to window size
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.config.windowHours);
    this.dataPoints = this.dataPoints.filter(p => p.timestamp >= cutoff);
  }

  /**
   * Render sparkline to text representation for status bar tooltip
   */
  public render(): SparklineResult {
    if (!this.config.enabled || this.dataPoints.length < 2) {
      return this.renderFallback();
    }

    // Calculate trend
    const trend = this.calculateTrend();
    const currentValue = this.dataPoints[this.dataPoints.length - 1].value;
    const color = this.getColorForValue(currentValue, trend);

    // Generate ASCII/text sparkline
    const text = this.renderTextSparkline();
    this.lastRenderedText = text;
    const tooltip = this.renderTooltip();

    return {
      text,
      trend,
      color,
      tooltip,
    };
  }

  /**
   * Render sparkline as SVG for webview display
   */
  public renderToSvg(): string | null {
    if (!this.config.enabled || this.dataPoints.length < 2) {
      return null;
    }

    const { width, height, colors } = this.config;
    const padding = 2;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Calculate min/max for scaling
    const values = this.dataPoints.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 100);
    const range = maxVal - minVal || 1;

    // Determine color based on current value and trend
    const currentValue = this.dataPoints[this.dataPoints.length - 1].value;
    const trend = this.calculateTrend();
    const color = this.getColorForValue(currentValue, trend);

    // Generate points for polyline
    const points: string[] = [];
    const fillPoints: string[] = [];

    for (let i = 0; i < this.dataPoints.length; i++) {
      const x = padding + (i / (this.dataPoints.length - 1)) * graphWidth;
      const normalizedY = (this.dataPoints[i].value - minVal) / range;
      const y = height - padding - normalizedY * graphHeight;
      points.push(`${x},${y}`);
      fillPoints.push(`${x},${y}`);
    }

    // Add bottom corners for fill
    fillPoints.unshift(`${padding},${height - padding}`);
    fillPoints.push(`${width - padding},${height - padding}`);

    return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.4" />
      <stop offset="100%" style="stop-color:${color};stop-opacity:0.1" />
    </linearGradient>
  </defs>
  <polygon points="${fillPoints.join(' ')}" fill="url(#sparkGradient)" />
  <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`.trim();
  }

  /**
   * Render text-based sparkline for status bar tooltip
   */
  private renderTextSparkline(): string {
    const values = this.dataPoints.map(d => d.value);
    const numBars = 10;
    const step = Math.max(1, Math.floor(values.length / numBars));

    let bars = '';
    for (let i = 0; i < numBars; i++) {
      const idx = Math.min(i * step, values.length - 1);
      const value = values[idx];
      const filled = Math.round(value / 10);
      bars += '█'.repeat(filled) + '░'.repeat(10 - filled);
    }

    const currentValue = this.dataPoints[this.dataPoints.length - 1].value;
    const arrow = this.getTrendArrow();

    return `[${bars}] ${currentValue.toFixed(0)}% ${arrow}`;
  }

  /**
   * Render tooltip with detailed information
   */
  private renderTooltip(): string {
    const current = this.dataPoints[this.dataPoints.length - 1];
    const first = this.dataPoints[0];
    const change = current.value - first.value;

    const trend = this.calculateTrend();
    const arrow = this.getTrendArrow();
    const timeRange = `${this.config.windowHours}h`;

    let trendText = '';
    if (trend === TrendDirection.UP) {
      trendText = '↑ Increasing quota';
    } else if (trend === TrendDirection.DOWN) {
      trendText = '↓ Depleting quota';
    } else {
      trendText = '→ Stable';
    }

    return `Trend (${timeRange}): ${trendText}
Current: ${current.value.toFixed(1)}%
Start: ${first.value.toFixed(1)}%
Change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%
Data points: ${this.dataPoints.length}`;
  }

  /**
   * Calculate trend direction using linear regression
   */
  private calculateTrend(): TrendDirection {
    if (this.dataPoints.length < 2) {
      return TrendDirection.STABLE;
    }

    // Use linear regression for trend
    const n = this.dataPoints.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = this.dataPoints.reduce((sum, p) => sum + p.value, 0);
    const sumXY = this.dataPoints.reduce((sum, p, i) => sum + i * p.value, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Threshold for stability
    if (Math.abs(slope) < 0.1) {
      return TrendDirection.STABLE;
    }

    return slope > 0 ? TrendDirection.UP : TrendDirection.DOWN;
  }

  /**
   * Get color for a value based on percentage and trend
   */
  private getColorForValue(value: number, trend: TrendDirection): string {
    // Rapid depletion = red
    if (value <= 10 || (value <= 20 && trend === TrendDirection.DOWN)) {
      return this.config.colors.red;
    }

    // Slight decrease = yellow
    if (value <= 30 || trend === TrendDirection.DOWN) {
      return this.config.colors.yellow;
    }

    // Stable/increasing = green
    return this.config.colors.green;
  }

  /**
   * Get trend arrow symbol
   */
  private getTrendArrow(): string {
    const trend = this.calculateTrend();
    switch (trend) {
      case TrendDirection.UP:
        return '↑';
      case TrendDirection.DOWN:
        return '↓';
      default:
        return '→';
    }
  }

  /**
   * Render fallback when insufficient data
   */
  private renderFallback(): SparklineResult {
    return {
      text: this.lastRenderedText || '▌▌▌▌▌▌▌▌▌▌ --',
      trend: TrendDirection.STABLE,
      color: this.config.colors.yellow,
      tooltip: 'Collecting data for trend analysis...',
    };
  }

  /**
   * Get current data points
   */
  public getDataPoints(): SparklineDataPoint[] {
    return [...this.dataPoints];
  }

  /**
   * Clear all data points
   */
  public clear(): void {
    this.dataPoints = [];
    this.lastRenderedText = '';
  }

  /**
   * Check if we have enough data for meaningful trend
   */
  public hasEnoughData(): boolean {
    return this.dataPoints.length >= 2;
  }
}

/**
 * Create sparkline renderer from VSCode configuration
 */
export function createSparklineRenderer(): SparklineRenderer {
  const config = vscode.workspace.getConfiguration('k1-antigravity');

  const sparklineConfig: Partial<SparklineConfig> = {
    enabled: config.get<boolean>('sparklineEnabled', DEFAULT_SPARKLINE_CONFIG.enabled),
    windowHours: config.get<number>('sparklineWindowHours', DEFAULT_SPARKLINE_CONFIG.windowHours),
  };

  return new SparklineRenderer(sparklineConfig);
}
