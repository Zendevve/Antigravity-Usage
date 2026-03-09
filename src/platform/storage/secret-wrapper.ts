import * as vscode from 'vscode';
import { log } from '../../util/logger';

const TOKEN_KEY = 'k1-antigravity.connection.token';

/**
 * OAuth token with metadata
 */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
}

/**
 * Secret wrapper for secure storage of tokens and secrets
 */
export class SecretWrapper {
  constructor(private readonly secrets: vscode.SecretStorage) { }

  /**
   * Store a connection token
   */
  public async storeToken(token: string): Promise<void> {
    try {
      await this.secrets.store(TOKEN_KEY, token);
      log.info('Successfully stored connection token in SecretStorage.');
    } catch (err) {
      log.error('Failed to store connection token:', err);
      throw err;
    }
  }

  /**
   * Retrieve the connection token
   */
  public async getToken(): Promise<string | undefined> {
    try {
      return await this.secrets.get(TOKEN_KEY);
    } catch (err) {
      log.error('Failed to retrieve connection token:', err);
      return undefined;
    }
  }

  /**
   * Delete the connection token
   */
  public async deleteToken(): Promise<void> {
    try {
      await this.secrets.delete(TOKEN_KEY);
      log.info('Successfully deleted connection token from SecretStorage.');
    } catch (err) {
      log.error('Failed to delete connection token:', err);
      throw err;
    }
  }

  /**
   * Store an OAuth token with key identifier
   * Key format: k1-antigravity.oauth.{provider}-{identifier}
   */
  public async storeOAuthToken(key: string, tokenData: OAuthTokenData): Promise<void> {
    const oauthKey = `k1-antigravity.oauth.${key}`;
    try {
      const data = JSON.stringify(tokenData);
      await this.secrets.store(oauthKey, data);
      log.debug(`Successfully stored OAuth token for: ${key}`);
    } catch (err) {
      log.error(`Failed to store OAuth token for ${key}:`, err);
      throw err;
    }
  }

  /**
   * Retrieve an OAuth token by key identifier
   */
  public async getOAuthToken(key: string): Promise<OAuthTokenData | null> {
    const oauthKey = `k1-antigravity.oauth.${key}`;
    try {
      const stored = await this.secrets.get(oauthKey);
      if (!stored) {
        return null;
      }
      return JSON.parse(stored) as OAuthTokenData;
    } catch (err) {
      log.error(`Failed to retrieve OAuth token for ${key}:`, err);
      return null;
    }
  }

  /**
   * Delete an OAuth token by key identifier
   */
  public async deleteOAuthToken(key: string): Promise<void> {
    const oauthKey = `k1-antigravity.oauth.${key}`;
    try {
      await this.secrets.delete(oauthKey);
      log.debug(`Successfully deleted OAuth token for: ${key}`);
    } catch (err) {
      log.error(`Failed to delete OAuth token for ${key}:`, err);
      throw err;
    }
  }

  /**
   * Store arbitrary secret data
   */
  public async storeSecret(key: string, value: string): Promise<void> {
    const secretKey = `k1-antigravity.secret.${key}`;
    try {
      await this.secrets.store(secretKey, value);
      log.debug(`Successfully stored secret: ${key}`);
    } catch (err) {
      log.error(`Failed to store secret ${key}:`, err);
      throw err;
    }
  }

  /**
   * Retrieve arbitrary secret data
   */
  public async getSecret(key: string): Promise<string | undefined> {
    const secretKey = `k1-antigravity.secret.${key}`;
    try {
      return await this.secrets.get(secretKey);
    } catch (err) {
      log.error(`Failed to retrieve secret ${key}:`, err);
      return undefined;
    }
  }

  /**
   * Delete arbitrary secret data
   */
  public async deleteSecret(key: string): Promise<void> {
    const secretKey = `k1-antigravity.secret.${key}`;
    try {
      await this.secrets.delete(secretKey);
      log.debug(`Successfully deleted secret: ${key}`);
    } catch (err) {
      log.error(`Failed to delete secret ${key}:`, err);
      throw err;
    }
  }
}
