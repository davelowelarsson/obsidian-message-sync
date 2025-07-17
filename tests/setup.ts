import type { App, Vault } from 'obsidian';
import { beforeEach, vi } from 'vitest';

/**
 * Mock Obsidian App for testing
 */
export function createMockApp(): App {
  return {
    vault: createMockVault(),
    workspace: {
      getActiveFile: vi.fn(),
    },
  } as any;
}

/**
 * Mock Obsidian Vault for testing
 */
export function createMockVault(): Vault {
  const files = new Map<string, string>();

  return {
    adapter: {
      exists: vi.fn((path: string) => Promise.resolve(files.has(path))),
      read: vi.fn((path: string) => Promise.resolve(files.get(path) || '')),
      write: vi.fn((path: string, content: string) => {
        files.set(path, content);
        return Promise.resolve();
      }),
    },
    getAbstractFileByPath: vi.fn((path: string) => {
      if (files.has(path)) {
        return {
          path,
          name: path.split('/').pop(),
        };
      }
      return null;
    }),
    create: vi.fn((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve({
        path,
        name: path.split('/').pop(),
      });
    }),
    modify: vi.fn((file: any, content: string) => {
      files.set(file.path, content);
      return Promise.resolve();
    }),
    read: vi.fn((file: any) => Promise.resolve(files.get(file.path) || '')),
    createFolder: vi.fn((_path: string) => Promise.resolve()),
  } as any;
}

/**
 * Mock Slack user for testing
 */
export function createMockSlackUser(overrides: Partial<any> = {}): any {
  return {
    id: 'U123456789',
    name: 'testuser',
    real_name: 'Test User',
    display_name: 'Test User',
    profile: {
      email: 'test@example.com',
      image_72: 'https://example.com/avatar.jpg',
    },
    ...overrides,
  };
}

/**
 * Mock Slack channel for testing
 */
export function createMockSlackChannel(overrides: Partial<any> = {}): any {
  return {
    id: 'C123456789',
    name: 'general',
    is_channel: true,
    is_private: false,
    is_archived: false,
    is_member: true,
    topic: {
      value: 'General discussion',
    },
    purpose: {
      value: 'Company-wide announcements and general discussion',
    },
    ...overrides,
  };
}

/**
 * Mock Slack message for testing
 */
export function createMockSlackMessage(overrides: Partial<any> = {}): any {
  return {
    type: 'message',
    ts: '1234567890.123456',
    user: 'U123456789',
    text: 'Hello, world!',
    channel: 'C123456789',
    attachments: [],
    files: [],
    reactions: [],
    thread_ts: undefined,
    reply_count: 0,
    replies: [],
    ...overrides,
  };
}

/**
 * Mock enhanced plugin config for testing
 */
export function createMockEnhancedConfig(overrides: Partial<any> = {}): any {
  return {
    version: '1.0',
    global: {
      obsidian: {
        vaultPath: '',
        notesFolder: 'message-sync',
        createFoldersIfMissing: true,
        templateEngine: 'simple',
      },
      sync: {
        enabled: true,
        maxConcurrentSources: 3,
        retryAttempts: 3,
        retryDelay: 5000,
      },
      logging: {
        level: 'info',
        enableColors: true,
        timestampFormat: 'YYYY-MM-DD HH:mm:ss',
      },
    },
    sources: {
      slack: [
        {
          name: 'Test Slack',
          token: 'xoxb-test-token',
          channels: ['C123456789'],
          enabled: true,
        },
      ],
    },
    ...overrides,
  };
}

/**
 * Mock message sync settings for testing
 */
export function createMockMessageSyncSettings(overrides: Partial<any> = {}): any {
  return {
    configPath: 'message-sync-config.json',
    autoSync: false,
    syncInterval: 300000,
    maxMessages: 1000,
    ...overrides,
  };
}

/**
 * Setup common mocks for tests
 */
export function setupCommonMocks() {
  // Mock console methods to avoid test noise
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

/**
 * Global test setup
 */
beforeEach(() => {
  vi.clearAllMocks();
  setupCommonMocks();
});
