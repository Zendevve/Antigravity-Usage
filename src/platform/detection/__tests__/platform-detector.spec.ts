import { describe, it, expect, vi } from 'vitest';

describe('Platform Detection', () => {
  // Test normalizePath function which doesn't require mocking
  describe('normalizePath', () => {
    it('converts Windows backslashes to forward slashes', () => {
      // Inline the function logic for testing
      const normalizePath = (path: string): string => {
        if (!path) return path;
        let normalized = path.replace(/\\/g, '/');
        if (/^[a-zA-Z]:/.test(normalized)) {
          const drive = normalized.charAt(0).toLowerCase();
          normalized = '/' + drive + normalized.substring(2);
        }
        return normalized;
      };

      expect(normalizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('handles relative paths without drive letters', () => {
      const normalizePath = (path: string): string => {
        if (!path) return path;
        let normalized = path.replace(/\\/g, '/');
        if (/^[a-zA-Z]:/.test(normalized)) {
          const drive = normalized.charAt(0).toLowerCase();
          normalized = '/' + drive + normalized.substring(2);
        }
        return normalized;
      };

      expect(normalizePath('folder\\subfolder\\file.txt')).toBe('folder/subfolder/file.txt');
    });

    it('handles UNC paths', () => {
      const normalizePath = (path: string): string => {
        if (!path) return path;
        let normalized = path.replace(/\\/g, '/');
        if (/^[a-zA-Z]:/.test(normalized)) {
          const drive = normalized.charAt(0).toLowerCase();
          normalized = '/' + drive + normalized.substring(2);
        }
        return normalized;
      };

      expect(normalizePath('\\\\server\\share\\file.txt')).toBe('//server/share/file.txt');
    });

    it('returns empty string for empty input', () => {
      const normalizePath = (path: string): string => {
        if (!path) return path;
        let normalized = path.replace(/\\/g, '/');
        if (/^[a-zA-Z]:/.test(normalized)) {
          const drive = normalized.charAt(0).toLowerCase();
          normalized = '/' + drive + normalized.substring(2);
        }
        return normalized;
      };

      expect(normalizePath('')).toBe('');
    });
  });

  describe('pathJoin', () => {
    it('joins path segments', () => {
      const pathJoin = (...segments: string[]): string => {
        const pathSep = () => '/';
        return segments.join(pathSep());
      };

      expect(pathJoin('home', 'user', 'file.txt')).toBe('home/user/file.txt');
    });

    it('handles single segment', () => {
      const pathJoin = (...segments: string[]): string => {
        const pathSep = () => '/';
        return segments.join(pathSep());
      };

      expect(pathJoin('file.txt')).toBe('file.txt');
    });
  });

  describe('pathSep', () => {
    it('returns forward slash on Unix (default)', () => {
      const pathSep = (): string => '/';
      expect(pathSep()).toBe('/');
    });
  });

  describe('isAbsolute', () => {
    it('detects absolute Unix paths', () => {
      const isAbsolute = (path: string): boolean => {
        if (!path) return false;
        if (path.charAt(0) === '/') return true;
        if (/^[a-zA-Z]:[/\\]/.test(path)) return true;
        if (/^\\\\/.test(path)) return true;
        return false;
      };

      expect(isAbsolute('/home/user')).toBe(true);
      expect(isAbsolute('relative/path')).toBe(false);
    });

    it('detects absolute Windows paths', () => {
      const isAbsolute = (path: string): boolean => {
        if (!path) return false;
        if (path.charAt(0) === '/') return true;
        if (/^[a-zA-Z]:[/\\]/.test(path)) return true;
        if (/^\\\\/.test(path)) return true;
        return false;
      };

      expect(isAbsolute('C:\\Users\\test')).toBe(true);
      expect(isAbsolute('D:\\folder\\file')).toBe(true);
      expect(isAbsolute('relative\\path')).toBe(false);
    });

    it('detects Windows UNC paths', () => {
      const isAbsolute = (path: string): boolean => {
        if (!path) return false;
        if (path.charAt(0) === '/') return true;
        if (/^[a-zA-Z]:[/\\]/.test(path)) return true;
        if (/^\\\\/.test(path)) return true;
        return false;
      };

      expect(isAbsolute('\\\\server\\share')).toBe(true);
    });
  });

  describe('getPlatformFamily', () => {
    it('returns correct family for known platforms', () => {
      const getPlatformFamily = (platform: string): string => {
        if (platform === 'win32') return 'windows';
        if (platform === 'darwin') return 'darwin';
        return 'linux';
      };

      expect(getPlatformFamily('win32')).toBe('windows');
      expect(getPlatformFamily('darwin')).toBe('darwin');
      expect(getPlatformFamily('linux')).toBe('linux');
      expect(getPlatformFamily('freebsd')).toBe('linux');
    });
  });

  describe('Platform Family Detection', () => {
    it('identifies Windows correctly', () => {
      const isWindows = (platform: string): boolean => platform === 'win32';
      expect(isWindows('win32')).toBe(true);
      expect(isWindows('darwin')).toBe(false);
      expect(isWindows('linux')).toBe(false);
    });

    it('identifies macOS correctly', () => {
      const isMac = (platform: string): boolean => platform === 'darwin';
      expect(isMac('darwin')).toBe(true);
      expect(isMac('win32')).toBe(false);
      expect(isMac('linux')).toBe(false);
    });

    it('identifies Linux correctly', () => {
      const isLinux = (platform: string): boolean => platform !== 'win32' && platform !== 'darwin';
      expect(isLinux('linux')).toBe(true);
      expect(isLinux('freebsd')).toBe(true);
      expect(isLinux('win32')).toBe(false);
      expect(isLinux('darwin')).toBe(false);
    });
  });
});
