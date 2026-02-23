import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectConnection } from '../detector';

vi.mock('vscode', () => ({
  window: {
    showInputBox: vi.fn(),
  },
}));

describe('Connection Detector', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects via environment variables', async () => {
    vi.stubEnv('ANTIGRAVITY_PORT', '19999');
    vi.stubEnv('ANTIGRAVITY_TOKEN', 'secret123');

    const result = await detectConnection();
    expect(result).toEqual({
      port: 19999,
      token: 'secret123',
      source: 'env'
    });
  });
});
