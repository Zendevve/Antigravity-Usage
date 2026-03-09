import { z } from 'zod';
import { QuotaSource } from './source-registry';
import { SourceReading, SourceReadingSchema, ConfidenceGrade, ReconciledQuotaStateSchema } from '../types';
import { log } from '../../util/logger';

/**
 * Source weight configuration
 */
export interface SourceWeight {
  sourceId: string;
  weight: number; // 0-1, sum to 1.0
  confidence: number; // 0-1
}

/**
 * Reconciliation result with metadata
 */
export interface ReconciliationResult {
  reading: SourceReading;
  weights: SourceWeight[];
  anomalyDetected: boolean;
  sources: SourceReading[];
}

/**
 * Configuration for reconciliation engine
 */
export interface ReconciliationConfig {
  /**
   * Maximum allowed divergence between sources (0-1, default 0.2 = 20%)
   */
  maxDivergence?: number;

  /**
   * Source priority order for fallback (highest to lowest)
   */
  fallbackPriority?: string[];

  /**
   * Minimum confidence threshold for accepting readings
   */
  minConfidence?: number;

  /**
   * Weight decay factor for stale sources (0-1)
   */
  weightDecayFactor?: number;

  /**
   * Time window for freshness calculation (ms)
   */
  freshnessWindowMs?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ReconciliationConfig> = {
  maxDivergence: 0.2,
  fallbackPriority: ['antigravity-api', 'cloud-billing', 'http-interceptor'],
  minConfidence: 0.5,
  weightDecayFactor: 0.9,
  freshnessWindowMs: 60000, // 1 minute
};

/**
 * Source metadata for weight calculation
 */
interface SourceMetadata {
  sourceId: string;
  lastReading: SourceReading | null;
  failureCount: number;
  successCount: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
}

/**
 * Reconciliation Engine
 * Combines multiple quota sources with weighted averaging and anomaly detection
 */
export class ReconciliationEngine {
  private config: Required<ReconciliationConfig>;
  private sourceMetadata = new Map<string, SourceMetadata>();
  private lastResult: ReconciliationResult | null = null;

