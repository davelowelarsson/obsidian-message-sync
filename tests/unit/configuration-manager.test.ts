import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationManager } from '../../src/plugin/config/configuration-manager';
import type { MessageSyncSettings, YamlConfig } from '../../src/plugin/types';

// Mock Obsidian API
const mockApp = {
  vault: {
    configDir: '/mock/vault/.obsidian',
    adapter: {
      exists: vi.fn(),
      read: vi.fn(),
      write: vi.fn(),
      getName: vi.fn(() => '/mock/vault'),
    },
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    createFolder: vi.fn(),
  },
};

const mockSettings: MessageSyncSettings = {
  configPath: 'config.yaml',
  autoSync: false,
  syncInterval: 60,
  outputFolder: 'sync',
  showNotifications: true,
  debugMode: false,
  organization: 'daily',
  slackConfigs: [],
};

const mockYamlConfig: YamlConfig = {
  global: {
    obsidian: {
      vaultPath: '/mock/vault',
      notesFolder: 'sync',
    },
    sync: {
      enabled: true,
      defaultSchedule: 'manual',
    },
    logging: {
      level: 'info',
    },
    environment: {
      nodeEnv: 'development',
    },
  },
  sources: {
    slack: [
      {
        service: 'slack',
        name: 'primary-slack',
        token: 'xoxp-test-token',
        channels: ['general', 'dev'],
        output: 'sync/slack/{{channel}}/{{month}}.md',
        schedule: 'manual',
        enabled: true,
      },
    ],
    signal: [],
    teams: [],
    telegram: [],
  },
};

