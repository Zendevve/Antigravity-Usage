import * as vscode from 'vscode';
import { log } from '../../util/logger';

const TOKEN_KEY = 'k1-antigravity.connection.token';

export class SecretWrapper {
  constructor(private readonly secrets: vscode.SecretStorage) { }

  public async storeToken(token: string): Promise<void> {
    try {
      await this.secrets.store(TOKEN_KEY, token);
      log.info('Successfully stored connection token in SecretStorage.');
    } catch (err) {
      log.error('Failed to store connection token:', err);
      throw err;
    }
  }

  public async getToken(): Promise<string | undefined> {
    try {
      return await this.secrets.get(TOKEN_KEY);
    } catch (err) {
      log.error('Failed to retrieve connection token:', err);
      return undefined;
    }
  }

  public async deleteToken(): Promise<void> {
    try {
      await this.secrets.delete(TOKEN_KEY);
      log.info('Successfully deleted connection token from SecretStorage.');
    } catch (err) {
      log.error('Failed to delete connection token:', err);
      throw err;
    }
  }
}
