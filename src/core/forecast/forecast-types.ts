import { z } from 'zod';

/**
 * Time series data point for forecast analysis
 */
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  model?: string;
}

/**
 * Time series data schema for validation
 */
export const TimeSeriesDataSchema = z.object({
  timestamp: z.date(),
  value: z.number(),
  model: z.string().optional(),
});

export type TimeSeriesDataInput = z.infer<typeof TimeSeriesDataSchema>;

/**
 * EMA Prediction types
 */
export type TrendDirection = 'increasing' | 'stable' | 'decreasing';

export interface EMAPrediction {
  currentValue: number;
  emaValue: number;
  trend: TrendDirection;
  predictedDepletionHours: number | null;
  confidence: number; // 0-1
}

export const EMAPredictionSchema = z.object({
  currentValue: z.number(),
  emaValue: z.number(),
  trend: z.enum(['increasing', 'stable', 'decreasing']),
  predictedDepletionHours: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

export type EMAPredictionInput = z.infer<typeof EMAPredictionSchema>;

/**
 * Usage Pattern types
 */
export type PatternType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface UsagePattern {
  type: PatternType;
  peakHours: number[]; // 0-23
  peakDays: number[]; // 0-6 (Sunday = 0)
  averageUsage: number;
  variance: number;
  confidence: number;
}

export const UsagePatternSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  peakHours: z.array(z.number().min(0).max(23)),
  peakDays: z.array(z.number().min(0).max(6)),
  averageUsage: z.number(),
  variance: z.number(),
  confidence: z.number().min(0).max(1),
});

export type UsagePatternInput = z.infer<typeof UsagePatternSchema>;

/**
 * Anomaly detection types
 */
export interface Anomaly {
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number; // standard deviations from expected
  type: 'spike' | 'drop' | 'unusual';
}

export const AnomalySchema = z.object({
  timestamp: z.date(),
  value: z.number(),
  expectedValue: z.number(),
  deviation: z.number(),
  type: z.enum(['spike', 'drop', 'unusual']),
});

export type AnomalyInput = z.infer<typeof AnomalySchema>;

/**
 * Monte Carlo simulation types
 */
export interface MonteCarloResult {
  p50: number | null; // hours until exhaustion
  p90: number | null;
  p99: number | null;
  probabilityExhaustion24h: number;
  probabilityExhaustion7d: number;
  probabilityExhaustion30d: number;
  simulationCount: number;
}

export const MonteCarloResultSchema = z.object({
  p50: z.number().nullable(),
  p90: z.number().nullable(),
  p99: z.number().nullable(),
  probabilityExhaustion24h: z.number().min(0).max(1),
  probabilityExhaustion7d: z.number().min(0).max(1),
  probabilityExhaustion30d: z.number().min(0).max(1),
  simulationCount: z.number(),
});

export type MonteCarloResultInput = z.infer<typeof MonteCarloResultSchema>;

/**
 * Quick forecast for status bar display
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface QuickForecast {
  estimatedHoursRemaining: number;
  confidence: number;
  riskLevel: RiskLevel;
}

/**
 * Unified forecast result
 */
export interface ForecastResult {
  timestamp: Date;
  currentQuota: number;
  emaPrediction: EMAPrediction;
  patternPrediction: UsagePattern;
  monteCarloResult: MonteCarloResult;

  // Unified forecast
  estimatedHoursRemaining: number;
  confidence: number;
  riskLevel: RiskLevel;
}

export const ForecastResultSchema = z.object({
  timestamp: z.date(),
  currentQuota: z.number(),
  emaPrediction: EMAPredictionSchema,
  patternPrediction: UsagePatternSchema,
  monteCarloResult: MonteCarloResultSchema,
  estimatedHoursRemaining: z.number(),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export type ForecastResultInput = z.infer<typeof ForecastResultSchema>;

/**
 * Forecast Engine Configuration
 */
export interface ForecastConfig {
  /** EMA smoothing factor (0-1), auto-calculated if not provided */
  alpha?: number;
  /** Lookback window for EMA (default: 24 data points) */
  emaWindow?: number;
  /** Number of Monte Carlo iterations (default: 10000) */
  monteCarloIterations?: number;
  /** Cache TTL in milliseconds (default: 60000 = 1 minute) */
  cacheTtlMs?: number;
  /** Enable pattern matching (default: true) */
  enablePatternMatching?: boolean;
  /** Sensitivity for anomaly detection (default: 2.0 standard deviations) */
  anomalyThreshold?: number;
}

export const DEFAULT_FORECAST_CONFIG: Required<ForecastConfig> = {
  alpha: 0.3,
  emaWindow: 24,
  monteCarloIterations: 10000,
  cacheTtlMs: 60000,
  enablePatternMatching: true,
  anomalyThreshold: 2.0,
};

/**
 * Forecast weights for ensemble
 */
export interface ForecastWeights {
  ema: number;
  pattern: number;
  monteCarlo: number;
}

export const DEFAULT_FORECAST_WEIGHTS: ForecastWeights = {
  ema: 0.35,
  pattern: 0.30,
  monteCarlo: 0.35,
};
