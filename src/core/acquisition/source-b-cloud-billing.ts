import { z } from 'zod';
import { QuotaSource } from './source-registry';
import { SourceReading, SourceReadingSchema } from '../types';
import { fetchWithTimeout } from '../../util/http-client';
import { log } from '../../util/logger';
import { SecretWrapper, OAuthTokenData } from '../../platform/storage/secret-wrapper';

/**
 * Cloud provider types supported by the billing source
 */
export type CloudProvider = 'aws' | 'gcp' | 'azure';

/**
 * Configuration for Cloud Billing Source
 */
export interface CloudBillingConfig {
  provider: CloudProvider;
  credentials: {
    clientId: string;
    clientSecret: string;
    tenantId?: string; // Azure-specific
  };
  scope: string[];
  region?: string; // AWS region or GCP project ID
  subscriptionId?: string; // Azure subscription ID
}

/**
 * OAuth token response schema
 */
const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

/**
 * Cloud billing API response schemas
 */
const AWSQuotaResponseSchema = z.object({
  QuotaArn: z.string(),
  ServiceCode: z.string(),
  QuotaCode: z.string(),
  Value: z.number(),
  Unit: z.string().optional(),
  LastModifiedDate: z.string().optional(),
});

const GCPQuotaResponseSchema = z.object({
  name: z.string(),
  metric: z.string(),
  limit: z.number(),
  used: z.number().optional(),
});

const AzureQuotaResponseSchema = z.object({
  id: z.string(),
  name: z.object({
    value: z.string(),
    localizedValue: z.string(),
  }),
  limit: z.number(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
});

/**
 * OAuth token with metadata
 */
interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string;
}

/**
 * Source B: Cloud Billing OAuth Source
 * Fetches quota data from cloud provider billing APIs using OAuth 2.0
 */
export class CloudBillingSource implements QuotaSource {
  public readonly id = 'cloud-billing';

