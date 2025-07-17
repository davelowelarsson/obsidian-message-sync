/**
 * Unit tests for File Download Service
 *
 * Tests the file download functionality that ensures:
 * - CORS issues are avoided by using Obsidian's requestUrl
 * - Binary files are downloaded correctly (not as HTML)
 * - Token validation works properly
 * - File paths are generated correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadService } from '../../src/plugin/core/services/file-download-service';
import type { SlackFile } from '../../src/types/slack';

// Mock the obsidian module
vi.mock('obsidian', () => ({
  requestUrl: vi.fn(),
  normalizePath: (path: string) => path.replace(/\\/g, '/'),
}));

// Import the mocked requestUrl
import { requestUrl } from 'obsidian';

const mockRequestUrl = vi.mocked(requestUrl);

// Mock App interface
const mockApp = {
  vault: {
    adapter: {
      exists: vi.fn(),
      write: vi.fn(),
      writeBinary: vi.fn(),
      mkdir: vi.fn(),
    },
    createFolder: vi.fn(),
    createBinary: vi.fn(),
  },
} as any;

const defaultOptions = {
  outputDir: 'test-output',
  assetsDir: 'assets',
  downloadFiles: true,
};

describe('FileDownloadService', () => {
  let fileDownloadService: FileDownloadService;

  beforeEach(() => {
    vi.clearAllMocks();
    fileDownloadService = new FileDownloadService(mockApp, 'xoxp-test-user-token', defaultOptions);
  });

  describe('token validation', () => {
    it('should reject bot tokens for file downloads', async () => {
      const botTokenService = new FileDownloadService(
        mockApp,
        'xoxb-test-bot-token',
        defaultOptions
      );

      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      const result = await botTokenService.downloadFile(file, 'test-channel/2025-07-16');

      expect(result).toBeNull();
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    it('should accept user tokens for file downloads', async () => {
      const userTokenService = new FileDownloadService(
        mockApp,
        'xoxp-test-user-token',
        defaultOptions
      );

      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock successful binary download
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: mockArrayBuffer,
        text: 'binary data',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.writeBinary.mockResolvedValue(undefined);

      const result = await userTokenService.downloadFile(file, 'test-channel/2025-07-16');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        method: 'GET',
        headers: {
          Authorization: 'Bearer xoxp-test-user-token',
        },
      });

      expect(result).toBeTruthy();
      expect(result?.wasDownloaded).toBe(true);
    });
  });

  describe('HTML response detection', () => {
    it('should detect HTML responses and return null', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock HTML response
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: new ArrayBuffer(0),
        text: '<!DOCTYPE html><html><head><title>Error</title></head><body>Access denied</body></html>',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      const result = await fileDownloadService.downloadFile(file, 'test-channel/2025-07-16');

      expect(result).toBeNull();
    });

    it('should handle successful binary downloads', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock successful binary download
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: mockArrayBuffer,
        text: 'binary data (not HTML)',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.writeBinary.mockResolvedValue(undefined);

      const result = await fileDownloadService.downloadFile(file, 'dm-davidlowelarsson/2025-07-13');

      expect(result).toBeTruthy();
      expect(result?.wasDownloaded).toBe(true);
      expect(result?.downloadedSize).toBe(1024);
    });
  });

  describe('file path generation', () => {
    it('should generate correct file paths for assets', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'Screenshot_20250712-151251.png',
        title: 'Screenshot_20250712-151251.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/screenshot.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock successful binary download
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: mockArrayBuffer,
        text: 'binary data',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.writeBinary.mockResolvedValue(undefined);

      const result = await fileDownloadService.downloadFile(file, 'dm-davidlowelarsson/2025-07-13');

      expect(result).toBeTruthy();
      expect(result?.localPath).toContain('slack/dm-davidlowelarsson/assets');
      expect(result?.localPath).toContain('F095LPT07RA_Screenshot_20250712-151251.png');
    });

    it('should handle existing files by skipping download', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock file already exists
      mockApp.vault.adapter.exists.mockResolvedValue(true);

      const result = await fileDownloadService.downloadFile(file, 'test-channel/2025-07-16');

      expect(result).toBeTruthy();
      expect(result?.wasDownloaded).toBe(false);
      expect(result?.downloadedSize).toBe(0);
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });
  });

  describe('requestUrl usage', () => {
    it('should use requestUrl to avoid CORS issues', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock successful binary download
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: mockArrayBuffer,
        text: 'binary data',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.writeBinary.mockResolvedValue(undefined);

      await fileDownloadService.downloadFile(file, 'test-channel/2025-07-16');

      // Verify requestUrl was called with correct parameters
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        method: 'GET',
        headers: {
          Authorization: 'Bearer xoxp-test-user-token',
        },
      });
    });
  });

  describe('file validation', () => {
    it('should reject files without download URLs', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: '', // No URL
        mimetype: 'image/png',
        size: 1024,
      };

      const result = await fileDownloadService.downloadFile(file, 'test-channel/2025-07-16');

      expect(result).toBeNull();
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });
  });

  describe('path structure preservation', () => {
    it('should create correct nested directory structure', async () => {
      const file: SlackFile = {
        id: 'F095LPT07RA',
        name: 'test.png',
        title: 'test.png',
        url_private: 'https://files.slack.com/files-pri/T033GL7M4-F095LPT07RA/test.png',
        mimetype: 'image/png',
        size: 1024,
      };

      // Mock successful binary download
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockRequestUrl.mockResolvedValue({
        arrayBuffer: mockArrayBuffer,
        text: 'binary data',
        status: 200,
        headers: {},
        json: async () => ({}),
      });

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.writeBinary.mockResolvedValue(undefined);

      const result = await fileDownloadService.downloadFile(file, 'dm-davidlowelarsson/2025-07-13');

      expect(result).toBeTruthy();

      // Verify the path structure matches our expected tree:
      // slack/dm-davidlowelarsson/assets/F095LPT07RA_test.png
      const pathParts = result?.localPath.split('/');
      expect(pathParts).toContain('slack');
      expect(pathParts).toContain('dm-davidlowelarsson');
      expect(pathParts).toContain('assets');
      expect(pathParts?.[pathParts.length - 1]).toContain('F095LPT07RA_test.png');
    });
  });
});
