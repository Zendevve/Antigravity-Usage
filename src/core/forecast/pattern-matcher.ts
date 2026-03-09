import {
  TimeSeriesData,
  UsagePattern,
  Anomaly,
  PatternType,
  DEFAULT_FORECAST_CONFIG,
} from './forecast-types';
import {
  calculateMean,
  calculateVariance,
  calculateStdDev,
  calculateHourlyAverages,
  calculateDailyAverages,
  findPeakHours,
  findPeakDays,
  detectOutliersZScore,
  getHourOfDay,
  getDayOfWeek,
} from './time-series';

/**
 * Pattern Matcher for usage pattern recognition
 * Detects time-of-day, day-of-week patterns and anomalies
 */
export class PatternMatcher {
  private anomalyThreshold: number;

  /**
   * @param anomalyThreshold - Standard deviations for anomaly detection (default: 2.0)
   */
  constructor(anomalyThreshold: number = DEFAULT_FORECAST_CONFIG.anomalyThreshold) {
    this.anomalyThreshold = anomalyThreshold;
  }

  /**
   * Detect usage patterns from historical data
   */
  detectPatterns(historicalData: TimeSeriesData[]): UsagePattern[] {
    if (historicalData.length < 2) {
      return [];
    }

    const patterns: UsagePattern[] = [];

    // Detect daily pattern
    const dailyPattern = this.detectDailyPattern(historicalData);
    if (dailyPattern) {
      patterns.push(dailyPattern);
    }

    // Detect weekly pattern
    const weeklyPattern = this.detectWeeklyPattern(historicalData);
    if (weeklyPattern) {
      patterns.push(weeklyPattern);
    }

    // Detect monthly pattern if enough data
    if (historicalData.length >= 60) {
      const monthlyPattern = this.detectMonthlyPattern(historicalData);
      if (monthlyPattern) {
        patterns.push(monthlyPattern);
      }
    }

    return patterns;
  }

  /**
   * Detect daily usage pattern (time-of-day)
   */
  private detectDailyPattern(data: TimeSeriesData[]): UsagePattern | null {
    const hourlyAverages = calculateHourlyAverages(data);

    if (hourlyAverages.size < 4) {
      return null;
    }

    const hours: number[] = [];
    const values: number[] = [];

    for (const [hour, avg] of hourlyAverages) {
      hours.push(hour);
      values.push(avg);
    }

    const averageUsage = calculateMean(values);
    const variance = calculateVariance(values);

    // Determine confidence based on pattern strength
    const confidence = this.calculatePatternConfidence(values, 'daily');

    // Find peak hours
    const peakHours = findPeakHours(data, 4);

    return {
      type: 'daily',
      peakHours,
      peakDays: [], // Not applicable for daily pattern
      averageUsage,
      variance,
      confidence,
    };
  }

  /**
   * Detect weekly usage pattern (day-of-week)
   */
  private detectWeeklyPattern(data: TimeSeriesData[]): UsagePattern | null {
    const dailyAverages = calculateDailyAverages(data);

    if (dailyAverages.size < 3) {
      return null;
    }

    const days: number[] = [];
    const values: number[] = [];

    for (const [day, avg] of dailyAverages) {
      days.push(day);
      values.push(avg);
    }

    const averageUsage = calculateMean(values);
    const variance = calculateVariance(values);

    // Determine confidence based on pattern strength
    const confidence = this.calculatePatternConfidence(values, 'weekly');

    // Find peak days
    const peakDays = findPeakDays(data, 3);

    return {
      type: 'weekly',
      peakHours: [], // Not applicable for weekly pattern
      peakDays,
      averageUsage,
      variance,
      confidence,
    };
  }

