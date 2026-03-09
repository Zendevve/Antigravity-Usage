import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryStore, DEFAULT_HISTORY_CONFIG } from '../history-store';

// Mock Memento storage
class MockMemento {
  private data: Map<string, unknown> = new Map();

  get<T>(key: string, defaultValue?: T): T {
    return (this.data.get(key) as T) ?? defaultValue!;
  }

  update(key: string, value: unknown): Thenable<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }
}

describe('HistoryStore', () => {
  let store: HistoryStore;
  let mockStorage: MockMemento;

  beforeEach(() => {
    mockStorage = new MockMemento();
    store = new HistoryStore(mockStorage, {
      retentionDays: 30,
      snapshotIntervalMinutes: 1,
    });
  });

  describe('saveSnapshot', () => {
    it('should save a quota snapshot', async () => {
      await store.saveSnapshot({
        timestamp: new Date(),
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75.5,
        used: 25000,
        limit: 100000,
      });

      const history = await store.getHistory(new Date(0), new Date());
      expect(history).toHaveLength(1);
      expect(history[0].model).toBe('gpt-4');
      expect(history[0].quota).toBe(75.5);
    });

    it('should rate limit snapshots', async () => {
      const now = new Date();
      await store.saveSnapshot({
        timestamp: now,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      // Try to save another immediately - should be rate limited
      await store.saveSnapshot({
        timestamp: new Date(now.getTime() + 1000),
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 70,
        used: 30000,
        limit: 100000,
      });

      const history = await store.getHistory(new Date(0), new Date());
      expect(history).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should retrieve history within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await store.saveSnapshot({
        timestamp: twoDaysAgo,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 90,
        used: 10000,
        limit: 100000,
      });

      await store.saveSnapshot({
        timestamp: yesterday,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 80,
        used: 20000,
        limit: 100000,
      });

      const history = await store.getHistory(yesterday, now);
      expect(history).toHaveLength(1);
      expect(history[0].quota).toBe(80);
    });

    it('should filter by model', async () => {
      const now = new Date();

      await store.saveSnapshot({
        timestamp: now,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      await store.saveSnapshot({
        timestamp: now,
        source: 'antigravity-api',
        model: 'gpt-3.5-turbo',
        quota: 60,
        used: 40000,
        limit: 100000,
      });

      const history = await store.getHistory(new Date(0), new Date(), 'gpt-4');
      expect(history).toHaveLength(1);
      expect(history[0].model).toBe('gpt-4');
    });
  });

  describe('getTrends', () => {
    it('should return data within time window', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await store.saveSnapshot({
        timestamp: oldDate,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 90,
        used: 10000,
        limit: 100000,
      });

      await store.saveSnapshot({
        timestamp: now,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      const trends = await store.getTrends(24);
      expect(trends).toHaveLength(1);
      expect(trends[0].quota).toBe(75);
    });
  });

  describe('cleanup', () => {
    it('should remove old records', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      await store.saveSnapshot({
        timestamp: oldDate,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 90,
        used: 10000,
        limit: 100000,
      });

      const deleted = await store.cleanup(30);
      expect(deleted).toBe(1);

      const history = await store.getHistory(new Date(0), new Date());
      expect(history).toHaveLength(0);
    });
  });

  describe('getLatestByModel', () => {
    it('should return latest snapshot for each model', async () => {
      const now = new Date();

      await store.saveSnapshot({
        timestamp: new Date(now.getTime() - 60 * 60 * 1000),
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 80,
        used: 20000,
        limit: 100000,
      });

      await store.saveSnapshot({
        timestamp: now,
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      const latest = await store.getLatestByModel();
      expect(latest.get('gpt-4')?.quota).toBe(75);
    });
  });

  describe('clear', () => {
    it('should clear all history', async () => {
      await store.saveSnapshot({
        timestamp: new Date(),
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      await store.clear();

      const history = await store.getHistory(new Date(0), new Date());
      expect(history).toHaveLength(0);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata about stored data', async () => {
      await store.saveSnapshot({
        timestamp: new Date(),
        source: 'antigravity-api',
        model: 'gpt-4',
        quota: 75,
        used: 25000,
        limit: 100000,
      });

      const metadata = store.getMetadata();
      expect(metadata.totalSnapshots).toBe(1);
      expect(metadata.oldestRecord).not.toBeNull();
      expect(metadata.newestRecord).not.toBeNull();
    });
  });
});
