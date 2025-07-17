import { beforeEach, describe, expect, it } from 'vitest';
import { EnhancedConfigurationAdapter } from '../../src/plugin/core/config/configuration-adapter';
import { createMockApp, createMockEnhancedConfig } from '../setup';

describe('EnhancedConfigurationAdapter', () => {
  let adapter: EnhancedConfigurationAdapter;
  let mockApp: any;
  let mockConfig: any;

  beforeEach(() => {
    mockApp = createMockApp();
    mockConfig = createMockEnhancedConfig();
    adapter = new EnhancedConfigurationAdapter(mockApp, 'test-config.json');
  });

  describe('Configuration Loading', () => {
    it('should load valid configuration', async () => {
      // Mock file exists and has valid content
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await adapter.getConfig();

      expect(result).toEqual(mockConfig);
      expect(mockApp.vault.adapter.exists).toHaveBeenCalledWith('test-config.json');
      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('test-config.json');
    });

    it('should return null when config file does not exist', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(false);

      const result = await adapter.getConfig();

      expect(result).toBeNull();
      expect(mockApp.vault.adapter.read).not.toHaveBeenCalled();
    });

    it('should return null for invalid JSON', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue('invalid json');

      const result = await adapter.getConfig();

      expect(result).toBeNull();
    });

    it('should return null for invalid configuration', async () => {
      const invalidConfig = {
        ...mockConfig,
        sources: {
          slack: [], // No slack sources
        },
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(invalidConfig));

      const result = await adapter.getConfig();

      expect(result).toBeNull();
    });

    it('should cache configuration after first load', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockConfig));

      const result1 = await adapter.getConfig();
      const result2 = await adapter.getConfig();

      expect(result1).toEqual(mockConfig);
      expect(result2).toEqual(mockConfig);
      expect(mockApp.vault.adapter.read).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Saving', () => {
    it('should save valid configuration', async () => {
      await adapter.saveConfig(mockConfig);

      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        'test-config.json',
        JSON.stringify(mockConfig, null, 2)
      );
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        ...mockConfig,
        sources: {
          slack: [], // No slack sources
        },
      };

      await expect(adapter.saveConfig(invalidConfig)).rejects.toThrow(
        'Configuration validation failed'
      );
    });

    it('should update cache after saving', async () => {
      await adapter.saveConfig(mockConfig);

      const result = await adapter.getConfig();
      expect(result).toEqual(mockConfig);
      expect(mockApp.vault.adapter.read).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration with required fields', async () => {
      const validConfig = {
        ...mockConfig,
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
      };

      mockApp.vault.adapter.exists.mockResolvedValue(true);
      mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(validConfig));

      // Should not throw
      await expect(adapter.saveConfig(validConfig)).resolves.not.toThrow();
    });

    it('should identify missing token', async () => {
      const configWithoutToken = {
        ...mockConfig,
        sources: {
          slack: [
            {
              name: 'Test Slack',
              channels: ['C123456789'],
              enabled: true,
            },
          ],
        },
      };

      await expect(adapter.saveConfig(configWithoutToken as any)).rejects.toThrow('Missing token');
    });

    it('should identify missing channels', async () => {
      const configWithoutChannels = {
        ...mockConfig,
        sources: {
          slack: [
            {
              name: 'Test Slack',
              token: 'xoxb-test-token',
              enabled: true,
            },
          ],
        },
      };

      await expect(adapter.saveConfig(configWithoutChannels as any)).rejects.toThrow(
        'Missing channels or channels array is empty'
      );
    });
  });

  describe('Helper Methods', () => {
    beforeEach(async () => {
      await adapter.saveConfig(mockConfig);
    });

    it('should get enabled Slack sources', () => {
      const enabledSources = adapter.getEnabledSlackSources(mockConfig);

      expect(enabledSources).toHaveLength(1);
      expect(enabledSources[0]).toEqual(mockConfig.sources.slack[0]);
    });

    it('should filter disabled sources', () => {
      const configWithDisabledSource = {
        ...mockConfig,
        sources: {
          slack: [
            ...mockConfig.sources.slack,
            {
              name: 'Disabled Slack',
              token: 'xoxb-disabled-token',
              channels: ['C987654321'],
              enabled: false,
            },
          ],
        },
      };

      const enabledSources = adapter.getEnabledSlackSources(configWithDisabledSource);

      expect(enabledSources).toHaveLength(1);
      expect(enabledSources[0]?.name).toBe('Test Slack');
    });

    it('should get output configuration', async () => {
      const outputConfig = await adapter.getOutputConfig();

      expect(outputConfig).toEqual(mockConfig.global.obsidian);
    });

    it('should get configured channels', async () => {
      const channels = await adapter.getConfiguredChannels();

      expect(channels).toEqual(mockConfig.sources.slack);
    });

    it('should check if configuration exists', async () => {
      mockApp.vault.adapter.exists.mockResolvedValue(true);

      const exists = await adapter.configExists();
      expect(exists).toBe(true);
    });

    it('should get configuration path', () => {
      const path = adapter.getConfigPath();
      expect(path).toBe('test-config.json');
    });

    it('should update configuration path', () => {
      adapter.updateConfigPath('new-config.json');

      const path = adapter.getConfigPath();
      expect(path).toBe('new-config.json');
    });

    it('should clear cache', async () => {
      // First load caches the config
      await adapter.getConfig();

      // Clear cache
      adapter.clearCache();

      // Should read from file again
      await adapter.getConfig();
      expect(mockApp.vault.adapter.read).toHaveBeenCalledTimes(1);
    });
  });
});
