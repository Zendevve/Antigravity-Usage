import {
  ForecastResult,
  QuickForecast,
  ForecastConfig,
  ForecastWeights,
  DEFAULT_FORECAST_CONFIG,
  DEFAULT_FORECAST_WEIGHTS,
  TimeSeriesData,
  RiskLevel,
} from './forecast-types';
import { EMAPredictor } from './ema-predictor';
import { PatternMatcher } from './pattern-matcher';
import { MonteCarloEngine } from './monte-carlo';
import { calculateMean } from './time-series';

/**
 * Cache entry for forecast results
 */
interface CacheEntry {
  result: ForecastResult;
  timestamp: number;
}

/**
 * Unified Forecast Engine
 * Combines EMA, Pattern Matcher, and Monte Carlo results
 */
export class ForecastEngine {
  private emaPredictor: EMAPredictor;
  private patternMatcher: PatternMatcher;
  private monteCarlo: MonteCarloEngine;
  private config: Required<ForecastConfig>;
  private weights: ForecastWeights;
  private cache: Map<string, CacheEntry>;

  /**
   * @param emaPredictor - EMA predictor instance
   * @param patternMatcher - Pattern matcher instance
   * @param monteCarlo - Monte Carlo engine instance
   * @param config - Forecast configuration
   * @param weights - Weights for ensemble forecasting
   */
  constructor(
    emaPredictor?: EMAPredictor,
    patternMatcher?: PatternMatcher,
    monteCarlo?: MonteCarloEngine,
    config?: ForecastConfig,
    weights?: Partial<ForecastWeights>
  ) {
    this.emaPredictor = emaPredictor ?? new EMAPredictor();
    this.patternMatcher = patternMatcher ?? new PatternMatcher();
    this.monteCarlo = monteCarlo ?? new MonteCarloEngine();

    this.config = {
      ...DEFAULT_FORECAST_CONFIG,
      ...config,
    };

    this.weights = {
      ...DEFAULT_FORECAST_WEIGHTS,
      ...weights,
    };

    this.cache = new Map();
  }

  /**
   * Generate comprehensive forecast
   */
  generateForecast(currentQuota: number, history: TimeSeriesData[]): ForecastResult {
    // Check cache first
    const cacheKey = this.getCacheKey(currentQuota, history);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Prepare data for each component
    const values = history.map(d => d.value);
    const usageDiffs = this.calculateUsageDiffs(history);

    // Run EMA prediction
    const emaPrediction = this.emaPredictor.predict(values);

    // Run pattern matching
    const patterns = this.patternMatcher.detectPatterns(history);
    const primaryPattern = this.patternMatcher.getPrimaryPattern(patterns) ?? {
      type: 'daily' as const,
      peakHours: [],
      peakDays: [],
      averageUsage: calculateMean(values),
      variance: 0,
      confidence: 0,
    };

    // Run Monte Carlo simulation
    const monteCarloResult = this.monteCarlo.simulate(
      currentQuota,
      usageDiffs,
      720 // 30 days
    );

    // Calculate unified forecast using weighted ensemble
    const estimatedHoursRemaining = this.calculateUnifiedEstimate(
      emaPrediction.predictedDepletionHours,
      primaryPattern,
      monteCarloResult.p50,
      currentQuota,
      usageDiffs
    );

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(
      emaPrediction.confidence,
      primaryPattern.confidence,
      monteCarloResult.simulationCount > 0 ? 0.8 : 0
    );

    // Determine risk level
    const riskLevel = this.determineRiskLevel(
      estimatedHoursRemaining,
      monteCarloResult.probabilityExhaustion24h,
      confidence
    );

    const result: ForecastResult = {
      timestamp: new Date(),
      currentQuota,
      emaPrediction,
      patternPrediction: primaryPattern,
      monteCarloResult,
      estimatedHoursRemaining,
      confidence,
      riskLevel,
    };

    // Cache result
    this.setCachedResult(cacheKey, result);

    return result;
  }

  /**
   * Generate quick forecast with fewer computations
   */
  getQuickForecast(currentQuota: number, recentUsage: number[]): QuickForecast {
    if (recentUsage.length < 2 || currentQuota <= 0) {
      return {
        estimatedHoursRemaining: Infinity,
        confidence: 0,
        riskLevel: 'low',
      };
    }

    // Quick EMA
    const predictor = new EMAPredictor(0.3, Math.min(12, recentUsage.length));
    const prediction = predictor.predict(recentUsage);

    // Calculate burn rate from recent usage
    const burnRate = this.calculateBurnRate(recentUsage);

    let estimatedHoursRemaining: number;
    if (burnRate > 0) {
      estimatedHoursRemaining = currentQuota / burnRate;
    } else {
      estimatedHoursRemaining = prediction.predictedDepletionHours ?? Infinity;
    }

    // Quick Monte Carlo
    const mcEngine = new MonteCarloEngine(1000);
    const mcResult = mcEngine.quickSimulate(currentQuota, recentUsage, 168);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(
      estimatedHoursRemaining,
      mcResult.probabilityExhaustion24h,
      prediction.confidence
    );

    return {
      estimatedHoursRemaining: isFinite(estimatedHoursRemaining) ? estimatedHoursRemaining : -1,
      confidence: prediction.confidence,
      riskLevel,
    };
  }

