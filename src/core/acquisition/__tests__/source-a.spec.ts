import { describe, it, expect, vi } from 'vitest';
import { AntigravityApiSource } from '../source-a-antigravity-api';
import * as httpClient from '../../../util/http-client';

vi.mock('../../../util/http-client', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
  window: {
    showErrorMessage: vi.fn(),
  }
}));

describe('AntigravityApiSource', () => {
  it('fetches and returns a valid SourceReading', async () => {
    const mockReading = {
      sourceId: 'antigravity-api',
      remainingPercent: 50,
      remainingTokens: 5000,
      totalTokens: 10000,
      model: 'test',
      fetchedAt: new Date(),
      freshnessMs: 100,
    };

    vi.mocked(httpClient.fetchWithTimeout).mockResolvedValueOnce(mockReading as any);

    const source = new AntigravityApiSource(13337);
    const result = await source.fetch();

    expect(result).toEqual(mockReading);
    expect(httpClient.fetchWithTimeout).toHaveBeenCalledWith(
      'http://localhost:13337/api/v1/quota/status',
      expect.anything(),
      { headers: { Accept: 'application/json' } },
      10000,
      2
    );
  });
});
