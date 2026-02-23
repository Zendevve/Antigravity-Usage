import * as vscode from 'vscode';

export enum LogLevel { DEBUG, INFO, WARN, ERROR }

export class K1Logger {
  private channel: vscode.OutputChannel | null = null;
  private sensitivePatterns = [
    /token[=:]\s*\S+/gi,
    /key[=:]\s*\S+/gi,
    /Bearer\s+\S+/gi,
    /[a-f0-9]{32,}/gi,
  ];

  public init(context: vscode.ExtensionContext, channelName: string = 'K1 Diagnostics') {
    this.channel = vscode.window.createOutputChannel(channelName);
    context.subscriptions.push(this.channel);
  }

  log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.channel) return;
    const sanitized = this.sanitize(
      `[${LogLevel[level]}] ${new Date().toISOString()} ${message}`
    );
    this.channel.appendLine(sanitized);
    if (data) {
      this.channel.appendLine(
        `  ${this.sanitize(JSON.stringify(data, null, 2))}`
      );
    }
  }

  debug(message: string, data?: unknown) { this.log(LogLevel.DEBUG, message, data); }
  info(message: string, data?: unknown) { this.log(LogLevel.INFO, message, data); }
  warn(message: string, data?: unknown) { this.log(LogLevel.WARN, message, data); }
  error(message: string, data?: unknown) { this.log(LogLevel.ERROR, message, data); }

  private sanitize(text: string): string {
    let result = text;
    for (const pattern of this.sensitivePatterns) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }
}

export const log = new K1Logger();