  /**
   * Calculate usage differences (burn rate) from history
   */
  private calculateUsageDiffs(history: TimeSeriesData[]): number[] {
    if (history.length < 2) return [];

    const diffs: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const diff = history[i - 1].value - history[i].value;
      diffs.push(Math.max(0, diff)); // Only positive values (quota used)
    }

    return diffs;
  }

  /**
   * Calculate burn rate from usage data
   */
  private calculateBurnRate(usage: number[]): number {
    if (usage.length < 2) return 0;

    const diffs = this.calculateUsageDiffs(
      usage.map((v, i) => ({ timestamp: new Date(i * 3600000), value: v }))
    );

    if (diffs.length === 0) return 0;

    // Calculate average burn rate per hour
    return calculateMean(diffs);
  }

  /**
   * Calculate unified estimate using weighted ensemble
   */
  private calculateUnifiedEstimate(
    emaEstimate: number | null,
    pattern: { averageUsage: number; variance: number },
    mcEstimate: number | null,
    currentQuota: number,
    usageDiffs: number[]
  ): number {
    const estimates: number[] = [];
    const weights: number[] = [];

    // EMA estimate
    if (emaEstimate !== null && isFinite(emaEstimate)) {
      estimates.push(emaEstimate);
      weights.push(this.weights.ema);
    }

    // Pattern-based estimate
    const avgUsage = calculateMean(usageDiffs);
    if (avgUsage > 0) {
      const patternEstimate = currentQuota / avgUsage;
      if (isFinite(patternEstimate)) {
        estimates.push(patternEstimate);
        weights.push(this.weights.pattern);
      }
    }

    // Monte Carlo estimate
    if (mcEstimate !== null && isFinite(mcEstimate)) {
      estimates.push(mcEstimate);
      weights.push(this.weights.monteCarlo);
    }

    if (estimates.length === 0) {
      return Infinity;
    }

    // Weighted average
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let weightedSum = 0;

    for (let i = 0; i < estimates.length; i++) {
      weightedSum += (estimates[i] * weights[i]) / totalWeight;
    }

    return weightedSum;
  }

  /**
   * Calculate overall confidence from component confidences
   */
  private calculateOverallConfidence(
    emaConfidence: number,
    patternConfidence: number,
    mcConfidence: number
  ): number {
    const confidences = [emaConfidence, patternConfidence, mcConfidence].filter(c => c > 0);

    if (confidences.length === 0) return 0;

    // Weighted average based on method reliability
    const totalWeight = this.weights.ema + this.weights.pattern + this.weights.monteCarlo;

    return (
      emaConfidence * (this.weights.ema / totalWeight) +
      patternConfidence * (this.weights.pattern / totalWeight) +
      mcConfidence * (this.weights.monteCarlo / totalWeight)
    );
  }

  /**
   * Determine risk level based on forecast
   */
  private determineRiskLevel(
    hoursRemaining: number,
    probability24h: number,
    confidence: number
  ): RiskLevel {
    // High probability of exhaustion in 24h = critical
    if (probability24h > 0.5) {
      return 'critical';
    }

    // Hours remaining based
    if (hoursRemaining < 0 || !isFinite(hoursRemaining)) {
      return 'low';
    }

    if (hoursRemaining <= 24) {
      return 'critical';
    }

    if (hoursRemaining <= 72) {
      return 'high';
    }

    if (hoursRemaining <= 168) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get cache key for current state
   */
  private getCacheKey(currentQuota: number, history: TimeSeriesData[]): string {
    // Use quota value and last few history points as key
    const historyKey = history
      .slice(-5)
      .map(d => `${d.timestamp.getTime()}-${d.value.toFixed(1)}`)
      .join(',');

    return `${currentQuota.toFixed(1)}:${historyKey}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(key: string): ForecastResult | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Cache result
   */
  private setCachedResult(key: string, result: ForecastResult): void {
    // Limit cache size
    if (this.cache.size > 100) {
      // Remove oldest entries
      const keysToRemove: string[] = [];
      let oldestTimestamp = Infinity;

      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTimestamp) {
          oldestTimestamp = v.timestamp;
          keysToRemove.push(k);
        }
      }

      for (const k of keysToRemove.slice(0, 10)) {
        this.cache.delete(k);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear forecast cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get EMA predictor
   */
  getEMAPredictor(): EMAPredictor {
    return this.emaPredictor;
  }

  /**
   * Get pattern matcher
   */
  getPatternMatcher(): PatternMatcher {
    return this.patternMatcher;
  }

  /**
   * Get Monte Carlo engine
   */
  getMonteCarloEngine(): MonteCarloEngine {
    return this.monteCarlo;
  }

  /**
   * Update weights
   */
  setWeights(weights: Partial<ForecastWeights>): void {
    this.weights = {
      ...this.weights,
      ...weights,
    };
  }

  /**
   * Get current weights
   */
  getWeights(): ForecastWeights {
    return { ...this.weights };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ForecastConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Factory function to create ForecastEngine with defaults
 */
export function createForecastEngine(config?: ForecastConfig): ForecastEngine {
  return new ForecastEngine(
    new EMAPredictor(config?.alpha, config?.emaWindow),
    new PatternMatcher(config?.anomalyThreshold),
    new MonteCarloEngine(config?.monteCarloIterations),
    config
  );
}