  constructor(config: ReconciliationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compute consolidated quota from multiple sources
   */
  async computeConsolidatedQuota(sources: QuotaSource[]): Promise<ReconciliationResult | null> {
    if (sources.length === 0) {
      log.warn('[ReconciliationEngine] No sources provided');
      return null;
    }

    // Fetch from all sources
    const readings = await this.fetchAllSources(sources);

    if (readings.length === 0) {
      log.warn('[ReconciliationEngine] No successful readings from any source');
      return this.fallbackToLastKnown();
    }

    // Calculate weights based on source reliability
    const weights = this.calculateWeights(readings);

    // Check for anomalies
    const anomalyDetected = this.detectAnomaly(readings);

    if (anomalyDetected) {
      log.warn('[ReconciliationEngine] Anomaly detected: sources diverge significantly');
    }

    // Compute weighted average
    const consolidated = this.computeWeightedAverage(readings, weights);

    // Update metadata
    this.updateMetadata(readings);

    // Store result
    this.lastResult = {
      reading: consolidated,
      weights,
      anomalyDetected,
      sources: readings,
    };

    return this.lastResult;
  }

  /**
   * Fetch readings from all sources
   */
  private async fetchAllSources(sources: QuotaSource[]): Promise<SourceReading[]> {
    const readings: SourceReading[] = [];

    for (const source of sources) {
      try {
        const reading = await source.fetch();
        if (reading) {
          readings.push(reading);
          this.recordSuccess(source.id);
        } else {
          this.recordFailure(source.id);
        }
      } catch (e) {
        log.error(`[ReconciliationEngine] Source ${source.id} failed`, e);
        this.recordFailure(source.id);
      }
    }

    return readings;
  }

  /**
   * Calculate weights for each source based on reliability
   */
  calculateWeights(readings: SourceReading[]): SourceWeight[] {
    const weights: SourceWeight[] = [];

    // Calculate base weights from metadata
    for (const reading of readings) {
      const metadata = this.getOrCreateMetadata(reading.sourceId);

      // Calculate freshness score (1 = very fresh, 0 = stale)
      const freshnessMs = reading.freshnessMs ?? 0;
      const freshnessScore = Math.max(0, 1 - freshnessMs / this.config.freshnessWindowMs);

      // Calculate reliability score (based on success rate)
      const totalAttempts = metadata.successCount + metadata.failureCount;
      const reliabilityScore = totalAttempts > 0
        ? metadata.successCount / totalAttempts
        : 0.5; // Default to 0.5 for new sources

      // Calculate confidence as combination of freshness and reliability
      const confidence = (freshnessScore * 0.4 + reliabilityScore * 0.6);

      weights.push({
        sourceId: reading.sourceId,
        weight: 0, // Will be normalized below
        confidence,
      });
    }

    // Normalize weights to sum to 1
    const totalWeight = weights.reduce((sum, w) => sum + w.confidence, 0);

    if (totalWeight > 0) {
      for (const w of weights) {
        w.weight = w.confidence / totalWeight;
      }
    } else {
      // Equal weights if no confidence data
      const equalWeight = 1 / weights.length;
      for (const w of weights) {
        w.weight = equalWeight;
        w.confidence = equalWeight;
      }
    }

    return weights;
  }

  /**
   * Detect anomaly when sources diverge significantly
   */
  detectAnomaly(readings: Map<string, SourceReading>): boolean;
  detectAnomaly(readings: SourceReading[]): boolean;
  detectAnomaly(readings: SourceReading[] | Map<string, SourceReading>): boolean {
    // Convert to array if map
    const readingsArray: SourceReading[] = Array.isArray(readings)
      ? readings
      : Array.from(readings.values());

    if (readingsArray.length < 2) {
      return false;
    }

    // Calculate percentage values
    const percentages = readingsArray.map((r) => r.remainingPercent);

    // Find min and max
    const min = Math.min(...percentages);
    const max = Math.max(...percentages);

    // Calculate relative divergence
    const avg = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    const divergence = avg > 0 ? (max - min) / avg : 0;

    return divergence > this.config.maxDivergence;
  }

  /**
   * Compute weighted average of readings
   */
  private computeWeightedAverage(readings: SourceReading[], weights: SourceWeight[]): SourceReading {
    const weightMap = new Map(weights.map((w) => [w.sourceId, w.weight]));

    let totalRemainingTokens = 0;
    let totalTokens = 0;
    let totalPercent = 0;
    let totalWeight = 0;

    for (const reading of readings) {
      const weight = weightMap.get(reading.sourceId) ?? 0;

      totalRemainingTokens += reading.remainingTokens * weight;
      totalTokens += reading.totalTokens * weight;
      totalPercent += reading.remainingPercent * weight;
      totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0) {
      totalRemainingTokens /= totalWeight;
      totalTokens /= totalWeight;
      totalPercent /= totalWeight;
    }

    // Determine confidence grade
    const avgConfidence = weights.reduce((sum, w) => sum + w.confidence, 0) / weights.length;
    let confidenceGrade: ConfidenceGrade;

    if (avgConfidence >= 0.8) {
      confidenceGrade = ConfidenceGrade.HIGH;
    } else if (avgConfidence >= 0.5) {
      confidenceGrade = ConfidenceGrade.MEDIUM;
    } else {
      confidenceGrade = ConfidenceGrade.LOW;
    }

    return {
      sourceId: 'reconciled',
      remainingPercent: Math.max(0, Math.min(100, totalPercent)),
      remainingTokens: Math.round(Math.max(0, totalRemainingTokens)),
      totalTokens: Math.round(Math.max(0, totalTokens)),
      model: 'multi-source',
      fetchedAt: new Date(),
      freshnessMs: 0,
      confidence: confidenceGrade,
      sources: readings,
    } as SourceReading & { confidence: ConfidenceGrade; sources: SourceReading[] };
  }

  /**
   * Fallback to last known good result or highest priority source
   */
  private fallbackToLastKnown(): ReconciliationResult | null {
    if (this.lastResult) {
      log.info('[ReconciliationEngine] Using last known result as fallback');
      return this.lastResult;
    }

    // Try fallback priority
    const prioritySource = this.config.fallbackPriority[0];
    if (prioritySource) {
      const metadata = this.sourceMetadata.get(prioritySource);
      if (metadata?.lastReading) {
        log.info(`[ReconciliationEngine] Using fallback source: ${prioritySource}`);
        return {
          reading: metadata.lastReading,
          weights: [{ sourceId: prioritySource, weight: 1, confidence: 0.3 }],
          anomalyDetected: false,
          sources: [metadata.lastReading],
        };
      }
    }

    return null;
  }

  /**
   * Get or create metadata for a source
   */
  private getOrCreateMetadata(sourceId: string): SourceMetadata {
    let metadata = this.sourceMetadata.get(sourceId);

    if (!metadata) {
      metadata = {
        sourceId,
        lastReading: null,
        failureCount: 0,
        successCount: 0,
        lastSuccess: null,
        lastFailure: null,
      };
      this.sourceMetadata.set(sourceId, metadata);
    }

    return metadata;
  }

  /**
   * Record a successful fetch
   */
  private recordSuccess(sourceId: string): void {
    const metadata = this.getOrCreateMetadata(sourceId);
    metadata.successCount++;
    metadata.lastSuccess = new Date();
  }

  /**
   * Record a failed fetch
   */
  private recordFailure(sourceId: string): void {
    const metadata = this.getOrCreateMetadata(sourceId);
    metadata.failureCount++;
    metadata.lastFailure = new Date();
  }

  /**
   * Update metadata with new readings
   */
  private updateMetadata(readings: SourceReading[]): void {
    for (const reading of readings) {
      const metadata = this.getOrCreateMetadata(reading.sourceId);
      metadata.lastReading = reading;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ReconciliationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ReconciliationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get last reconciliation result
   */
  getLastResult(): ReconciliationResult | null {
    return this.lastResult;
  }

  /**
   * Get source metadata for diagnostics
   */
  getSourceMetadata(): Map<string, SourceMetadata> {
    return new Map(this.sourceMetadata);
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.sourceMetadata.clear();
    this.lastResult = null;
    log.info('[ReconciliationEngine] Reset engine state');
  }
}
