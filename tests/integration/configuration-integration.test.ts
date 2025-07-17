import { TFile } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationManager } from '../../src/plugin/config/configuration-manager';
import { EnhancedConfigurationAdapter } from '../../src/plugin/core/config/configuration-adapter';
import type { EnhancedPluginConfig, MessageSyncSettings } from '../../src/plugin/types';

// Mock file system for integration testing
const mockFileSystem = new Map<string, string>();

// Mock Obsidian App
const mockApp = {
  vault: {
    configDir: '/test/vault/.obsidian',
    adapter: {
      exists: vi.fn((path: string) => {
        return Promise.resolve(mockFileSystem.has(path));
      }),
      read: vi.fn((path: string) => {
        const content = mockFileSystem.get(path);
        if (content === undefined) {
          return Promise.reject(new Error(`File not found: ${path}`));
        }
        return Promise.resolve(content);
      }),
      write: vi.fn((path: string, content: string) => {
        mockFileSystem.set(path, content);
        return Promise.resolve();
      }),
      getName: vi.fn(() => '/test/vault'),
    },
    getAbstractFileByPath: vi.fn((path: string) => {
      if (mockFileSystem.has(path)) {
        return new TFile();
      }
      return null;
    }),
    read: vi.fn((_file: TFile) => {
      // For TFile objects, we need to mock the path
      const content = Array.from(mockFileSystem.values())[0]; // Get first file content
      return Promise.resolve(content || '');
    }),
    createFolder: vi.fn(),
  },
};

