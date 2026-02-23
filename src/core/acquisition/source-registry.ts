import { SourceReading } from '../types';

export interface QuotaSource {
  readonly id: string;
  fetch(): Promise<SourceReading | null>;
}

export class SourceRegistry {
  private sources = new Map<string, QuotaSource>();
  private failures = new Map<string, number>();

  register(source: QuotaSource) {
    this.sources.set(source.id, source);
    this.failures.set(source.id, 0);
  }

  isHealthy(id: string): boolean {
    return (this.failures.get(id) ?? 0) < 3;
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
}
