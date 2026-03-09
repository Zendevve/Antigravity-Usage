import * as vscode from 'vscode';

/**
 * Privacy configuration interface
 */
export interface PrivacyConfig {
  telemetryEnabled: boolean;
  localOnlyMode: boolean;
  anonymizedId: string;  // Generated once, stored locally
}

/**
 * API security configuration
 */
export interface APISecurityConfig {
  apiEnabled: boolean;
  restApiEnabled: boolean;
  restApiPort: number;
  apiKey: string | null;
  webhookEnabled: boolean;
}

/**
 * Privacy settings keys for VSCode configuration
 */
export const PRIVACY_SETTINGS = {
  TELEMETRY_ENABLED: 'k1-antigravity.telemetryEnabled',
  LOCAL_ONLY_MODE: 'k1-antigravity.localOnlyMode',
  ANONYMIZED_ID: 'k1-antigravity.anonymizedId',
  PRIVACY_NOTICE_SHOWN: 'k1-antigravity.privacyNoticeShown',
  // API Keys (stored in secrets)
  API_KEY: 'k1-antigravity.apiKey',
} as const;

/**
 * Privacy manager - handles privacy-related configuration
 */
export class PrivacyManager {
  private context: vscode.ExtensionContext;
  private config: PrivacyConfig | null = null;
  private apiConfig: APISecurityConfig | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize privacy configuration
   */
  public async initialize(): Promise<PrivacyConfig> {
    // Get or generate anonymized ID
    let anonymizedId = this.context.globalState.get<string>(PRIVACY_SETTINGS.ANONYMIZED_ID);

    if (!anonymizedId) {
      // Generate a new UUID for this extension instance
      anonymizedId = this.generateUuid();
      await this.context.globalState.update(PRIVACY_SETTINGS.ANONYMIZED_ID, anonymizedId);
    }

    // Get telemetry setting from VSCode config
    const telemetryConfig = vscode.workspace.getConfiguration('k1-antigravity');
    const telemetryEnabled = telemetryConfig.get<boolean>('telemetryEnabled', false);
    const localOnlyMode = telemetryConfig.get<boolean>('localOnlyMode', false);

    this.config = {
      telemetryEnabled,
      localOnlyMode,
      anonymizedId,
    };

    return this.config;
  }

  /**
   * Get current privacy configuration
   */
  public getConfig(): PrivacyConfig {
    if (!this.config) {
      throw new Error('PrivacyManager not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Check if telemetry is enabled
   */
  public isTelemetryEnabled(): boolean {
    return this.config?.telemetryEnabled ?? false;
  }

  /**
   * Check if local-only mode is enabled
   */
  public isLocalOnlyMode(): boolean {
    return this.config?.localOnlyMode ?? false;
  }

  /**
   * Get anonymized ID
   */
  public getAnonymizedId(): string {
    return this.config?.anonymizedId ?? '';
  }

  /**
   * Update telemetry setting
   */
  public async setTelemetryEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('k1-antigravity');
    await config.update('telemetryEnabled', enabled, vscode.ConfigurationTarget.Global);

    if (this.config) {
      this.config.telemetryEnabled = enabled;
    }
  }

  /**
   * Update local-only mode setting
   */
  public async setLocalOnlyMode(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('k1-antigravity');
    await config.update('localOnlyMode', enabled, vscode.ConfigurationTarget.Global);

    if (this.config) {
      this.config.localOnlyMode = enabled;
    }
  }

  /**
   * Check if privacy notice has been shown
   */
  public isPrivacyNoticeShown(): boolean {
    return this.context.globalState.get<boolean>(PRIVACY_SETTINGS.PRIVACY_NOTICE_SHOWN, false);
  }

  /**
   * Mark privacy notice as shown
   */
  public async markPrivacyNoticeShown(): Promise<void> {
    await this.context.globalState.update(PRIVACY_SETTINGS.PRIVACY_NOTICE_SHOWN, true);
  }

  /**
   * Initialize API security configuration
   */
  public async initializeAPISecurity(): Promise<APISecurityConfig> {
    const wsConfig = vscode.workspace.getConfiguration('k1-antigravity');

    // Get API key from secure storage
    let apiKey = await this.context.secrets.get(PRIVACY_SETTINGS.API_KEY);

    // Generate a new API key if none exists
    if (!apiKey) {
      apiKey = this.generateSecureKey();
      await this.context.secrets.store(PRIVACY_SETTINGS.API_KEY, apiKey);
    }

    this.apiConfig = {
      apiEnabled: wsConfig.get<boolean>('apiEnabled', false),
      restApiEnabled: wsConfig.get<boolean>('restApiEnabled', false),
      restApiPort: wsConfig.get<number>('restApiPort', 13338),
      apiKey,
      webhookEnabled: wsConfig.get<boolean>('webhookEnabled', false),
    };

    return this.apiConfig;
  }

  /**
   * Get API security configuration
   */
  public getAPISecurityConfig(): APISecurityConfig {
    if (!this.apiConfig) {
      throw new Error('APISecurityConfig not initialized. Call initializeAPISecurity() first.');
    }
    return this.apiConfig;
  }

  /**
   * Regenerate API key
   */
  public async regenerateAPIKey(): Promise<string> {
    const newKey = this.generateSecureKey();
    await this.context.secrets.store(PRIVACY_SETTINGS.API_KEY, newKey);

    if (this.apiConfig) {
      this.apiConfig.apiKey = newKey;
    }

    return newKey;
  }

  /**
   * Check if REST API is enabled
   */
  public isRESTApiEnabled(): boolean {
    return this.apiConfig?.restApiEnabled ?? false;
  }

  /**
   * Check if webhooks are enabled
   */
  public areWebhooksEnabled(): boolean {
    return this.apiConfig?.webhookEnabled ?? false;
  }

  /**
   * Generate a secure random API key
   */
  private generateSecureKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'k1_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  /**
   * Generate a random UUID v4
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Create privacy manager instance
 */
export function createPrivacyManager(context: vscode.ExtensionContext): PrivacyManager {
  return new PrivacyManager(context);
}
