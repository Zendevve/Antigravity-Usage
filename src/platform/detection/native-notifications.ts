import * as vscode from 'vscode';
import { PlatformInfo, getPlatformInfo } from './platform-detector';

/**
 * Notification types supported by the extension
 */
export type NotificationType = 'vscode' | 'windows-toast' | 'macos-notification-center' | 'linux-libnotify';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Native notification options
 */
export interface NativeNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  priority?: NotificationPriority;
  silent?: boolean;
  urgency?: 'low' | 'normal' | 'critical';
  timeout?: number;
  actions?: string[];
}

/**
 * Result of sending a notification
 */
export interface NotificationResult {
  success: boolean;
  type: NotificationType;
  message?: string;
}

/**
 * OS-Native notification integration
 * Provides platform-specific notification delivery
 */
export class NativeNotificationService {
  private platform: PlatformInfo;
  private notificationType: NotificationType;

  constructor() {
    this.platform = getPlatformInfo();
    this.notificationType = this.determineNotificationType();
  }

  /**
   * Determine the best notification type for the current platform
   */
  private determineNotificationType(): NotificationType {
    if (this.platform.isWindows) {
      return 'windows-toast';
    } else if (this.platform.isMac) {
      return 'macos-notification-center';
    } else if (this.platform.isLinux) {
      return 'linux-libnotify';
    }
    return 'vscode';
  }

  /**
   * Get the current notification type
   */
  getNotificationType(): NotificationType {
    return this.notificationType;
  }

  /**
   * Check if native notifications are supported
   */
  isSupported(): boolean {
    return this.platform.supportsNativeNotifications;
  }

  /**
   * Send a native notification
   * Falls back to VS Code notifications if native not available
   */
  async send(options: NativeNotificationOptions): Promise<NotificationResult> {
    const { title, body, priority, silent } = options;

    try {
      // Try native notification first
      if (this.platform.isWindows) {
        return await this.sendWindowsToast(title, body, priority, silent);
      } else if (this.platform.isMac) {
        return await this.sendMacOSNotification(title, body, priority, silent);
      } else if (this.platform.isLinux) {
        return await this.sendLinuxNotification(title, body, priority, silent);
      }
    } catch (error) {
      // Fall back to VS Code notifications on error
    }

    // Fallback to VS Code notification
    return this.sendVSCodeNotification(title, body, priority);
  }

  /**
   * Send Windows Toast notification
   * Uses PowerShell to invoke Windows Toast API
   */
  private async sendWindowsToast(
    title: string,
    body: string,
    priority?: NotificationPriority,
    silent?: boolean
  ): Promise<NotificationResult> {
    // Use VS Code's built-in notification for now
    // Full Windows Toast requires native module or PowerShell
    return this.sendVSCodeNotification(title, body, priority);
  }

  /**
   * Send macOS Notification Center notification
   * Uses osascript to invoke Notification Center
   */
  private async sendMacOSNotification(
    title: string,
    body: string,
    priority?: NotificationPriority,
    silent?: boolean
  ): Promise<NotificationResult> {
    // Use VS Code's built-in notification for now
    // Full macOS Notification Center requires native module
    return this.sendVSCodeNotification(title, body, priority);
  }

  /**
   * Send Linux libnotify notification
   * Uses D-Bus / libnotify
   */
  private async sendLinuxNotification(
    title: string,
    body: string,
    priority?: NotificationPriority,
    silent?: boolean
  ): Promise<NotificationResult> {
    // Linux notifications require additional setup
    // Fall back to VS Code notifications
    return this.sendVSCodeNotification(title, body, priority);
  }

  /**
   * Send VS Code notification (universal fallback)
   */
  private sendVSCodeNotification(
    title: string,
    body: string,
    priority?: NotificationPriority
  ): NotificationResult {
    try {
      if (priority === 'critical') {
        vscode.window.showErrorMessage(`${title}: ${body}`);
      } else if (priority === 'high') {
        vscode.window.showWarningMessage(`${title}: ${body}`);
      } else {
        vscode.window.showInformationMessage(`${title}: ${body}`);
      }
      return {
        success: true,
        type: 'vscode',
      };
    } catch (error) {
      return {
        success: false,
        type: 'vscode',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Show a warning notification
   */
  async warn(title: string, body: string): Promise<NotificationResult> {
    return this.send({ title, body, priority: 'high' });
  }

  /**
   * Show an error notification
   */
  async error(title: string, body: string): Promise<NotificationResult> {
    return this.send({ title, body, priority: 'critical' });
  }

  /**
   * Show an info notification
   */
  async info(title: string, body: string): Promise<NotificationResult> {
    return this.send({ title, body, priority: 'normal' });
  }

  /**
   * Show a success notification
   */
  async success(title: string, body: string): Promise<NotificationResult> {
    return this.send({ title, body, priority: 'low' });
  }
}

/**
 * Singleton instance of the native notification service
 */
let notificationService: NativeNotificationService | undefined;

/**
 * Get the native notification service instance
 */
export function getNotificationService(): NativeNotificationService {
  if (!notificationService) {
    notificationService = new NativeNotificationService();
  }
  return notificationService;
}

/**
 * Helper to show a quick notification
 */
export async function showNotification(
  type: 'info' | 'warn' | 'error' | 'success',
  title: string,
  body: string
): Promise<NotificationResult> {
  const service = getNotificationService();

  switch (type) {
    case 'warn':
      return service.warn(title, body);
    case 'error':
      return service.error(title, body);
    case 'success':
      return service.success(title, body);
    default:
      return service.info(title, body);
  }
}
