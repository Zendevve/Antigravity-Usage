import { Memento } from 'vscode';
import { z } from 'zod';
import { log } from '../../util/logger';

/**
 * Data source for quota snapshots
 */
export type QuotaSource = 'antigravity-api' | 'cloud-billing' | 'interceptor';

/**
 * Schema for quota snapshot stored in history
 */
export const QuotaSnapshotSchema = z.object({
  id: z.number().optional(),
  timestamp: z.date(),
  source: z.enum(['antigravity-api', 'cloud-billing', 'interceptor']),
  model: z.string(),
  quota: z.number().min(0).max(100), // percentage 0-100
  used: z.number().min(0), // absolute tokens
  limit: z.number().min(0), // absolute tokens
});

export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;

/**
 * Schema for usage events
 */
export const UsageEventSchema = z.object({
  id: z.number().optional(),
  timestamp: z.date(),
  eventType: z.enum(['threshold_breach', 'model_switch', 'source_change', 'quota_reset']),
  model: z.string(),
  tokens: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  previousValue: z.number().optional(),
  newValue: z.number().optional(),
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;

/**
 * Storage keys for Memento
 */
const STORAGE_KEYS = {
  SNAPSHOTS: 'k1-antigravity.history.snapshots',
  EVENTS: 'k1-antigravity.history.events',
  METADATA: 'k1-antigravity.history.metadata',
} as const;

/**
 * Metadata for history storage
 */
interface HistoryMetadata {
  oldestRecord: string | null;
  newestRecord: string | null;
  totalSnapshots: number;
  totalEvents: number;
  lastCleanup: string | null;
}

/**
 * Default history configuration
 */
export interface HistoryConfig {
  retentionDays: number;
  snapshotIntervalMinutes: number;
  maxSnapshots: number;
  maxEvents: number;
}

export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  retentionDays: 30,
  snapshotIntervalMinutes: 5,
  maxSnapshots: 10000,
  maxEvents: 1000,
};

/**
 * History Store using VSCode Memento storage
 * Provides IndexedDB-like interface for quota history
 */
export class HistoryStore {
  private storage: Memento;
  private config: HistoryConfig;
  private nextSnapshotId = 1;
  private nextEventId = 1;
  private lastSnapshotTime = 0;

  constructor(storage: Memento, config: Partial<HistoryConfig> = {}) {
    this.storage = storage;
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...config };
    this.initializeIds();
  }

  /**
   * Initialize auto-increment IDs from existing data
   */
  private initializeIds(): void {
    const snapshots = this.getSnapshots();
    const events = this.getEvents();

    if (snapshots.length > 0) {
      this.nextSnapshotId = Math.max(...snapshots.map(s => s.id || 0)) + 1;
    }

    if (events.length > 0) {
      this.nextEventId = Math.max(...events.map(e => e.id || 0)) + 1;
    }
  }

  /**
   * Get all snapshots from storage
   */
  private getSnapshots(): QuotaSnapshot[] {
    const data = this.storage.get<QuotaSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
    return data.map(s => ({
      ...s,
      timestamp: new Date(s.timestamp),
    }));
  }

  /**
   * Get all events from storage
   */
  private getEvents(): UsageEvent[] {
    const data = this.storage.get<UsageEvent[]>(STORAGE_KEYS.EVENTS, []);
    return data.map(e => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }));
  }

  /**
   * Save snapshots to storage
   */
  private saveSnapshots(snapshots: QuotaSnapshot[]): void {
    this.storage.update(STORAGE_KEYS.SNAPSHOTS, snapshots);
  }

  /**
   * Save events to storage
   */
  private saveEvents(events: UsageEvent[]): void {
    this.storage.update(STORAGE_KEYS.EVENTS, events);
  }

  /**
   * Update metadata
   */
  private updateMetadata(): void {
    const snapshots = this.getSnapshots();
    const events = this.getEvents();

    const metadata: HistoryMetadata = {
      oldestRecord: snapshots.length > 0 ? snapshots[0].timestamp.toISOString() : null,
      newestRecord: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp.toISOString() : null,
      totalSnapshots: snapshots.length,
      totalEvents: events.length,
      lastCleanup: new Date().toISOString(),
    };

    this.storage.update(STORAGE_KEYS.METADATA, metadata);
  }

  /**
   * Save a quota snapshot
   * Rate-limited to avoid storing too frequently
   */
  public async saveSnapshot(snapshot: Omit<QuotaSnapshot, 'id'>): Promise<void> {
    const now = Date.now();
    const intervalMs = this.config.snapshotIntervalMinutes * 60 * 1000;

    // Rate limit snapshots
    if (now - this.lastSnapshotTime < intervalMs) {
      log.debug('Snapshot rate-limited');
      return;
    }

    this.lastSnapshotTime = now;

    const validated = QuotaSnapshotSchema.parse(snapshot);
    const snapshotWithId: QuotaSnapshot = {
      ...validated,
      id: this.nextSnapshotId++,
    };

    const snapshots = this.getSnapshots();
    snapshots.push(snapshotWithId);

    // Enforce max snapshots limit
    while (snapshots.length > this.config.maxSnapshots) {
      snapshots.shift();
    }

    this.saveSnapshots(snapshots);
    this.updateMetadata();

    log.debug(`Saved snapshot: ${snapshot.model} - ${snapshot.quota.toFixed(1)}%`);
  }

  /**
   * Save a usage event
   */
  public async saveEvent(event: Omit<UsageEvent, 'id'>): Promise<void> {
    const validated = UsageEventSchema.parse(event);
    const eventWithId: UsageEvent = {
      ...validated,
      id: this.nextEventId++,
    };

    const events = this.getEvents();
    events.push(eventWithId);

    // Enforce max events limit
    while (events.length > this.config.maxEvents) {
      events.shift();
    }

    this.saveEvents(events);
    this.updateMetadata();

    log.debug(`Saved event: ${event.eventType} - ${event.model}`);
  }

  /**
   * Get quota history within a time range
   */
  public async getHistory(
    start: Date,
    end: Date,
    model?: string
  ): Promise<QuotaSnapshot[]> {
    const snapshots = this.getSnapshots();

    return snapshots.filter(s => {
      const inRange = s.timestamp >= start && s.timestamp <= end;
      const matchesModel = !model || s.model === model;
      return inRange && matchesModel;
    });
  }

  /**
   * Get trend data for a time window
   */
  public async getTrends(windowHours: number): Promise<QuotaSnapshot[]> {
    const now = new Date();
    const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    return this.getHistory(start, now);
  }

  /**
   * Get average usage for a number of days
   */
  public async getAverageUsage(days: number): Promise<Map<string, number>> {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const snapshots = await this.getHistory(start, now);

    // Group by model and calculate averages
    const modelTotals = new Map<string, { sum: number; count: number }>();

    for (const snapshot of snapshots) {
      const existing = modelTotals.get(snapshot.model) || { sum: 0, count: 0 };
      modelTotals.set(snapshot.model, {
        sum: existing.sum + snapshot.quota,
        count: existing.count + 1,
      });
    }

    // Calculate averages
    const averages = new Map<string, number>();
    for (const [model, data] of modelTotals) {
      averages.set(model, data.sum / data.count);
    }

    return averages;
  }

  /**
   * Get usage events within a time range
   */
  public async getEventsInRange(
    start: Date,
    end: Date,
    eventType?: UsageEvent['eventType']
  ): Promise<UsageEvent[]> {
    const events = this.getEvents();

    return events.filter(e => {
      const inRange = e.timestamp >= start && e.timestamp <= end;
      const matchesType = !eventType || e.eventType === eventType;
      return inRange && matchesType;
    });
  }

  /**
   * Clean up old records
   * @returns number of records deleted
   */
  public async cleanup(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const snapshots = this.getSnapshots();
    const events = this.getEvents();

    const filteredSnapshots = snapshots.filter(s => s.timestamp >= cutoff);
    const filteredEvents = events.filter(e => e.timestamp >= cutoff);

    const deletedSnapshots = snapshots.length - filteredSnapshots.length;
    const deletedEvents = events.length - filteredEvents.length;

    this.saveSnapshots(filteredSnapshots);
    this.saveEvents(filteredEvents);
    this.updateMetadata();

    const totalDeleted = deletedSnapshots + deletedEvents;
    log.info(`Cleaned up ${totalDeleted} old records (${olderThanDays} days)`);

    return totalDeleted;
  }

  /**
   * Get metadata about stored data
   */
  public getMetadata(): HistoryMetadata {
    return this.storage.get<HistoryMetadata>(STORAGE_KEYS.METADATA, {
      oldestRecord: null,
      newestRecord: null,
      totalSnapshots: 0,
      totalEvents: 0,
      lastCleanup: null,
    });
  }

  /**
   * Clear all history data
   */
  public async clear(): Promise<void> {
    this.storage.update(STORAGE_KEYS.SNAPSHOTS, []);
    this.storage.update(STORAGE_KEYS.EVENTS, []);
    this.storage.update(STORAGE_KEYS.METADATA, null);
    this.nextSnapshotId = 1;
    this.nextEventId = 1;
    log.info('Cleared all history data');
  }

  /**
   * Get the latest snapshot for each model
   */
  public async getLatestByModel(): Promise<Map<string, QuotaSnapshot>> {
    const snapshots = this.getSnapshots();
    const latest = new Map<string, QuotaSnapshot>();

    for (const snapshot of snapshots) {
      const existing = latest.get(snapshot.model);
      if (!existing || snapshot.timestamp > existing.timestamp) {
        latest.set(snapshot.model, snapshot);
      }
    }

    return latest;
  }

  /**
   * Compress old snapshots (hourly averages instead of raw data)
   * For data older than the retention period
   */
  public async compressOldData(): Promise<number> {
    const snapshots = this.getSnapshots();
    if (snapshots.length < 100) {
      return 0; // Not enough data to compress
    }

    // Group by hour
    const hourGroups = new Map<string, QuotaSnapshot[]>();

    for (const snapshot of snapshots) {
      const hourKey = snapshot.timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const group = hourGroups.get(hourKey) || [];
      group.push(snapshot);
      hourGroups.set(hourKey, group);
    }

    // Keep at most one snapshot per hour
    const compressed: QuotaSnapshot[] = [];

    for (const [, group] of hourGroups) {
      // Keep the most recent one from each hour
      const sorted = group.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      compressed.push(sorted[0]);
    }

    // Sort by timestamp
    compressed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const saved = snapshots.length - compressed.length;
    this.saveSnapshots(compressed);
    this.updateMetadata();

    log.info(`Compressed ${saved} old snapshots`);
    return saved;
  }
}

/**
 * Create a history store from extension context
 */
export function createHistoryStore(
  storage: Memento,
  config?: Partial<HistoryConfig>
): HistoryStore {
  return new HistoryStore(storage, config);
}