  /**
   * Detect monthly pattern
   */
  private detectMonthlyPattern(data: TimeSeriesData[]): UsagePattern | null {
    // Group by day of month (1-31)
    const dayGroups = new Map<number, number[]>();

    for (const point of data) {
      const day = point.timestamp.getDate();
      const existing = dayGroups.get(day) || [];
      existing.push(point.value);
      dayGroups.set(day, existing);
    }

    if (dayGroups.size < 15) {
      return null;
    }

    const values: number[] = [];
    for (const [, dayValues] of dayGroups) {
      values.push(calculateMean(dayValues));
    }

    const averageUsage = calculateMean(values);
    const variance = calculateVariance(values);

    return {
      type: 'monthly',
      peakHours: [],
      peakDays: [],
      averageUsage,
      variance,
      confidence: 0.5, // Lower confidence for monthly due to limited cycles
    };
  }

  /**
   * Calculate pattern confidence based on signal strength
   */
  private calculatePatternConfidence(values: number[], type: PatternType): number {
    if (values.length < 3) return 0.3;

    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values);

    if (mean === 0) return 0.3;

    // Coefficient of variation indicates pattern strength
    const cv = stdDev / mean;

    // Higher CV = stronger pattern = higher confidence
    let confidence: number;

    if (type === 'daily') {
      // Daily patterns typically have moderate CV
      confidence = Math.min(0.9, Math.max(0.4, cv * 3));
    } else {
      // Weekly patterns may have higher variance
      confidence = Math.min(0.85, Math.max(0.35, cv * 2.5));
    }

