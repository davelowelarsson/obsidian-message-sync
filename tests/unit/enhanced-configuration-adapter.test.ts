import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedConfigurationAdapter } from '../../src/plugin/core/config/configuration-adapter';
import type { EnhancedPluginConfig } from '../../src/plugin/types';

// Mock Obsidian API
const mockApp = {
  vault: {
    adapter: {
      exists: vi.fn(),
      read: vi.fn(),
      write: vi.fn(),
    },
  },
};

const mockValidConfig: EnhancedPluginConfig = {
  global: {
    obsidian: {
      vaultPath: '/test/vault',
      notesFolder: 'message-sync',
      createFoldersIfMissing: true,
      templateEngine: 'simple',
    },
    sync: {
      enabled: true,
      defaultSchedule: 'manual',
      maxConcurrentSources: 5,
      retryAttempts: 3,
      retryDelay: 1000,
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
        service: 'slack',
        name: 'test-workspace',
        token: 'xoxp-test-token',
        channels: ['general', 'dev'],
        output: 'sync/slack/{{channel}}/{{month}}.md',
        schedule: 'manual',
        enabled: true,
      },
    ],
  },
  version: '1.0.0',
};

describe('EnhancedConfigurationAdapter', () => {
  let adapter: EnhancedConfigurationAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Loading from Different Path Types', () => {
    it('should load configuration from absolute path', async () => {
      const absolutePath = '/absolute/path/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, absolutePath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const config = await adapter.getConfig();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith(absolutePath);
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith(absolutePath);
      expect(config).toEqual(mockValidConfig);
    });

    it('should load configuration from obsidian config directory', async () => {
      const obsidianPath = '.obsidian/plugins/test/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, obsidianPath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const config = await adapter.getConfig();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith(obsidianPath);
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith(obsidianPath);
      expect(config).toEqual(mockValidConfig);
    });

    it('should load configuration from relative path', async () => {
      const relativePath = 'config/message-sync.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, relativePath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const config = await adapter.getConfig();

      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith(relativePath);
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith(relativePath);
      expect(config).toEqual(mockValidConfig);
    });

    it('should handle YAML configuration format', async () => {
      const yamlPath = 'config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, yamlPath);

      const yamlContent = `
global:
  obsidian:
    vaultPath: "/test/vault"
    notesFolder: "message-sync"
    createFoldersIfMissing: true
    templateEngine: "simple"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "development"
sources:
  slack:
    - service: "slack"
      name: "yaml-workspace"
      token: "xoxp-yaml-token"
      channels: ["general", "random"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(yamlContent);

      const config = await adapter.getConfig();

      expect(config).toBeDefined();
      expect(config?.sources.slack).toHaveLength(1);
      expect(config?.sources.slack[0]?.name).toBe('yaml-workspace');
      expect(config?.sources.slack[0]?.token).toBe('xoxp-yaml-token');
      expect(config?.sources.slack[0]?.channels).toEqual(['general', 'random']);
    });

    it('should fallback to JSON when YAML parsing fails', async () => {
      const jsonPath = 'config.json';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, jsonPath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const config = await adapter.getConfig();

      expect(config).toEqual(mockValidConfig);
    });

    it('should return null when configuration file does not exist', async () => {
      const nonExistentPath = 'nonexistent/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, nonExistentPath);

      mockApp.vault.adapter.exists.mockResolvedValue(false);

      const config = await adapter.getConfig();

      expect(config).toBeNull();
      expect(mockApp.vault.adapter.read).not.toHaveBeenCalled();
    });

    it('should handle file access errors gracefully', async () => {
      const errorPath = 'error/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, errorPath);

      mockApp.vault.adapter.exists.mockRejectedValue(new Error('Access denied'));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration with valid slack sources', async () => {
      const validPath = 'valid-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, validPath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const config = await adapter.getConfig();

      expect(config).toBeDefined();
      expect(config?.sources.slack).toHaveLength(1);
      expect(config?.sources.slack[0]?.enabled).toBe(true);
    });

    it('should reject configuration with no slack sources', async () => {
      const invalidPath = 'invalid-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, invalidPath);

      const invalidConfig = {
        ...mockValidConfig,
        sources: {
          ...mockValidConfig.sources,
          slack: [],
        },
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(invalidConfig));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should reject configuration with invalid slack source (missing token)', async () => {
      const invalidPath = 'invalid-token-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, invalidPath);

      const invalidConfig = {
        ...mockValidConfig,
        sources: {
          ...mockValidConfig.sources,
          slack: [
            {
              ...mockValidConfig.sources.slack[0],
              token: '',
            },
          ],
        },
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(invalidConfig));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should reject configuration with invalid slack source (missing channels)', async () => {
      const invalidPath = 'invalid-channels-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, invalidPath);

      const invalidConfig = {
        ...mockValidConfig,
        sources: {
          ...mockValidConfig.sources,
          slack: [
            {
              ...mockValidConfig.sources.slack[0],
              channels: [],
            },
          ],
        },
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(invalidConfig));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should handle parsing errors gracefully', async () => {
      const malformedPath = 'malformed-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, malformedPath);

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue('invalid: yaml: [content');

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to absolute path', async () => {
      const absolutePath = '/absolute/save/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, absolutePath);

      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await adapter.saveConfig(mockValidConfig);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        absolutePath,
        JSON.stringify(mockValidConfig, null, 2)
      );
    });

    it('should save configuration to obsidian config directory', async () => {
      const obsidianPath = '.obsidian/plugins/test/save-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, obsidianPath);

      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await adapter.saveConfig(mockValidConfig);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        obsidianPath,
        JSON.stringify(mockValidConfig, null, 2)
      );
    });

    it('should save configuration to relative path', async () => {
      const relativePath = 'configs/message-sync.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, relativePath);

      mockApp.vault.adapter.write.mockResolvedValue(undefined);

      await adapter.saveConfig(mockValidConfig);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        relativePath,
        JSON.stringify(mockValidConfig, null, 2)
      );
    });

    it('should reject saving invalid configuration', async () => {
      const savePath = 'invalid-save-config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, savePath);

      const invalidConfig = {
        ...mockValidConfig,
        sources: {
          ...mockValidConfig.sources,
          slack: [],
        },
      };

      await expect(adapter.saveConfig(invalidConfig)).rejects.toThrow(
        'Configuration validation failed'
      );

      expect(mockApp.vault.adapter.write).not.toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const errorPath = 'readonly/config.yaml';
      adapter = new EnhancedConfigurationAdapter(mockApp as any, errorPath);

      mockApp.vault.adapter.write.mockRejectedValue(new Error('Write permission denied'));

      await expect(adapter.saveConfig(mockValidConfig)).rejects.toThrow('Write permission denied');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      adapter = new EnhancedConfigurationAdapter(mockApp as any, 'test-config.yaml');
    });

    it('should get enabled slack sources', () => {
      const baseSlackConfig = mockValidConfig.sources.slack[0];
      if (!baseSlackConfig) {
        throw new Error('Base slack config not found');
      }

      const configWithMultipleSlack = {
        ...mockValidConfig,
        sources: {
          ...mockValidConfig.sources,
          slack: [
            baseSlackConfig,
            {
              ...baseSlackConfig,
              name: 'disabled-workspace',
              enabled: false,
            },
          ],
        },
      };

      const enabledSources = adapter.getEnabledSlackSources(configWithMultipleSlack);

      expect(enabledSources).toHaveLength(1);
      expect(enabledSources[0]?.name).toBe('test-workspace');
      expect(enabledSources[0]?.enabled).toBe(true);
    });

    it('should get output configuration', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const outputConfig = await adapter.getOutputConfig();

      expect(outputConfig).toEqual(mockValidConfig.global.obsidian);
    });

    it('should get configured channels', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      const channels = await adapter.getConfiguredChannels();

      expect(channels).toEqual(mockValidConfig.sources.slack);
    });

    it('should check if configuration exists', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);

      const exists = await adapter.configExists();

      expect(exists).toBe(true);
      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith('test-config.yaml');
    });

    it('should update configuration path', () => {
      const newPath = 'new/path/config.yaml';

      adapter.updateConfigPath(newPath);

      expect(adapter.getConfigPath()).toBe(newPath);
    });

    it('should clear cache', async () => {
      // First load config to populate cache
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockValidConfig));

      await adapter.getConfig();

      // Clear cache
      adapter.clearCache();

      // Second call should hit the file system again
      await adapter.getConfig();

      expect(mockApp.vault.adapter.read).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      adapter = new EnhancedConfigurationAdapter(mockApp as any, 'error-test.yaml');
    });

    it('should handle network failures during config loading', async () => {
      mockApp.vault.adapter.exists.mockRejectedValue(new Error('Network timeout'));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should handle corrupted JSON files', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue('{ invalid json }');

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should handle empty configuration files', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue('');

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });

    it('should handle configuration with missing required fields', async () => {
      const incompleteConfig = {
        global: {
          sync: {
            enabled: true,
          },
        },
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(incompleteConfig));

      const config = await adapter.getConfig();

      expect(config).toBeNull();
    });
  });
});
