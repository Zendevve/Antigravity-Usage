import { SourceReading } from '../types';

export interface QuotaSource {
  readonly id: string;
  fetch(): Promise<SourceReading | null>;
}

/**
 * Source type enumeration
 */
export type SourceType = 'antigravity-api' | 'cloud-billing' | 'http-interceptor' | 'unknown';

/**
 * Source configuration for registration
 */
export interface SourceConfig {
  type: SourceType;
  enabled: boolean;
  priority: number; // Higher = more preferred
  pollIntervalMs?: number;
}

export class SourceRegistry {
  private sources = new Map<string, QuotaSource>();
  private failures = new Map<string, number>();
  private sourceConfigs = new Map<string, SourceConfig>();

  register(source: QuotaSource, config?: Partial<SourceConfig>): void {
    this.sources.set(source.id, source);
    this.failures.set(source.id, 0);

    this.sourceConfigs.set(source.id, {
      type: this.detectSourceType(source.id),
      enabled: true,
      priority: this.calculateDefaultPriority(source.id),
      ...config,
    });
  }

  /**
   * Detect source type from ID
   */
  private detectSourceType(id: string): SourceType {
    if (id.includes('antigravity') || id === 'antigravity-api') {
      return 'antigravity-api';
    }
    if (id.includes('cloud') || id === 'cloud-billing') {
      return 'cloud-billing';
    }
    if (id.includes('interceptor') || id === 'http-interceptor') {
      return 'http-interceptor';
    }
    return 'unknown';
  }

  /**
   * Calculate default priority based on source reliability
   */
  private calculateDefaultPriority(id: string): number {
    // Higher priority for more reliable sources
    if (id.includes('antigravity')) return 100;
    if (id.includes('cloud')) return 50;
    if (id.includes('interceptor')) return 25;
    return 10;
  }

  /**
   * Get source configuration
   */
  getSourceConfig(id: string): SourceConfig | undefined {
    return this.sourceConfigs.get(id);
  }

  /**
   * Update source configuration
   */
  updateSourceConfig(id: string, config: Partial<SourceConfig>): void {
    const existing = this.sourceConfigs.get(id);
    if (existing) {
      this.sourceConfigs.set(id, { ...existing, ...config });
    }
  }

  /**
   * Enable or disable a source
   */
  setSourceEnabled(id: string, enabled: boolean): void {
    this.updateSourceConfig(id, { enabled });
  }

  isHealthy(id: string): boolean {
    return (this.failures.get(id) ?? 0) < 3;
  }

  /**
   * Check if source is enabled
   */
  isEnabled(id: string): boolean {
    return this.sourceConfigs.get(id)?.enabled ?? false;
  }

  recordFailure(id: string) {
    const current = this.failures.get(id) ?? 0;
    this.failures.set(id, current + 1);
  }

  recordSuccess(id: string) {
    this.failures.set(id, 0);
  }

  getHealthySources(): QuotaSource[] {
    return Array.from(this.sources.values()).filter(s => this.isHealthy(s.id));
  }

  /**
   * Get enabled and healthy sources sorted by priority
   */
  getEnabledSources(): QuotaSource[] {
    return Array.from(this.sources.entries())
      .filter(([id]) => this.isEnabled(id) && this.isHealthy(id))
      .sort(([idA], [idB]) => {
        const configA = this.sourceConfigs.get(idA);
        const configB = this.sourceConfigs.get(idB);
        return (configB?.priority ?? 0) - (configA?.priority ?? 0);
      })
      .map(([, source]) => source);
  }

  /**
   * Get all registered sources
   */
  getAllSources(): QuotaSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get source by ID
   */
  getSource(id: string): QuotaSource | undefined {
    return this.sources.get(id);
  }

  /**
   * Unregister a source
   */
  unregister(id: string): void {
    this.sources.delete(id);
    this.failures.delete(id);
    this.sourceConfigs.delete(id);
  }

  /**
   * Clear all sources
   */
  clear(): void {
    this.sources.clear();
    this.failures.clear();
    this.sourceConfigs.clear();
  }
}