    return confidence;
  }

  /**
   * Detect anomalies in the data
   */
  detectAnomalies(data: TimeSeriesData[]): Anomaly[] {
    if (data.length < 5) {
      return [];
    }

    const values = data.map(d => d.value);
    const outliers = detectOutliersZScore(values, this.anomalyThreshold);

    if (outliers.length === 0) {
      return [];
    }

    const anomalies: Anomaly[] = [];
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values);

    for (const point of data) {
      const deviation = stdDev > 0 ? Math.abs((point.value - mean) / stdDev) : 0;

      if (deviation > this.anomalyThreshold) {
        const type: 'spike' | 'drop' | 'unusual' = point.value > mean ? 'spike' : 'drop';

        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: mean,
          deviation,
          type,
        });
      }
    }

    return anomalies;
  }

  /**
   * Predict next period usage based on pattern
   */
  predictNextPeriod(pattern: UsagePattern, hours: number): number[] {
    const predictions: number[] = [];

    if (pattern.type === 'daily') {
      // Generate hourly predictions based on daily pattern
      const now = new Date();
      const currentHour = now.getHours();

      for (let i = 0; i < hours; i++) {
        const hour = (currentHour + i) % 24;

        // Find closest matching hour in pattern
        if (pattern.peakHours.includes(hour)) {
          // Peak hour - use peak factor
          const peakFactor = 1.2 + Math.random() * 0.2;
          predictions.push(pattern.averageUsage * peakFactor);
        } else {
          // Off-peak - apply some variance
          const variance = Math.sqrt(pattern.variance);
          const noise = (Math.random() - 0.5) * variance;
          predictions.push(Math.max(0, pattern.averageUsage + noise));
        }
      }
    } else if (pattern.type === 'weekly') {
      // Generate daily predictions based on weekly pattern
      const now = new Date();
      const currentDay = now.getDay();

      for (let i = 0; i < hours; i++) {
        const day = (currentDay + Math.floor(i / 24)) % 7;

        if (pattern.peakDays.includes(day)) {
          // Peak day
          const peakFactor = 1.15 + Math.random() * 0.15;
          predictions.push(pattern.averageUsage * peakFactor);
        } else {
          // Off-peak
          const variance = Math.sqrt(pattern.variance);
          const noise = (Math.random() - 0.5) * variance;
          predictions.push(Math.max(0, pattern.averageUsage + noise));
        }
      }
    } else {
      // For monthly/custom patterns, use average with variance
      for (let i = 0; i < hours; i++) {
        const variance = Math.sqrt(pattern.variance);
        const noise = (Math.random() - 0.5) * variance;
        predictions.push(Math.max(0, pattern.averageUsage + noise));
      }
    }

    return predictions;
  }

  /**
   * Get the primary pattern from detected patterns
   */
  getPrimaryPattern(patterns: UsagePattern[]): UsagePattern | null {
    if (patterns.length === 0) return null;

    // Return the pattern with highest confidence
    return patterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Detect cyclic behavior in the data
   */
  detectCyclicBehavior(data: TimeSeriesData[]): { cycle: PatternType; period: number } | null {
    if (data.length < 24) {
      return null;
    }

    // Check for weekly cycle
    if (data.length >= 168) { // At least 1 week of hourly data
      const weeklyScore = this.calculateCycleScore(data, 168);
      if (weeklyScore > 0.7) {
        return { cycle: 'weekly', period: 168 };
      }
    }

    // Check for daily cycle
    const dailyScore = this.calculateCycleScore(data, 24);
    if (dailyScore > 0.6) {
      return { cycle: 'daily', period: 24 };
    }

    return null;
  }

  /**
   * Calculate cycle detection score using autocorrelation
   */
  private calculateCycleScore(data: TimeSeriesData[], period: number): number {
    if (data.length < period * 2) return 0;

    const values = data.map(d => d.value);
    const mean = calculateMean(values);

    // Calculate autocorrelation at the period lag
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < values.length - period; i++) {
      correlation += (values[i] - mean) * (values[i + period] - mean);
      count++;
    }

    if (count === 0) return 0;

    const variance = calculateVariance(values);
    if (variance === 0) return 0;

    correlation = correlation / (count * variance);

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, correlation));
  }

  /**
   * Seasonal decomposition (simple additive model)
   */
  decomposeSeasonal(data: TimeSeriesData[], period: number = 24): {
    trend: number[];
    seasonal: number[];
    residual: number[];
  } {
    if (data.length < period * 2) {
      return {
        trend: data.map(d => d.value),
        seasonal: data.map(() => 0),
        residual: data.map(() => 0),
      };
    }

    const values = data.map(d => d.value);

    // Calculate trend using moving average
    const trend: number[] = [];
    const halfPeriod = Math.floor(period / 2);

    for (let i = 0; i < values.length; i++) {
      if (i < halfPeriod || i >= values.length - halfPeriod) {
        trend.push(values[i]);
      } else {
        let sum = 0;
        for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
          sum += values[j];
        }
        trend.push(sum / period);
      }
    }

    // Calculate seasonal component
    const seasonal: number[] = new Array(values.length).fill(0);
    const seasonalPattern: number[] = new Array(period).fill(0);
    const seasonalCount: number[] = new Array(period).fill(0);

    for (let i = 0; i < values.length; i++) {
      const detrended = values[i] - trend[i];
      const periodIndex = i % period;
      seasonalPattern[periodIndex] += detrended;
      seasonalCount[periodIndex]++;
    }

    // Average seasonal values
    for (let i = 0; i < period; i++) {
      if (seasonalCount[i] > 0) {
        seasonalPattern[i] /= seasonalCount[i];
      }
    }

    // Normalize seasonal pattern to sum to zero
    const seasonalMean = calculateMean(seasonalPattern);
    for (let i = 0; i < period; i++) {
      seasonalPattern[i] -= seasonalMean;
    }

    // Apply seasonal pattern
    for (let i = 0; i < values.length; i++) {
      seasonal[i] = seasonalPattern[i % period];
    }

    // Calculate residual
    const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

    return { trend, seasonal, residual };
  }

  /**
   * Get anomaly threshold
   */
  getAnomalyThreshold(): number {
    return this.anomalyThreshold;
  }

  /**
   * Set anomaly threshold
   */
  setAnomalyThreshold(threshold: number): void {
    this.anomalyThreshold = Math.max(1.0, Math.min(5.0, threshold));
  }
}
