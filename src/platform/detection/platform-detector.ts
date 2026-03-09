import * as os from 'os';
import * as process from 'process';

/**
 * Platform family identifiers
 */
export type PlatformFamily = 'windows' | 'darwin' | 'linux';

/**
 * Extended platform information
 */
export interface PlatformInfo {
  family: PlatformFamily;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  arch: string;
  release: string;
  hostname: string;
  homedir: string;
  tmpdir: string;
  /**
   * Platform-specific config directory
   */
  configDir: string;
  /**
   * Platform-specific data directory
   */
  dataDir: string;
  /**
   * Whether the platform supports system notifications natively
   */
  supportsNativeNotifications: boolean;
  /**
   * Default polling interval in ms for this platform
   */
  defaultPollingInterval: number;
  /**
   * Whether system scheduler is available
   */
  hasSystemScheduler: boolean;
}

/**
 * Get the platform family from the process platform
 */
export function getPlatformFamily(): PlatformFamily {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'darwin';
  return 'linux';
}

/**
 * Get the config directory for the current platform
 */
export function getPlatformConfigDir(): string {
  const platform = getPlatformFamily();
  const homedir = os.homedir();

  switch (platform) {
    case 'windows':
      // Windows: %APPDATA% or %LOCALAPPDATA%
      return process.env.APPDATA || pathJoin(homedir, 'AppData', 'Roaming');
    case 'darwin':
      // macOS: ~/Library/Application Support
      return pathJoin(homedir, 'Library', 'Application Support');
    case 'linux':
    default:
      // Linux: ~/.config (XDG Base Directory Specification)
      return process.env.XDG_CONFIG_HOME || pathJoin(homedir, '.config');
  }
}

/**
 * Get the data directory for the current platform
 */
export function getPlatformDataDir(): string {
  const platform = getPlatformFamily();
  const homedir = os.homedir();

  switch (platform) {
    case 'windows':
      // Windows: %LOCALAPPDATA%
      return process.env.LOCALAPPDATA || pathJoin(homedir, 'AppData', 'Local');
    case 'darwin':
      // macOS: ~/Library/Application Support
      return pathJoin(homedir, 'Library', 'Application Support');
    case 'linux':
    default:
      // Linux: ~/.local/share (XDG Base Directory Specification)
      return process.env.XDG_DATA_HOME || pathJoin(homedir, '.local', 'share');
  }
}

/**
 * Normalize path for cross-platform compatibility
 */
export function normalizePath(path: string): string {
  if (!path) return path;

  // Replace backslashes with forward slashes for consistency
  let normalized = path.replace(/\\/g, '/');

  // Handle Windows drive letters (C:, D:, etc.)
  // Convert C:/path to /c/path for consistency
  if (/^[a-zA-Z]:/.test(normalized)) {
    const drive = normalized.charAt(0).toLowerCase();
    normalized = '/' + drive + normalized.substring(2);
  }

  return normalized;
}

/**
 * Join path segments with platform-appropriate separator
 */
export function pathJoin(...segments: string[]): string {
  return segments.join(pathSep());
}

/**
 * Get platform-specific path separator
 */
export function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

/**
 * Check if a path is absolute
 */
export function isAbsolute(path: string): boolean {
  if (!path) return false;

  // POSIX absolute path
  if (path.charAt(0) === '/') return true;

  // Windows absolute path (C:\, D:\, etc.)
  if (/^[a-zA-Z]:[/\\]/.test(path)) return true;

  // Windows UNC path (\\server\share)
  if (/^\\\\/.test(path)) return true;

  return false;
}

/**
 * Get the home directory in a platform-appropriate way
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Get the temp directory in a platform-appropriate way
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Get detailed platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const family = getPlatformFamily();
  const isWindows = family === 'windows';
  const isMac = family === 'darwin';
  const isLinux = family === 'linux';

  // Platform-specific polling intervals (optimized for each OS)
  const pollingIntervals = {
    windows: {
      default: 30000,     // 30s - Windows optimized
      active: 5000,       // 5s - faster for responsiveness
    },
    darwin: {
      default: 30000,     // 30s - macOS optimized
      active: 5000,       // 5s
    },
    linux: {
      default: 45000,     // 45s - Linux can be more aggressive with intervals
      active: 5000,       // 5s
    },
  };

  return {
    family,
    isWindows,
    isMac,
    isLinux,
    arch: process.arch,
    release: os.release(),
    hostname: os.hostname(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    configDir: getPlatformConfigDir(),
    dataDir: getPlatformDataDir(),
    supportsNativeNotifications: isWindows || isMac, // Linux needs additional setup
    defaultPollingInterval: pollingIntervals[family].default,
    hasSystemScheduler: isWindows || isMac || isLinux, // All support some form
  };
}

/**
 * Detect if the system has reduced motion enabled (accessibility)
 * This is a placeholder - in a real implementation, this would check
 * the OS accessibility settings
 */
export async function getReducedMotion(): Promise<boolean> {
  // In VS Code, this would be accessed via vscode.env.accessibilitySupport
  // For now, we return false as a default
  return false;
}

/**
 * Get system CPU count for resource-aware operations
 */
export function getCpuCount(): number {
  return os.cpus().length;
}

/**
 * Get total system memory in bytes
 */
export function getTotalMemory(): number {
  return os.totalmem();
}

/**
 * Get free system memory in bytes
 */
export function getFreeMemory(): number {
  return os.freemem();
}

/**
 * Check if running in a container/VM environment
 */
export function isContainerized(): boolean {
  // Check for common container indicators
  const containerIndicators = [
    process.env.DOCKER_CONTAINER,
    process.env.KUBERNETES_SERVICE_HOST,
    process.env.OCI_RUNTIME,
  ];

  return containerIndicators.some(Boolean) ||
    process.env.HOME === '/root' && process.platform !== 'win32';
}
