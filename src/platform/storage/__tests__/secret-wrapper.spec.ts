import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretWrapper } from '../secret-wrapper';

vi.mock('vscode', () => ({}));

vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('SecretWrapper', () => {
  let mockSecretStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSecretStorage = {
      store: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue('test-token-123'),
      delete: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('stores a token successfully', async () => {
    const wrapper = new SecretWrapper(mockSecretStorage);
    await wrapper.storeToken('secret-xyz');

    expect(mockSecretStorage.store).toHaveBeenCalledWith('k1-antigravity.connection.token', 'secret-xyz');
  });

  it('retrieves a token successfully', async () => {
    const wrapper = new SecretWrapper(mockSecretStorage);
    const token = await wrapper.getToken();

    expect(mockSecretStorage.get).toHaveBeenCalledWith('k1-antigravity.connection.token');
    expect(token).toBe('test-token-123');
  });

  it('deletes a token successfully', async () => {
    const wrapper = new SecretWrapper(mockSecretStorage);
    await wrapper.deleteToken();

    expect(mockSecretStorage.delete).toHaveBeenCalledWith('k1-antigravity.connection.token');
  });
});
