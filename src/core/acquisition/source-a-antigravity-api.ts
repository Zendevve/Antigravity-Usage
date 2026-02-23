import { QuotaSource } from './source-registry';
import { SourceReading, SourceReadingSchema } from '../types';
import { fetchWithTimeout } from '../../util/http-client';
import { log } from '../../util/logger';

export class AntigravityApiSource implements QuotaSource {
  public readonly id = 'antigravity-api';

  constructor(private port: number, private token?: string) { }

  async fetch(): Promise<SourceReading | null> {
    const url = `http://localhost:${this.port}/api/v1/quota/status`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const result = await fetchWithTimeout(url, SourceReadingSchema, { headers }, 10000, 2);
      return result;
    } catch (e) {
      log.error(`[${this.id}] Fetch failed`, e);
      return null;
    }
  }
}