describe('Configuration Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileSystem.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Absolute Path Configuration', () => {
    it('should load, modify, and save configuration from absolute path', async () => {
      const absolutePath = '/absolute/path/config.yaml';
      const initialYaml = `
global:
  obsidian:
    vaultPath: "/test/vault"
    notesFolder: "sync"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "development"
sources:
  slack:
    - service: slack
      name: "initial-workspace"
      token: "xoxp-initial-token"
      channels: ["general"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      // Set up initial file
      mockFileSystem.set(absolutePath, initialYaml);

      const settings: MessageSyncSettings = {
        configPath: absolutePath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Load configuration
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(1);
      expect(loadedSettings.slackConfigs[0]?.name).toBe('initial-workspace');

      // Modify configuration
      const modifiedSettings = {
        ...loadedSettings,
        slackConfigs: [
          ...loadedSettings.slackConfigs,
          {
            id: 'new-workspace',
            name: 'new-workspace',
            token: 'xoxp-new-token',
            channels: ['dev', 'random'],
            output: 'sync/slack/{{channel}}/{{month}}.md',
            schedule: 'manual' as const,
            enabled: true,
            lastSync: null,
          },
        ],
      };

      // Save modified configuration
      await configManager.saveSettings(modifiedSettings);

      // Verify the file was updated
      const savedContent = mockFileSystem.get(absolutePath);
      expect(savedContent).toBeDefined();
      expect(savedContent).toContain('new-workspace');
      expect(savedContent).toContain('xoxp-new-token');

      // Load again to verify persistence
      const reloadedSettings = await configManager.loadSettings();
      expect(reloadedSettings.slackConfigs).toHaveLength(2);
      expect(reloadedSettings.slackConfigs[1]?.name).toBe('new-workspace');
    });

    it('should handle absolute path configuration validation', async () => {
      const absolutePath = '/validation/test/config.yaml';
      const invalidYaml = `
global:
  obsidian:
    vaultPath: "/test/vault"
    notesFolder: ""
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "development"
sources:
  slack: []
  signal: []
  teams: []
  telegram: []
`;

      mockFileSystem.set(absolutePath, invalidYaml);

      const settings: MessageSyncSettings = {
        configPath: absolutePath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);
      const loadedSettings = await configManager.loadSettings();

      // Should fallback to default settings when validation fails
      expect(loadedSettings.slackConfigs).toHaveLength(0);
    });
  });

  describe('Obsidian Config Directory Configuration', () => {
    it('should load, modify, and save configuration from obsidian config directory', async () => {
      const obsidianPath = '.obsidian/plugins/message-sync/config.yaml';
      const initialYaml = `
global:
  obsidian:
    vaultPath: "/obsidian/vault"
    notesFolder: "message-sync"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "debug"
  environment:
    nodeEnv: "development"
sources:
  slack:
    - service: slack
      name: "obsidian-workspace"
      token: "xoxp-obsidian-token"
      channels: ["general", "dev"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      mockFileSystem.set(obsidianPath, initialYaml);

      const settings: MessageSyncSettings = {
        configPath: obsidianPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Load configuration
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(1);
      expect(loadedSettings.slackConfigs[0]?.name).toBe('obsidian-workspace');
      expect(loadedSettings.debugMode).toBe(true); // Should be true from debug level

      // Modify configuration
      const modifiedSettings = {
        ...loadedSettings,
        autoSync: true,
        syncInterval: 30,
      };

      // Save modified configuration
      await configManager.saveSettings(modifiedSettings);

      // Verify the file was updated
      const savedContent = mockFileSystem.get(obsidianPath);
      expect(savedContent).toBeDefined();
      expect(savedContent).toContain('"enabled": true');
    });

    it('should handle concurrent access to obsidian config directory', async () => {
      const obsidianPath = '.obsidian/plugins/message-sync/concurrent-config.yaml';
      const initialYaml = `
global:
  obsidian:
    vaultPath: "/concurrent/vault"
    notesFolder: "sync"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "development"
sources:
  slack:
    - service: slack
      name: "concurrent-workspace"
      token: "xoxp-concurrent-token"
      channels: ["general"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      mockFileSystem.set(obsidianPath, initialYaml);

      const settings: MessageSyncSettings = {
        configPath: obsidianPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      // Create multiple config managers to simulate concurrent access
      const configManager1 = new ConfigurationManager(mockApp as any, settings);
      const configManager2 = new ConfigurationManager(mockApp as any, settings);

      // Load from both managers concurrently
      const [loadedSettings1, loadedSettings2] = await Promise.all([
        configManager1.loadSettings(),
        configManager2.loadSettings(),
      ]);

      expect(loadedSettings1.slackConfigs).toHaveLength(1);
      expect(loadedSettings2.slackConfigs).toHaveLength(1);
      expect(loadedSettings1.slackConfigs[0]?.name).toBe('concurrent-workspace');
      expect(loadedSettings2.slackConfigs[0]?.name).toBe('concurrent-workspace');
    });
  });

  describe('Relative Path Configuration', () => {
    it('should load, modify, and save configuration from relative path', async () => {
      const relativePath = '/test/vault/.obsidian/plugins/obsidian-message-sync-dev/config.yaml';
      const initialYaml = `
global:
  obsidian:
    vaultPath: "/relative/vault"
    notesFolder: "sync"
  sync:
    enabled: false
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "production"
sources:
  slack:
    - service: slack
      name: "relative-workspace"
      token: "xoxp-relative-token"
      channels: ["general", "dev", "random"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      mockFileSystem.set(relativePath, initialYaml);

      const settings: MessageSyncSettings = {
        configPath: 'config.yaml',
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Load configuration
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(1);
      expect(loadedSettings.slackConfigs[0]?.name).toBe('relative-workspace');
      expect(loadedSettings.slackConfigs[0]?.channels).toHaveLength(3);
      expect(loadedSettings.autoSync).toBe(false);

      // Modify configuration
      const modifiedSettings = {
        ...loadedSettings,
        slackConfigs: [
          {
            ...loadedSettings.slackConfigs[0],
            channels: ['general', 'dev'], // Remove 'random' channel
          },
        ],
      } as MessageSyncSettings;

      // Save modified configuration
      await configManager.saveSettings(modifiedSettings);

      // Verify the file was updated
      const savedContent = mockFileSystem.get(relativePath);
      expect(savedContent).toBeDefined();
      expect(savedContent).toContain('relative-workspace');
      expect(savedContent).not.toContain('random');
    });
  });

  describe('Cross-Component Integration', () => {
    it('should work with both ConfigurationManager and EnhancedConfigurationAdapter', async () => {
      const configPath = '/integration/test/config.yaml';
      const initialConfig: EnhancedPluginConfig = {
        version: '1.0.0',
        global: {
          obsidian: {
            vaultPath: '/integration/vault',
            notesFolder: 'message-sync',
            createFoldersIfMissing: true,
            templateEngine: 'simple',
          },
          sync: {
            enabled: true,
            defaultSchedule: 'manual',
            maxConcurrentSources: 3,
            retryAttempts: 3,
            retryDelay: 1000,
          },
          logging: {
            level: 'info',
            enableColors: true,
            timestampFormat: 'ISO',
          },
        },
        sources: {
          slack: [
            {
              service: 'slack',
              name: 'integration-workspace',
              token: 'xoxp-integration-token',
              channels: ['general', 'dev'],
              output: 'sync/slack/{{channel}}/{{month}}.md',
              schedule: 'manual',
              enabled: true,
            },
          ],
        },
      };

      mockFileSystem.set(configPath, JSON.stringify(initialConfig));

      // Test with EnhancedConfigurationAdapter
      const adapter = new EnhancedConfigurationAdapter(mockApp as any, configPath);
      const loadedConfig = await adapter.getConfig();

      expect(loadedConfig).toBeDefined();
      expect(loadedConfig?.sources.slack).toHaveLength(1);
      expect(loadedConfig?.sources.slack[0]?.name).toBe('integration-workspace');

      // Test with ConfigurationManager
      const settings: MessageSyncSettings = {
        configPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(1);
      expect(loadedSettings.slackConfigs[0]?.name).toBe('integration-workspace');
    });

    it('should handle configuration format conversion between components', async () => {
      const yamlPath = '/format/conversion/config.yaml';
      const yamlContent = `
global:
  obsidian:
    vaultPath: "/format/vault"
    notesFolder: "sync"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "debug"
  environment:
    nodeEnv: "development"
sources:
  slack:
    - service: slack
      name: "format-workspace"
      token: "xoxp-format-token"
      channels: ["general"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      mockFileSystem.set(yamlPath, yamlContent);

      const settings: MessageSyncSettings = {
        configPath: yamlPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Load YAML with ConfigurationManager
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(1);
      expect(loadedSettings.slackConfigs[0]?.name).toBe('format-workspace');
      expect(loadedSettings.debugMode).toBe(true);

      // Save back to YAML
      await configManager.saveSettings(loadedSettings);

      // Verify the format is preserved
      const savedContent = mockFileSystem.get(yamlPath);
      expect(savedContent).toBeDefined();
      expect(savedContent).toContain('"global"');
      expect(savedContent).toContain('"sources"');
      expect(savedContent).toContain('format-workspace');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from corrupted configuration files', async () => {
      const corruptedPath = '/error/recovery/corrupted.yaml';
      const corruptedContent = 'invalid: yaml: content: [[[';

      mockFileSystem.set(corruptedPath, corruptedContent);

      const settings: MessageSyncSettings = {
        configPath: corruptedPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Should fallback to default settings
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(0);
      expect(loadedSettings.configPath).toBe(corruptedPath);
    });

    it('should handle file system permission errors gracefully', async () => {
      const restrictedPath = '/restricted/path/config.yaml';

      // Mock permission error
      mockApp.vault.adapter.read.mockRejectedValue(new Error('Permission denied'));

      const settings: MessageSyncSettings = {
        configPath: restrictedPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Should handle error gracefully and return default settings
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(0);
      expect(loadedSettings.configPath).toBe(restrictedPath);
    });

    it('should handle network timeouts during configuration loading', async () => {
      const networkPath = '/network/timeout/config.yaml';

      // Mock network timeout
      mockApp.vault.adapter.exists.mockRejectedValue(new Error('Network timeout'));

      const settings: MessageSyncSettings = {
        configPath: networkPath,
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily',
        slackConfigs: [],
      };

      const configManager = new ConfigurationManager(mockApp as any, settings);

      // Should handle timeout gracefully
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.slackConfigs).toHaveLength(0);
      expect(loadedSettings.configPath).toBe(networkPath);
    });
  });
});
