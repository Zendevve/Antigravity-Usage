import { PlatformInfo, getPlatformInfo } from './platform-detector';

/**
 * Platform-specific configuration interface
 */
export interface PlatformConfig {
  /** Default polling interval in milliseconds */
  defaultPollingInterval: number;
  /** Polling interval when system is idle */
  idlePollingInterval: number;
  /** Polling interval when system is active */
  activePollingInterval: number;
  /** Use system scheduler instead of native polling */
  useSystemScheduler: boolean;
  /** System scheduler type available on this platform */
  schedulerType: 'task-scheduler' | 'launchd' | 'systemd' | 'none';
  /** Whether native notifications are supported */
  supportsNativeNotifications: boolean;
  /** Notification type to use */
  notificationType: 'vscode' | 'windows-toast' | 'macos-notification-center' | 'linux-libnotify';
  /** Path separator for this platform */
  pathSeparator: string;
  /** Config directory path */
  configDir: string;
  /** Data directory path */
  dataDir: string;
  /** Enable performance optimizations for this platform */
  enablePerformanceMode: boolean;
  /** Maximum concurrent connections */
  maxConnections: number;
  /** Connection timeout in ms */
  connectionTimeout: number;
  /** Retry delay base for exponential backoff */
  retryDelayBase: number;
}

/**
 * Get the default platform configuration
 */
export function getDefaultPlatformConfig(): PlatformConfig {
  return getPlatformConfigForInfo(getPlatformInfo());
}

/**
 * Get platform-specific configuration based on platform info
 */
export function getPlatformConfigForInfo(platform: PlatformInfo): PlatformConfig {
  const { family, isWindows, isMac } = platform;

  // Platform-specific polling intervals
  let pollingConfig: {
    default: number;
    idle: number;
    active: number;
    useSystemScheduler: boolean;
    schedulerType: PlatformConfig['schedulerType'];
  };

  // Platform-specific notification settings
  let notificationConfig: {
    supported: boolean;
    type: PlatformConfig['notificationType'];
  };

  // Platform-specific connection settings
  let connectionConfig: {
    maxConnections: number;
    timeout: number;
    retryDelayBase: number;
  };

  switch (family) {
    case 'windows':
      pollingConfig = {
        default: 30000,          // 30 seconds default
        idle: 45000,             // 45 seconds when idle
        active: 5000,            // 5 seconds when active
        useSystemScheduler: true,
        schedulerType: 'task-scheduler',
      };
      notificationConfig = {
        supported: true,
        type: 'windows-toast',
      };
      connectionConfig = {
        maxConnections: 6,
        timeout: 10000,
        retryDelayBase: 1000,
      };
      break;

    case 'darwin':
      pollingConfig = {
        default: 30000,
        idle: 40000,
        active: 5000,
        useSystemScheduler: true,
        schedulerType: 'launchd',
      };
      notificationConfig = {
        supported: true,
        type: 'macos-notification-center',
      };
      connectionConfig = {
        maxConnections: 8,
        timeout: 10000,
        retryDelayBase: 1000,
      };
      break;

    case 'linux':
    default:
      pollingConfig = {
        default: 45000,
        idle: 60000,
        active: 5000,
        useSystemScheduler: true,
        schedulerType: 'systemd',
      };
      notificationConfig = {
        supported: false, // Requires additional setup (libnotify)
        type: 'vscode',
      };
      connectionConfig = {
        maxConnections: 10,
        timeout: 15000,
        retryDelayBase: 1500,
      };
      break;
  }

  return {
    defaultPollingInterval: pollingConfig.default,
    idlePollingInterval: pollingConfig.idle,
    activePollingInterval: pollingConfig.active,
    useSystemScheduler: pollingConfig.useSystemScheduler,
    schedulerType: pollingConfig.schedulerType,
    supportsNativeNotifications: notificationConfig.supported,
    notificationType: notificationConfig.type,
    pathSeparator: isWindows ? '\\' : '/',
    configDir: platform.configDir,
    dataDir: platform.dataDir,
    enablePerformanceMode: isWindows || isMac, // More aggressive on desktop OS
    maxConnections: connectionConfig.maxConnections,
    connectionTimeout: connectionConfig.timeout,
    retryDelayBase: connectionConfig.retryDelayBase,
  };
}

/**
 * Merge user configuration with platform defaults
 * User config takes precedence over platform defaults
 */
export function mergeWithPlatformConfig(
  userConfig: Partial<PlatformConfig>,
  platformConfig: PlatformConfig = getDefaultPlatformConfig()
): PlatformConfig {
  return {
    defaultPollingInterval: userConfig.defaultPollingInterval ?? platformConfig.defaultPollingInterval,
    idlePollingInterval: userConfig.idlePollingInterval ?? platformConfig.idlePollingInterval,
    activePollingInterval: userConfig.activePollingInterval ?? platformConfig.activePollingInterval,
    useSystemScheduler: userConfig.useSystemScheduler ?? platformConfig.useSystemScheduler,
    schedulerType: userConfig.schedulerType ?? platformConfig.schedulerType,
    supportsNativeNotifications: userConfig.supportsNativeNotifications ?? platformConfig.supportsNativeNotifications,
    notificationType: userConfig.notificationType ?? platformConfig.notificationType,
    pathSeparator: userConfig.pathSeparator ?? platformConfig.pathSeparator,
    configDir: userConfig.configDir ?? platformConfig.configDir,
    dataDir: userConfig.dataDir ?? platformConfig.dataDir,
    enablePerformanceMode: userConfig.enablePerformanceMode ?? platformConfig.enablePerformanceMode,
    maxConnections: userConfig.maxConnections ?? platformConfig.maxConnections,
    connectionTimeout: userConfig.connectionTimeout ?? platformConfig.connectionTimeout,
    retryDelayBase: userConfig.retryDelayBase ?? platformConfig.retryDelayBase,
  };
}

/**
 * Get optimal polling interval based on system load
 */
export function getAdaptivePollingInterval(
  platformConfig: PlatformConfig,
  isActive: boolean,
  cpuCount: number,
  freeMemoryPercent: number
): number {
  // Base interval from platform config
  const baseInterval = isActive
    ? platformConfig.activePollingInterval
    : platformConfig.idlePollingInterval;

  // Adjust based on system resources
  let multiplier = 1.0;

  // If low on memory (< 20% free), increase interval
  if (freeMemoryPercent < 20) {
    multiplier = 1.5;
  }

  // If many CPUs, we can be more aggressive
  if (cpuCount >= 8) {
    multiplier *= 0.8;
  }

  return Math.round(baseInterval * multiplier);
}
