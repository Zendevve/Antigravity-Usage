import { EMAPrediction, TrendDirection, DEFAULT_FORECAST_CONFIG } from './forecast-types';

/**
 * Calculate the coefficient of variation (CV) for a dataset
 * Used to measure volatility for adaptive alpha
 */
function calculateCoefficientOfVariation(data: number[]): number {
  if (data.length < 2) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  if (mean === 0) return 0;

  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean;
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(data: number[]): number {
  if (data.length < 2) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;

  return Math.sqrt(variance);
}

/**
 * EMA Predictor for quota depletion estimation
 * Uses Exponential Moving Average with adaptive smoothing factor
 */
export class EMAPredictor {
  private alpha: number;
  private windowSize: number;

  /**
   * @param alpha - Smoothing factor (0-1). Higher = more responsive to recent data
   *                If not provided, will be calculated based on data volatility
   * @param windowSize - Number of data points for lookback (default: 24)
   */
  constructor(alpha?: number, windowSize: number = DEFAULT_FORECAST_CONFIG.emaWindow) {
    this.alpha = alpha ?? DEFAULT_FORECAST_CONFIG.alpha;
    this.windowSize = windowSize;
  }

  /**
   * Calculate adaptive alpha based on data volatility
   * Higher volatility = lower alpha (more smoothing)
   */
  private calculateAdaptiveAlpha(data: number[]): number {
    if (data.length < 3) return this.alpha;

    const cv = calculateCoefficientOfVariation(data);

    // Map coefficient of variation to alpha
    // Low volatility (CV < 0.1): high alpha (0.4-0.5) - responsive
    // Medium volatility (0.1-0.3): medium alpha (0.2-0.4)
    // High volatility (CV > 0.3): low alpha (0.1-0.2) - stable

    if (cv < 0.1) {
      return Math.min(0.5, this.alpha * 1.5);
    } else if (cv > 0.3) {
      return Math.max(0.1, this.alpha * 0.5);
    }

    return this.alpha;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(data: number[], alpha: number): number {
    if (data.length === 0) return 0;
    if (data.length === 1) return data[0];

    let ema = data[0];

    for (let i = 1; i < data.length; i++) {
      ema = alpha * data[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * Determine trend direction based on EMA slope
   */
  private determineTrend(currentValue: number, emaValue: number): TrendDirection {
    const diff = currentValue - emaValue;
    const threshold = emaValue * 0.02; // 2% threshold for stability

    if (diff > threshold) {
      return 'increasing';
    } else if (diff < -threshold) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Calculate confidence based on data consistency
   */
  private calculateConfidence(data: number[]): number {
    if (data.length < 3) return 0.3;
    if (data.length < 5) return 0.5;
    if (data.length < 10) return 0.7;

    // Calculate R-squared for linear trend
    const n = data.length;
    const xMean = (n - 1) / 2;
    const yMean = data.reduce((a, b) => a + b, 0) / n;

    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = data[i] - yMean;
      ssTot += yDiff * yDiff;

      // Simple linear regression
      const slope = n > 1 ? (data[n - 1] - data[0]) / (n - 1) : 0;
      const predicted = data[0] + slope * i;
      ssRes += Math.pow(data[i] - predicted, 2);
    }

    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Factor in data length
    const lengthFactor = Math.min(1, data.length / 24);

    return Math.min(0.95, Math.max(0.4, rSquared * lengthFactor));
  }

  /**
   * Calculate burn rate (quota used per hour)
   */
  private calculateBurnRate(data: number[]): number {
    if (data.length < 2) return 0;

    // Use linear regression to estimate slope
    const n = data.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = data.reduce((a, b) => a + b, 0);
    const xySum = data.reduce((sum, y, i) => sum + i * y, 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);

    // Convert to per-hour rate (assuming each data point is ~1 hour)
    return Math.max(0, -slope);
  }

  /**
   * Predict quota depletion time
   */
  predict(dataPoints: number[]): EMAPrediction {
    if (dataPoints.length === 0) {
      return {
        currentValue: 0,
        emaValue: 0,
        trend: 'stable',
        predictedDepletionHours: null,
        confidence: 0,
      };
    }

    // Use the most recent windowSize data points
    const windowData = dataPoints.slice(-this.windowSize);
    const currentValue = windowData[windowData.length - 1];

    // Calculate adaptive alpha based on volatility
    const adaptiveAlpha = this.calculateAdaptiveAlpha(windowData);

    // Calculate EMA
    const emaValue = this.calculateEMA(windowData, adaptiveAlpha);

    // Determine trend
    const trend = this.determineTrend(currentValue, emaValue);

    // Calculate burn rate
    const burnRate = this.calculateBurnRate(windowData);

    // Calculate depletion time
    let predictedDepletionHours: number | null = null;
    if (burnRate > 0) {
      predictedDepletionHours = currentValue / burnRate;
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(windowData);

    return {
      currentValue,
      emaValue,
      trend,
      predictedDepletionHours,
      confidence,
    };
  }

  /**
   * Calculate depletion time given current quota and burn rate
   */
  calculateDepletionTime(currentQuota: number, burnRatePerHour: number): number | null {
    if (burnRatePerHour <= 0) {
      return null;
    }

    return currentQuota / burnRatePerHour;
  }

  /**
   * Get current alpha value
   */
  getAlpha(): number {
    return this.alpha;
  }

  /**
   * Set alpha value
   */
  setAlpha(alpha: number): void {
    this.alpha = Math.max(0.01, Math.min(0.99, alpha));
  }

  /**
   * Get window size
   */
  getWindowSize(): number {
    return this.windowSize;
  }

  /**
   * Set window size
   */
  setWindowSize(size: number): void {
    this.windowSize = Math.max(2, Math.min(168, size)); // Max 1 week of hourly data
  }
}