  private token: OAuthToken | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private config: CloudBillingConfig,
    private secretWrapper: SecretWrapper
  ) { }

  /**
   * Initialize the source and load cached tokens
   */
  async initialize(): Promise<void> {
    await this.loadToken();
  }

  /**
   * Fetch quota data from the cloud provider
   */
  async fetch(): Promise<SourceReading | null> {
    try {
      // Ensure we have a valid token
      await this.ensureValidToken();

      // Fetch based on provider
      let reading: SourceReading | null = null;

      switch (this.config.provider) {
        case 'aws':
          reading = await this.fetchAWSQuota();
          break;
        case 'gcp':
          reading = await this.fetchGCPQuota();
          break;
        case 'azure':
          reading = await this.fetchAzureQuota();
          break;
      }

      return reading;
    } catch (e) {
      log.error(`[${this.id}] Fetch failed`, e);
      return null;
    }
  }

  /**
   * Ensure we have a valid OAuth token, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      // Token is still valid
      return;
    }

    if (this.token?.refreshToken) {
      // Try to refresh the token
      await this.refreshToken();
    } else {
      // Need to perform full OAuth flow
      await this.performOAuthFlow();
    }
  }

  /**
   * Perform the OAuth 2.0 authorization code flow
   */
  private async performOAuthFlow(): Promise<void> {
    const { provider, credentials, scope } = this.config;

    let tokenUrl: string;
    let requestBody: Record<string, string>;
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    switch (provider) {
      case 'aws':
        // AWS uses AWS STS, not standard OAuth
        tokenUrl = 'https://sts.amazonaws.com/';
        requestBody = {
          Action: 'AssumeRole',
          RoleSessionName: 'k1-antigravity-session',
          DurationSeconds: '3600',
        };
        break;

      case 'gcp':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        requestBody = {
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: scope.join(' '),
        };
        break;

      case 'azure':
        tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
        requestBody = {
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: scope.join(' '),
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers,
        body: new URLSearchParams(requestBody),
      });

      if (!response.ok) {
        throw new Error(`OAuth flow failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      const result = OAuthTokenResponseSchema.safeParse(data);

      if (!result.success) {
        throw new Error(`Token response validation failed: ${result.error.message}`);
      }

      const tokenResponse: OAuthTokenResponse = result.data;
      this.token = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        scope: tokenResponse.scope ?? scope.join(' '),
      };

      if (tokenResponse.expires_in) {
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }

      // Store the token securely
      await this.saveToken();

      log.info(`[${this.id}] OAuth flow completed successfully`);
    } catch (e) {
      log.error(`[${this.id}] OAuth flow failed`, e);
      throw e;
    }
  }

  /**
   * Refresh an expired OAuth token
   */
  private async refreshToken(): Promise<void> {
    const { provider, credentials } = this.config;

    if (!this.token?.refreshToken) {
      await this.performOAuthFlow();
      return;
    }

    let tokenUrl: string;
    let requestBody: Record<string, string>;

    switch (provider) {
      case 'gcp':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        requestBody = {
          grant_type: 'refresh_token',
          refresh_token: this.token.refreshToken,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        };
        break;

      case 'azure':
        tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
        requestBody = {
          grant_type: 'refresh_token',
          refresh_token: this.token.refreshToken,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        };
        break;

      case 'aws':
        // AWS doesn't support token refresh in the same way
        await this.performOAuthFlow();
        return;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(requestBody),
      });

      if (!response.ok) {
        // Token refresh failed, need to re-authenticate
        log.warn(`[${this.id}] Token refresh failed, re-authenticating`);
        await this.performOAuthFlow();
        return;
      }

      const data = await response.json();
      const result = OAuthTokenResponseSchema.safeParse(data);

      if (!result.success) {
        await this.performOAuthFlow();
        return;
      }

      const tokenResponse: OAuthTokenResponse = result.data;
      this.token = {
        ...this.token,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? this.token.refreshToken,
      };

      if (tokenResponse.expires_in) {
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }

      await this.saveToken();

      log.info(`[${this.id}] Token refreshed successfully`);
    } catch (e) {
      log.error(`[${this.id}] Token refresh failed`, e);
      // Fall back to full OAuth flow
      await this.performOAuthFlow();
    }
  }

  /**
   * Save token to secure storage
   */
  private async saveToken(): Promise<void> {
    if (!this.token) return;

    const key = `${this.config.provider}-${this.config.region ?? 'default'}`;
    const tokenData: OAuthTokenData = {
      accessToken: this.token.accessToken,
      refreshToken: this.token.refreshToken,
      expiresAt: this.tokenExpiresAt?.toISOString(),
      scope: this.token.scope,
    };

    await this.secretWrapper.storeOAuthToken(key, tokenData);
  }

  /**
   * Load token from secure storage
   */
  private async loadToken(): Promise<void> {
    const key = `${this.config.provider}-${this.config.region ?? 'default'}`;
    const stored = await this.secretWrapper.getOAuthToken(key);

    if (!stored) {
      log.debug(`[${this.id}] No cached token found`);
      return;
    }

    try {
      this.token = {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        scope: stored.scope ?? '',
      };
      if (stored.expiresAt) {
        this.tokenExpiresAt = new Date(stored.expiresAt);
      }
      log.debug(`[${this.id}] Loaded cached token`);
    } catch (e) {
      log.warn(`[${this.id}] Failed to parse cached token`, e);
    }
  }

  /**
   * Fetch quota from AWS CloudWatch
   */
  private async fetchAWSQuota(): Promise<SourceReading | null> {
    // AWS requires signing requests, simplified for this implementation
    const endpoint = `https://${this.config.region ?? 'us-east-1'}.monitoring.amazonaws.com/`;
    const url = `${endpoint}?Action=GetServiceQuota&ServiceCode=aws-model-inferencing&QuotaCode=L-DCF9ED04`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token?.accessToken}`,
        },
      });

      if (!response.ok) {
        log.warn(`[${this.id}] AWS quota fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const result = AWSQuotaResponseSchema.safeParse(data.GetServiceQuotaResult.Quota);

      if (!result.success) {
        return null;
      }

      const quota = result.data;
      return this.createReading(quota.Value, quota.Value, 'aws-inference');
    } catch (e) {
      log.error(`[${this.id}] AWS quota fetch error`, e);
      return null;
    }
  }

  /**
   * Fetch quota from GCP Cloud Billing API
   */
  private async fetchGCPQuota(): Promise<SourceReading | null> {
    const projectId = this.config.region;
    if (!projectId) {
      log.warn(`[${this.id}] GCP project ID not configured`);
      return null;
    }

    const url = `https://cloudbilling.googleapis.com/v1/projects/${projectId}/services`;
    const headers = {
      Authorization: `Bearer ${this.token?.accessToken}`,
      Accept: 'application/json',
    };

    try {
      const result = await fetchWithTimeout(
        url,
        z.object({
          services: z.array(GCPQuotaResponseSchema).optional(),
        }),
        { headers },
        10000,
        2
      );

      if (!result || !result.services) {
        return null;
      }

      // Find AI Platform quota
      const aiService = result.services.find(
        (s) => s.metric === 'aiplatform.googleapis.com/prediction_endpoint_requests'
      );

      if (!aiService) {
        return null;
      }

      const used = aiService.used ?? 0;
      return this.createReading(aiService.limit - used, aiService.limit, 'gcp-ai-platform');
    } catch (e) {
      log.error(`[${this.id}] GCP quota fetch error`, e);
      return null;
    }
  }

  /**
   * Fetch quota from Azure Resource Manager
   */
  private async fetchAzureQuota(): Promise<SourceReading | null> {
    const subscriptionId = this.config.subscriptionId;
    const tenantId = this.config.credentials.tenantId;

    if (!subscriptionId || !tenantId) {
      log.warn(`[${this.id}] Azure subscription ID or tenant ID not configured`);
      return null;
    }

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CognitiveServices/quotas?api-version=2023-05-01`;
    const headers = {
      Authorization: `Bearer ${this.token?.accessToken}`,
      Accept: 'application/json',
    };

    try {
      const result = await fetchWithTimeout(
        url,
        z.object({
          value: z.array(AzureQuotaResponseSchema).optional(),
        }),
        { headers },
        10000,
        2
      );

      if (!result || !result.value || result.value.length === 0) {
        return null;
      }

      // Find Compute quota (for inference)
      const computeQuota = result.value.find(
        (q) => q.name.value === 'CognitiveServices.ComputeAccount'
      );

      if (!computeQuota) {
        return null;
      }

      const limit = computeQuota.limit;
      const used = computeQuota.currentValue ?? 0;
      return this.createReading(limit - used, limit, 'azure-cognitive-services');
    } catch (e) {
      log.error(`[${this.id}] Azure quota fetch error`, e);
      return null;
    }
  }

  /**
   * Create a SourceReading from quota values
   */
  private createReading(
    remainingTokens: number,
    totalTokens: number,
    model: string
  ): SourceReading {
    const remainingPercent = totalTokens > 0 ? (remainingTokens / totalTokens) * 100 : 0;

    return SourceReadingSchema.parse({
      sourceId: this.id,
      remainingPercent: Math.max(0, Math.min(100, remainingPercent)),
      remainingTokens: Math.max(0, remainingTokens),
      totalTokens: Math.max(0, totalTokens),
      model,
      fetchedAt: new Date(),
      freshnessMs: 0,
    });
  }

  /**
   * Get the current token for testing purposes
   */
  getToken(): OAuthToken | null {
    return this.token;
  }
}
