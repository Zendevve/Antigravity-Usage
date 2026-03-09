/**
 * Sample Data Generator Module
 *
 * Generates realistic sample data for demo purposes and helping users understand features.
 */

import * as vscode from 'vscode';

/**
 * Sample data configuration
 */
export interface SampleDataConfig {
  daysOfHistory: number;
  pointsPerDay: number;
  baseQuota: number;
  usagePattern: 'steady' | 'burst' | 'growing' | 'variable';
  includeForecast?: boolean;
}

/**
 * Sample quota data point
 */
export interface SampleDataPoint {
  timestamp: Date;
  quota: number;
  used: number;
  remaining: number;
  percentage: number;
  model: string;
}

/**
 * Sample forecast data
 */
export interface SampleForecast {
  date: Date;
  predictedQuota: number;
  confidence: number;
  method: 'ema' | 'pattern' | 'monte-carlo';
}

/**
 * Default sample data configuration
 */
export const DEFAULT_SAMPLE_CONFIG: SampleDataConfig = {
  daysOfHistory: 14,
  pointsPerDay: 24, // Hourly
  baseQuota: 100000,
  usagePattern: 'variable',
  includeForecast: true,
};

/**
 * Sample data generator
 */
export class SampleDataGenerator {
  private config: SampleDataConfig;

  constructor(config: Partial<SampleDataConfig> = {}) {
    this.config = { ...DEFAULT_SAMPLE_CONFIG, ...config };
  }

  /**
   * Generate sample quota history data
   */
  generateHistory(): SampleDataPoint[] {
    const data: SampleDataPoint[] = [];
    const models = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
    const now = new Date();

    // Generate timestamps going back in time
    const totalPoints = this.config.daysOfHistory * this.config.pointsPerDay;
    const intervalMs = (24 * 60 * 60 * 1000) / this.config.pointsPerDay;

    let currentQuota = this.config.baseQuota;

    for (let i = totalPoints; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * intervalMs);

      // Calculate usage based on pattern
      let usage = this.calculateUsage(i, totalPoints);

      // Add some randomness
      usage = usage * (0.8 + Math.random() * 0.4);

      const remaining = Math.max(0, currentQuota - usage);
      const percentage = (remaining / currentQuota) * 100;

      // Rotate models
      const model = models[i % models.length];

      data.push({
        timestamp,
        quota: currentQuota,
        used: usage,
        remaining,
        percentage,
        model,
      });

      // Reset quota periodically (simulate quota refresh)
      if (i % (totalPoints / this.config.daysOfHistory) === 0) {
        currentQuota = this.config.baseQuota;
      }
    }

    return data;
  }

  /**
   * Calculate usage based on pattern
   */
  private calculateUsage(pointIndex: number, totalPoints: number): number {
    const progress = pointIndex / totalPoints;
    const baseUsage = this.config.baseQuota * 0.15; // ~15% daily usage

    if (this.config.usagePattern === 'steady') {
      return baseUsage;
    }

    if (this.config.usagePattern === 'burst') {
      const burstHour = (pointIndex % this.config.pointsPerDay) / this.config.pointsPerDay;
      if (burstHour > 0.3 && burstHour < 0.5) {
        return baseUsage * 2;
      }
      return baseUsage * 0.5;
    }

    if (this.config.usagePattern === 'growing') {
      return baseUsage * (1 + progress * 2);
    }

    // Variable pattern (default)
    const dayOfWeek = Math.floor(pointIndex / this.config.pointsPerDay) % 7;
    const weekendFactor = dayOfWeek >= 5 ? 0.5 : 1.0;
    const hourVar = (pointIndex % this.config.pointsPerDay) / this.config.pointsPerDay;
    const hourFactor = hourVar < 0.2 ? 0.3 : hourVar > 0.7 && hourVar < 0.9 ? 1.5 : 1.0;
    return baseUsage * weekendFactor * hourFactor;
  }

  /**
   * Generate sample forecast data
   */
  generateForecast(history: SampleDataPoint[]): SampleForecast[] {
    if (!this.config.includeForecast) return [];

    const forecasts: SampleForecast[] = [];
    const lastData = history[history.length - 1];
    const now = new Date();

    // Generate 7 days of forecasts
    for (let i = 1; i <= 7; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

      // EMA-based prediction
      const emaForecast: SampleForecast = {
        date,
        predictedQuota: Math.max(0, lastData.remaining - (lastData.used * i * 0.8)),
        confidence: 85 - i * 5,
        method: 'ema',
      };

      // Pattern-based prediction
      const patternForecast: SampleForecast = {
        date,
        predictedQuota: Math.max(0, lastData.remaining - (lastData.used * i * 1.1)),
        confidence: 75 - i * 8,
        method: 'pattern',
      };

      // Monte Carlo prediction
      const monteCarloForecast: SampleForecast = {
        date,
        predictedQuota: Math.max(0, lastData.remaining - (lastData.used * i * (0.9 + Math.random() * 0.3))),
        confidence: 70 - i * 10,
        method: 'monte-carlo',
      };

      forecasts.push(emaForecast, patternForecast, monteCarloForecast);
    }

    return forecasts;
  }

  /**
   * Generate a complete sample dataset
   */
  generateCompleteDataset(): {
    history: SampleDataPoint[];
    forecasts: SampleForecast[];
  } {
    const history = this.generateHistory();
    const forecasts = this.generateForecast(history);

    return { history, forecasts };
  }
}