describe('ConfigurationManager', () => {
  // let configManager: ConfigurationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // configManager = new ConfigurationManager(mockApp as any, mockSettings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Path Resolution', () => {
    it('should resolve absolute paths correctly', () => {
      const settings = { ...mockSettings, configPath: '/absolute/path/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      // Access private method for testing
      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('/absolute/path/config.yaml');

      expect(result).toBe('/absolute/path/config.yaml');
    });

    it('should resolve obsidian config directory paths correctly', () => {
      const settings = { ...mockSettings, configPath: '.obsidian/plugins/test/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('.obsidian/plugins/test/config.yaml');

      expect(result).toBe('.obsidian/plugins/test/config.yaml');
    });

    it('should resolve plugin-relative paths correctly', () => {
      const settings = { ...mockSettings, configPath: 'config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('config.yaml');

      expect(result).toBe('/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/config.yaml');
    });

    it('should resolve vault-relative paths correctly', () => {
      const settings = { ...mockSettings, configPath: 'notes/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('notes/config.yaml');

      expect(result).toBe(
        '/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/notes/config.yaml'
      );
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration from absolute path', async () => {
      const settings = { ...mockSettings, configPath: '/absolute/path/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(`
global:
  obsidian:
    vaultPath: "/absolute/vault"
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
      name: "absolute-slack"
      token: "xoxp-absolute-token"
      channels: ["general"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`);

      const result = await manager.loadSettings();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith('/absolute/path/config.yaml');
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('/absolute/path/config.yaml');
      expect(result.slackConfigs).toHaveLength(1);
      expect(result.slackConfigs[0]?.name).toBe('absolute-slack');
    });

    it('should load configuration from obsidian config directory', async () => {
      const settings = { ...mockSettings, configPath: '.obsidian/plugins/test/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(`
global:
  obsidian:
    vaultPath: "/obsidian/vault"
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
      name: "obsidian-slack"
      token: "xoxp-obsidian-token"
      channels: ["general", "dev"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`);

      const result = await manager.loadSettings();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith(
        '.obsidian/plugins/test/config.yaml'
      );
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('.obsidian/plugins/test/config.yaml');
      expect(result.slackConfigs).toHaveLength(1);
      expect(result.slackConfigs[0]?.name).toBe('obsidian-slack');
    });

    it('should load configuration from vault-relative path', async () => {
      const settings = { ...mockSettings, configPath: 'config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(`
global:
  obsidian:
    vaultPath: "/vault/path"
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
      name: "vault-slack"
      token: "xoxp-vault-token"
      channels: ["general"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`);

      const result = await manager.loadSettings();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith(
        '/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/config.yaml'
      );
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith(
        '/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/config.yaml'
      );
      expect(result.slackConfigs).toHaveLength(1);
      expect(result.slackConfigs[0]?.name).toBe('vault-slack');
    });

    it('should handle missing config file gracefully', async () => {
      const settings = { ...mockSettings, configPath: 'missing.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = await manager.loadSettings();

      expect(result.slackConfigs).toHaveLength(0);
      expect(result.configPath).toBe('missing.yaml');
    });

    it('should handle invalid YAML gracefully', async () => {
      const settings = { ...mockSettings, configPath: '.obsidian/plugins/test/invalid.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue('invalid: yaml: content: [');

      const result = await manager.loadSettings();

      expect(result.slackConfigs).toHaveLength(0);
      expect(result.configPath).toBe('.obsidian/plugins/test/invalid.yaml');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const validateConfig = (manager as any).validateConfig.bind(manager);

      const errors = validateConfig(mockYamlConfig);

      expect(errors).toHaveLength(0);
    });

    it('should validate configuration with missing global settings', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const validateConfig = (manager as any).validateConfig.bind(manager);

      const invalidConfig = {
        ...mockYamlConfig,
        global: {
          ...mockYamlConfig.global,
          obsidian: {
            ...mockYamlConfig.global.obsidian,
            notesFolder: '',
          },
        },
      };

      const errors = validateConfig(invalidConfig);

      expect(errors).toContain('Missing notes folder in global configuration');
    });

    it('should validate configuration with missing slack settings', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const validateConfig = (manager as any).validateConfig.bind(manager);

      const invalidConfig = {
        ...mockYamlConfig,
        sources: {
          ...mockYamlConfig.sources,
          slack: [
            {
              ...mockYamlConfig.sources.slack[0],
              token: '',
              channels: [],
            },
          ],
        },
      };

      const errors = validateConfig(invalidConfig);

      expect(errors).toContain('Slack config 0: Missing token');
      expect(errors).toContain('Slack config 0: Missing channels');
    });

    it('should validate configuration with no slack sources', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const validateConfig = (manager as any).validateConfig.bind(manager);

      const invalidConfig = {
        ...mockYamlConfig,
        sources: {
          ...mockYamlConfig.sources,
          slack: [],
        },
      };

      const errors = validateConfig(invalidConfig);

      expect(errors).toContain('No Slack sources configured');
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to absolute path', async () => {
      const settings = { ...mockSettings, configPath: '/absolute/path/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await manager.saveSettings(mockSettings);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '/absolute/path/config.yaml',
        expect.stringContaining('"global"')
      );
    });

    it('should save configuration to obsidian config directory', async () => {
      const settings = { ...mockSettings, configPath: '.obsidian/plugins/test/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await manager.saveSettings(mockSettings);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '.obsidian/plugins/test/config.yaml',
        expect.stringContaining('"global"')
      );
    });

    it('should save configuration with slack configs', async () => {
      const settings = {
        ...mockSettings,
        configPath: 'config.yaml',
        slackConfigs: [
          {
            id: 'test-slack',
            name: 'test-slack',
            token: 'xoxp-test-token',
            channels: ['general', 'dev'],
            output: 'sync/slack/{{channel}}/{{month}}.md',
            schedule: 'manual' as const,
            enabled: true,
            lastSync: null,
          },
        ],
      };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await manager.saveSettings(settings);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/config.yaml',
        expect.stringContaining('test-slack')
      );
    });

    it('should handle save errors gracefully', async () => {
      const settings = { ...mockSettings, configPath: '/readonly/path/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.write.mockRejectedValue(new Error('Permission denied'));

      await expect(manager.saveSettings(mockSettings)).rejects.toThrow('Permission denied');
    });
  });

  describe('Settings Merging', () => {
    it('should merge YAML config into plugin settings correctly', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const mergeYamlIntoSettings = (manager as any).mergeYamlIntoSettings.bind(manager);

      const result = mergeYamlIntoSettings(mockSettings, mockYamlConfig);

      expect(result.slackConfigs).toHaveLength(1);
      expect(result.slackConfigs[0].name).toBe('primary-slack');
      expect(result.slackConfigs[0].token).toBe('xoxp-test-token');
      expect(result.slackConfigs[0].channels).toEqual(['general', 'dev']);
      expect(result.slackConfigs[0].enabled).toBe(true);
      expect(result.outputFolder).toBe('sync');
      expect(result.autoSync).toBe(true);
      expect(result.debugMode).toBe(false);
    });

    it('should handle empty slack sources in YAML', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const mergeYamlIntoSettings = (manager as any).mergeYamlIntoSettings.bind(manager);

      const emptyYamlConfig = {
        ...mockYamlConfig,
        sources: {
          ...mockYamlConfig.sources,
          slack: [],
        },
      };

      const result = mergeYamlIntoSettings(mockSettings, emptyYamlConfig);

      expect(result.slackConfigs).toHaveLength(0);
    });

    it('should handle multiple slack sources in YAML', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const mergeYamlIntoSettings = (manager as any).mergeYamlIntoSettings.bind(manager);

      const multiSlackConfig = {
        ...mockYamlConfig,
        sources: {
          ...mockYamlConfig.sources,
          slack: [
            mockYamlConfig.sources.slack[0],
            {
              service: 'slack',
              name: 'secondary-slack',
              token: 'xoxp-secondary-token',
              channels: ['random'],
              output: 'sync/slack/{{channel}}/{{month}}.md',
              schedule: 'manual',
              enabled: false,
            },
          ],
        },
      };

      const result = mergeYamlIntoSettings(mockSettings, multiSlackConfig);

      expect(result.slackConfigs).toHaveLength(2);
      expect(result.slackConfigs[0].name).toBe('primary-slack');
      expect(result.slackConfigs[1].name).toBe('secondary-slack');
      expect(result.slackConfigs[1].enabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed path strings', () => {
      const settings = { ...mockSettings, configPath: '' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('');

      expect(result).toBe('/mock/vault/.obsidian/plugins/obsidian-message-sync-dev/');
    });

    it('should handle paths with multiple slashes', () => {
      const settings = { ...mockSettings, configPath: '//absolute//path//config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      const resolveConfigPath = (manager as any).resolveConfigPath.bind(manager);
      const result = resolveConfigPath('//absolute//path//config.yaml');

      expect(result).toBe('//absolute//path//config.yaml');
    });

    it('should handle network adapter failures', async () => {
      const settings = { ...mockSettings, configPath: '.obsidian/plugins/test/config.yaml' };
      const manager = new ConfigurationManager(mockApp as any, settings);

      mockApp.vault.adapter.exists.mockRejectedValue(new Error('Network error'));

      const result = await manager.loadSettings();

      expect(result.slackConfigs).toHaveLength(0);
    });

    it('should handle debug mode settings correctly', () => {
      const manager = new ConfigurationManager(mockApp as any, mockSettings);
      const mergeYamlIntoSettings = (manager as any).mergeYamlIntoSettings.bind(manager);

      const debugConfig = {
        ...mockYamlConfig,
        global: {
          ...mockYamlConfig.global,
          logging: {
            level: 'debug',
          },
        },
      };

      const result = mergeYamlIntoSettings(mockSettings, debugConfig);

      expect(result.debugMode).toBe(true);
    });
  });
});
