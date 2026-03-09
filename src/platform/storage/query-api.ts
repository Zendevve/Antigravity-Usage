import { HistoryStore, QuotaSnapshot, UsageEvent } from './history-store';

/**
 * Trend data point for visualization
 */
export interface TrendData {
  timestamp: Date;
  value: number;
  model: string;
}

/**
 * Aggregated statistics for a model
 */
export interface ModelStats {
  model: string;
  averageQuota: number;
  minQuota: number;
  maxQuota: number;
  sampleCount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  depletionRate: number; // percent per hour
}

/**
 * Summary statistics for the entire history
 */
export interface HistorySummary {
  totalRecords: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  models: string[];
  byModel: Map<string, ModelStats>;
}

/**
 * Query API for history data
 * Provides high-level queries on top of HistoryStore
 */
export class QueryApi {
  private store: HistoryStore;

  constructor(store: HistoryStore) {
    this.store = store;
  }

  /**
   * Get history with optional filtering
   */
  async getHistory(
    startTime: Date,
    endTime: Date,
    model?: string
  ): Promise<QuotaSnapshot[]> {
    return this.store.getHistory(startTime, endTime, model);
  }

  /**
   * Get trend data for sparkline visualization
   * @param windowHours Number of hours to look back
   * @param model Optional model filter
   */
  async getTrends(windowHours: number, model?: string): Promise<TrendData[]> {
    const snapshots = await this.store.getTrends(windowHours);
    const filtered = model
      ? snapshots.filter(s => s.model === model)
      : snapshots;

    // Aggregate by model for multi-model view
    if (!model) {
      // Return average across all models at each timestamp
      const timeMap = new Map<string, number[]>();

      for (const snapshot of filtered) {
        const key = snapshot.timestamp.toISOString().slice(0, -4); // minute precision
        const existing = timeMap.get(key) || [];
        existing.push(snapshot.quota);
        timeMap.set(key, existing);
      }

      const trends: TrendData[] = [];
      for (const [timestamp, values] of timeMap) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        trends.push({
          timestamp: new Date(timestamp),
          value: avg,
          model: 'all',
        });
      }

      return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    return filtered.map(s => ({
      timestamp: s.timestamp,
      value: s.quota,
      model: s.model,
    }));
  }

  /**
   * Get average usage statistics
   * @param days Number of days to analyze
   */
  async getAverageUsage(days: number): Promise<Map<string, number>> {
    return this.store.getAverageUsage(days);
  }

  /**
   * Get detailed statistics per model
   */
  async getModelStats(days: number): Promise<ModelStats[]> {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const snapshots = await this.store.getHistory(start, now);

    // Group by model
    const modelData = new Map<string, QuotaSnapshot[]>();

    for (const snapshot of snapshots) {
      const existing = modelData.get(snapshot.model) || [];
      existing.push(snapshot);
      modelData.set(snapshot.model, existing);
    }

    // Calculate stats per model
    const stats: ModelStats[] = [];

    for (const [model, data] of modelData) {
      if (data.length < 2) continue;

      const values = data.map(d => d.quota).sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;

      // Calculate trend using linear regression
      const n = data.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = data.reduce((sum, d, i) => sum + i * d.quota, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const depletionRate = slope * (24 * 60) / n; // per hour estimate

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (slope > 0.1) {
        trend = 'increasing';
      } else if (slope < -0.1) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }

      stats.push({
        model,
        averageQuota: avg,
        minQuota: values[0],
        maxQuota: values[values.length - 1],
        sampleCount: data.length,
        trend,
        depletionRate,
      });
    }

    return stats.sort((a, b) => a.averageQuota - b.averageQuota);
  }

  /**
   * Get summary of all history data
   */
  async getSummary(): Promise<HistorySummary> {
    const metadata = this.store.getMetadata();
    const snapshots = await this.store.getHistory(
      new Date(0), // beginning of time
      new Date()
    );

    const models = new Set(snapshots.map(s => s.model));
    const stats = await this.getModelStats(30);

    return {
      totalRecords: metadata.totalSnapshots,
      dateRange: {
        start: metadata.oldestRecord ? new Date(metadata.oldestRecord) : null,
        end: metadata.newestRecord ? new Date(metadata.newestRecord) : null,
      },
      models: Array.from(models),
      byModel: new Map(stats.map(s => [s.model, s])),
    };
  }

  /**
   * Find threshold breach events
   */
  async getThresholdBreaches(
    threshold: number,
    days: number = 7
  ): Promise<UsageEvent[]> {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return this.store.getEventsInRange(start, now, 'threshold_breach');
  }

  /**
   * Detect significant changes in quota usage
   */
  async detectAnomalies(
    percentChangeThreshold: number = 20,
    days: number = 7
  ): Promise<Array<{ snapshot: QuotaSnapshot; change: number }>> {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const snapshots = await this.store.getHistory(start, now);

    const anomalies: Array<{ snapshot: QuotaSnapshot; change: number }> = [];

    // Sort by model and time
    snapshots.sort((a, b) => {
      if (a.model !== b.model) return a.model.localeCompare(b.model);
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Find significant changes
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];

      if (current.model !== previous.model) continue;

      const change = Math.abs(current.quota - previous.quota);
      if (change >= percentChangeThreshold) {
        anomalies.push({
          snapshot: current,
          change,
        });
      }
    }

    return anomalies;
  }

  /**
   * Get data points suitable for sparkline rendering
   */
  async getSparklineData(
    windowHours: number = 24,
    resolution: number = 10
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const trends = await this.getTrends(windowHours);

    if (trends.length <= resolution) {
      return trends.map(t => ({ timestamp: t.timestamp, value: t.value }));
    }

    // Downsample to desired resolution
    const step = Math.floor(trends.length / resolution);
    const result: Array<{ timestamp: Date; value: number }> = [];

    for (let i = 0; i < trends.length; i += step) {
      result.push({
        timestamp: trends[i].timestamp,
        value: trends[i].value,
      });
    }

    return result;
  }
}

/**
 * Create QueryApi from HistoryStore
 */
export function createQueryApi(store: HistoryStore): QueryApi {
  return new QueryApi(store);
}