/**
 * Generate sample team quota data
 */
export function generateTeamSampleData() {
  const teams = [
    { name: 'Engineering', members: 10, baseQuota: 500000 },
    { name: 'Design', members: 5, baseQuota: 250000 },
    { name: 'Product', members: 3, baseQuota: 150000 },
    { name: 'Marketing', members: 4, baseQuota: 200000 },
  ];

  const now = new Date();

  return teams.map(team => {
    const used = team.baseQuota * (0.3 + Math.random() * 0.5);
    const remaining = team.baseQuota - used;
    const percentage = (remaining / team.baseQuota) * 100;

    return {
      team: team.name,
      members: team.members,
      quota: team.baseQuota,
      used,
      remaining,
      percentage,
      lastUpdated: now,
    };
  });
}

/**
 * Demo mode data generator
 *
 * Creates sample data specifically for demo presentations
 */
export class DemoDataGenerator {
  /**
   * Generate demo data for a specific scenario
   */
  static generateScenario(scenario: 'low-quota' | 'normal' | 'high-usage' | 'exhausted'): SampleDataPoint[] {
    const generator = new SampleDataGenerator({
      daysOfHistory: 7,
      pointsPerDay: 24,
      baseQuota: 100000,
      usagePattern: scenario === 'high-usage' ? 'growing' : 'variable',
    });

    const data = generator.generateHistory();

    // Modify based on scenario
    if (scenario === 'low-quota') {
      for (let i = data.length - 1; i >= data.length - 5; i--) {
        data[i].percentage = 15 + Math.random() * 5;
        data[i].remaining = data[i].quota * (data[i].percentage / 100);
      }
    } else if (scenario === 'exhausted') {
      for (let i = data.length - 1; i >= data.length - 3; i--) {
        data[i].percentage = 2 + Math.random() * 3;
        data[i].remaining = data[i].quota * (data[i].percentage / 100);
      }
    } else if (scenario === 'normal') {
      for (const point of data.slice(-10)) {
        point.percentage = 30 + Math.random() * 50;
        point.remaining = point.quota * (point.percentage / 100);
      }
    }
    // high-usage is handled by the growing pattern

    return data;
  }
}

/**
 * Quick generate a small sample for testing
 */
export function generateQuickSample(): SampleDataPoint[] {
  const generator = new SampleDataGenerator({
    daysOfHistory: 1,
    pointsPerDay: 10,
    baseQuota: 10000,
    usagePattern: 'steady',
  });

  return generator.generateHistory();
}

/**
 * Save sample data to a file
 */
export async function saveSampleData(
  data: SampleDataPoint[],
  format: 'json' | 'csv'
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sample-quota-data-${timestamp}.${format}`;
  const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

  let content: string;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
  } else {
    const headers = 'timestamp,quota,used,remaining,percentage,model\n';
    const rows = data.map(d =>
      `${d.timestamp.toISOString()},${d.quota},${d.used},${d.remaining},${d.percentage.toFixed(2)},${d.model}`
    ).join('\n');
    content = headers + rows;
  }

  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));

  await vscode.window.showTextDocument(fileUri);
  vscode.window.showInformationMessage(`Sample data saved to ${filename}`);
}
