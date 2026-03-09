import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudBillingSource, CloudBillingConfig, CloudProvider } from '../source-b-cloud-billing';
import { SecretWrapper, OAuthTokenData } from '../../platform/storage/secret-wrapper';

// Mock the logger
vi.mock('../../util/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('CloudBillingSource', () => {
  let source: CloudBillingSource;
  let mockSecretWrapper: Partial<SecretWrapper>;
  let config: CloudBillingConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      provider: 'gcp' as CloudProvider,
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
      scope: ['https://www.googleapis.com/auth/cloud-platform.read-only'],
      region: 'test-project',
    };

    mockSecretWrapper = {
      storeOAuthToken: vi.fn().mockResolvedValue(undefined),
      getOAuthToken: vi.fn().mockResolvedValue(null),
    };

    source = new CloudBillingSource(config, mockSecretWrapper as SecretWrapper);
  });

  describe('initialization', () => {
    it('should create a source with correct id', () => {
      expect(source.id).toBe('cloud-billing');
    });

    it('should initialize and load cached token', async () => {
      const cachedToken: OAuthTokenData = {
        accessToken: 'cached-access-token',
        refreshToken: 'cached-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        scope: 'test-scope',
      };

      vi.mocked(mockSecretWrapper.getOAuthToken).mockResolvedValueOnce(cachedToken);

      await source.initialize();

      expect(mockSecretWrapper.getOAuthToken).toHaveBeenCalledWith('gcp-test-project');
    });
  });

  describe('fetch', () => {
    it('should return null when OAuth flow fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await source.fetch();

      expect(result).toBeNull();
    });

    it('should return null when token is invalid and refresh fails', async () => {
      // Setup with an expired token
      const expiredToken: OAuthTokenData = {
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        scope: 'test-scope',
      };

      vi.mocked(mockSecretWrapper.getOAuthToken).mockResolvedValueOnce(expiredToken);
      vi.mocked(fetch).mockRejectedValueOnce(new Error('OAuth failed'));

      await source.initialize();
      const result = await source.fetch();

      expect(result).toBeNull();
    });
  });

  describe('OAuth flow', () => {
    it('should perform OAuth flow and store token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'test-scope',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      // Trigger OAuth flow by ensuring we don't have a valid token
      vi.mocked(mockSecretWrapper.getOAuthToken).mockResolvedValue(null);

      await source.initialize();

      // The fetch should have been called for OAuth
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('getToken', () => {
    it('should return null when no token is loaded', () => {
      const token = source.getToken();
      expect(token).toBeNull();
    });
  });
});

describe('CloudBillingSource with AWS', () => {
  let source: CloudBillingSource;
  let mockSecretWrapper: Partial<SecretWrapper>;

  beforeEach(() => {
    vi.clearAllMocks();

    const config: CloudBillingConfig = {
      provider: 'aws',
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
      scope: ['sts:AssumeRole'],
      region: 'us-east-1',
    };

    mockSecretWrapper = {
      storeOAuthToken: vi.fn().mockResolvedValue(undefined),
      getOAuthToken: vi.fn().mockResolvedValue(null),
    };

    source = new CloudBillingSource(config, mockSecretWrapper as SecretWrapper);
  });

  it('should create an AWS source', () => {
    expect(source.id).toBe('cloud-billing');
  });
});

describe('CloudBillingSource with Azure', () => {
  let source: CloudBillingSource;
  let mockSecretWrapper: Partial<SecretWrapper>;

  beforeEach(() => {
    vi.clearAllMocks();

    const config: CloudBillingConfig = {
      provider: 'azure',
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tenantId: 'test-tenant-id',
      },
      scope: ['https://management.azure.com/.default'],
      subscriptionId: 'test-subscription',
    };

    mockSecretWrapper = {
      storeOAuthToken: vi.fn().mockResolvedValue(undefined),
      getOAuthToken: vi.fn().mockResolvedValue(null),
    };

    source = new CloudBillingSource(config, mockSecretWrapper as SecretWrapper);
  });

  it('should create an Azure source', () => {
    expect(source.id).toBe('cloud-billing');
  });
});
