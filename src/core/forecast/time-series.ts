import { TimeSeriesData } from './forecast-types';

/**
 * Calculate mean of a number array
 */
export function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Calculate variance of a number array
 */
export function calculateVariance(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = calculateMean(data);
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Calculate standard deviation of a number array
 */
export function calculateStdDev(data: number[]): number {
  return Math.sqrt(calculateVariance(data));
}

/**
 * Calculate median of a number array
 */
export function calculateMedian(data: number[]): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate percentile of a number array
 */
export function calculatePercentile(data: number[], percentile: number): number {
  if (data.length === 0) return 0;
  if (data.length === 1) return data[0];

  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Extract hour of day from timestamp (0-23)
 */
export function getHourOfDay(date: Date): number {
  return date.getHours();
}

/**
 * Extract day of week from timestamp (0-6, Sunday = 0)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Group time series data by hour of day
 */
export function groupByHour(data: TimeSeriesData[]): Map<number, number[]> {
  const groups = new Map<number, number[]>();

  for (const point of data) {
    const hour = getHourOfDay(point.timestamp);
    const existing = groups.get(hour) || [];
    existing.push(point.value);
    groups.set(hour, existing);
  }

  return groups;
}

/**
 * Group time series data by day of week
 */
export function groupByDayOfWeek(data: TimeSeriesData[]): Map<number, number[]> {
  const groups = new Map<number, number[]>();

  for (const point of data) {
    const day = getDayOfWeek(point.timestamp);
    const existing = groups.get(day) || [];
    existing.push(point.value);
    groups.set(day, existing);
  }

  return groups;
}

/**
 * Group time series data by time period (e.g., hourly, daily)
 */
export function groupByPeriod(
  data: TimeSeriesData[],
  periodMs: number
): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  for (const point of data) {
    const periodKey = Math.floor(point.timestamp.getTime() / periodMs).toString();
    const existing = groups.get(periodKey) || [];
    existing.push(point.value);
    groups.set(periodKey, existing);
  }

  return groups;
}

/**
 * Calculate average usage per hour (0-23)
 */
export function calculateHourlyAverages(data: TimeSeriesData[]): Map<number, number> {
  const groups = groupByHour(data);
  const averages = new Map<number, number>();

  for (const [hour, values] of groups) {
    averages.set(hour, calculateMean(values));
  }

  return averages;
}

/**
 * Calculate average usage per day of week (0-6)
 */
export function calculateDailyAverages(data: TimeSeriesData[]): Map<number, number> {
  const groups = groupByDayOfWeek(data);
  const averages = new Map<number, number>();

  for (const [day, values] of groups) {
    averages.set(day, calculateMean(values));
  }

  return averages;
}

/**
 * Find peak hours (highest usage)
 */
export function findPeakHours(data: TimeSeriesData[], topN: number = 3): number[] {
  const hourlyAvg = calculateHourlyAverages(data);

  const sorted = Array.from(hourlyAvg.entries()).sort((a, b) => b[1] - a[1]);

  return sorted.slice(0, topN).map(([hour]) => hour);
}

/**
 * Find peak days (highest usage)
 */
export function findPeakDays(data: TimeSeriesData[], topN: number = 3): number[] {
  const dailyAvg = calculateDailyAverages(data);

  const sorted = Array.from(dailyAvg.entries()).sort((a, b) => b[1] - a[1]);

  return sorted.slice(0, topN).map(([day]) => day);
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliersIQR(data: number[]): { lower: number; upper: number; outliers: number[] } {
  if (data.length < 4) {
    return { lower: -Infinity, upper: Infinity, outliers: [] };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const outliers = data.filter(x => x < lower || x > upper);

  return { lower, upper, outliers };
}

/**
 * Detect outliers using Z-score method
 */
export function detectOutliersZScore(data: number[], threshold: number = 2): number[] {
  if (data.length < 3) return [];

  const mean = calculateMean(data);
  const stdDev = calculateStdDev(data);

  if (stdDev === 0) return [];

  return data.filter(x => Math.abs((x - mean) / stdDev) > threshold);
}

/**
 * Resample time series to a different resolution
 */
export function resampleTimeSeries(
  data: TimeSeriesData[],
  bucketSizeMs: number
): TimeSeriesData[] {
  if (data.length === 0) return [];

  const buckets = new Map<number, number[]>();

  for (const point of data) {
    const bucketKey = Math.floor(point.timestamp.getTime() / bucketSizeMs);
    const existing = buckets.get(bucketKey) || [];
    existing.push(point.value);
    buckets.set(bucketKey, existing);
  }

  const result: TimeSeriesData[] = [];

  for (const [bucketKey, values] of buckets) {
    const timestamp = new Date(bucketKey * bucketSizeMs);
    result.push({
      timestamp,
      value: calculateMean(values),
    });
  }

  return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Calculate difference between consecutive points
 */
export function calculateDifferences(data: number[]): number[] {
  if (data.length < 2) return [];

  const diffs: number[] = [];

  for (let i = 1; i < data.length; i++) {
    diffs.push(data[i] - data[i - 1]);
  }

  return diffs;
}

/**
 * Normalize data to 0-1 range
 */
export function normalizeData(data: number[]): number[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);

  if (max === min) return data.map(() => 0.5);

  return data.map(x => (x - min) / (max - min));
}

/**
 * Smooth data using moving average
 */
export function smoothData(data: number[], windowSize: number = 3): number[] {
  if (data.length <= windowSize) return [...data];

  const smoothed: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    smoothed.push(calculateMean(window));
  }

  return smoothed;
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate time difference in hours between two dates
 */
export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}
