/**
 * Configuration Manager for Obsidian Message Sync Plugin
 *
 * Handles two-way synchronization between Obsidian plugin settings and YAML configuration files.
 * Follows Obsidian best practices for settings management.
 */

import type { App } from 'obsidian';
import { normalizePath, TFile } from 'obsidian';
import { parse, stringify } from 'yaml';
import type { MessageSyncSettings, SlackConfig, SlackSourceConfig, YamlConfig } from '../types';

export class ConfigurationManager {
  private app: App;
  private settings: MessageSyncSettings;
  private configPath: string;
  private watchers: Set<() => void> = new Set();

  constructor(app: App, settings: MessageSyncSettings) {
    this.app = app;
    this.settings = settings;
    this.configPath = this.resolveConfigPath(settings.configPath);
  }

  /**
   * Resolve the full path to the configuration file
   */
  private resolveConfigPath(configPath: string): string {
    console.log('🔍 Resolving config path:', configPath);
    console.log('🔍 configPath.startsWith("/"):', configPath.startsWith('/'));

    if (configPath.startsWith('/')) {
      console.log('🔍 Using absolute path:', configPath);
      return configPath; // Absolute path
    }

    // Check if the path already starts with .obsidian (vault-relative path)
    if (configPath.startsWith('.obsidian/')) {
      console.log('🔍 Using vault-relative path:', configPath);
      return configPath; // Already relative to vault root
    }

    // Relative to plugin data directory
    const pluginDataPath = `${this.app.vault.configDir}/plugins/obsidian-message-sync-dev`;
    const resolvedPath = normalizePath(`${pluginDataPath}/${configPath}`);
    console.log('🔍 Plugin data path:', pluginDataPath);
    console.log('🔍 Resolved relative path:', resolvedPath);

    return resolvedPath;
  }

  /**
   * Load settings from both plugin data and YAML config
   */
  async loadSettings(): Promise<MessageSyncSettings> {
    try {
      console.log('📂 ConfigurationManager: Loading settings...');
      console.log('📂 Config path:', this.configPath);
      console.log('📂 Current settings:', this.settings);

      // Load YAML configuration if it exists
      const yamlConfig = await this.loadYamlConfig();
      console.log('📥 Loaded YAML config:', yamlConfig);

      if (yamlConfig) {
        // Merge YAML config into plugin settings
        const mergedSettings = this.mergeYamlIntoSettings(this.settings, yamlConfig);
        console.log('🔄 Merged settings:', mergedSettings);
        this.settings = mergedSettings;
      } else {
        console.log('⚠️ No YAML config found, using current settings');
      }

      return this.settings;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return this.settings;
    }
  }

  /**
   * Save settings to both plugin data and YAML config
   */
  async saveSettings(settings: MessageSyncSettings): Promise<void> {
    console.log('🔄 ConfigurationManager.saveSettings called with:', settings);
    this.settings = settings;

    try {
      // Convert settings to YAML format and save
      const yamlConfig = this.convertSettingsToYaml(settings);
      console.log('📝 Converted to YAML config:', yamlConfig);

      await this.saveYamlConfig(yamlConfig);
      console.log('✅ YAML config saved successfully');

      // Notify watchers
      this.notifyWatchers();
    } catch (error) {
      console.error('❌ Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Export settings as YAML string
   */
  async exportSettingsAsYaml(settings: MessageSyncSettings): Promise<string> {
    const yamlConfig = this.convertSettingsToYaml(settings);
    return stringify(yamlConfig);
  }

  /**
   * Load YAML configuration file
   */
  private async loadYamlConfig(): Promise<YamlConfig | null> {
    try {
      console.log('📂 Loading YAML config from:', this.configPath);

      // Check if this is an absolute path outside the vault
      if (this.configPath.startsWith('/')) {
        console.log('📂 Loading from absolute path outside vault');

        // Use the adapter to read files outside the vault
        if (!(await this.app.vault.adapter.exists(this.configPath))) {
          console.log('⚠️ Config file does not exist at absolute path');
          return null;
        }

        const content = await this.app.vault.adapter.read(this.configPath);
        console.log('📄 Raw YAML content:', content);

        const config = parse(content) as YamlConfig;
        console.log('📋 Parsed YAML config:', config);

        return config;
      } else if (
        this.configPath.startsWith('.obsidian/') ||
        this.configPath.includes('/.obsidian/')
      ) {
        // Handle .obsidian/ paths (these are in the Obsidian config directory, not the vault)
        console.log('📂 Loading from Obsidian config directory');

        // Use the adapter to read files from the Obsidian config directory
        if (!(await this.app.vault.adapter.exists(this.configPath))) {
          console.log('⚠️ Config file does not exist in Obsidian config directory');
          return null;
        }

        const content = await this.app.vault.adapter.read(this.configPath);
        console.log('📄 Raw YAML content:', content);

        const config = parse(content) as YamlConfig;
        console.log('📋 Parsed YAML config:', config);

        return config;
      } else {
        // Handle relative paths within the vault
        console.log('📂 Loading from relative path within vault');

        const configFile = this.app.vault.getAbstractFileByPath(this.configPath);
        if (!configFile || !(configFile instanceof TFile)) {
          console.log('⚠️ Config file does not exist or is not a TFile');
          return null;
        }

        const content = await this.app.vault.read(configFile);
        console.log('📄 Raw YAML content:', content);

        const config = parse(content) as YamlConfig;
        console.log('📋 Parsed YAML config:', config);

        return config;
      }
    } catch (error) {
      console.warn('Could not load YAML config:', error);
      return null;
    }
  }

  /**
   * Save YAML configuration file
   */
  private async saveYamlConfig(config: YamlConfig): Promise<void> {
    try {
      const yamlContent = stringify(config, {
        indent: 2,
        lineWidth: 100,
        defaultStringType: 'QUOTE_DOUBLE',
      });

      // Ensure directory exists
      const dirPath = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
      if (!(await this.app.vault.adapter.exists(dirPath))) {
        await this.app.vault.createFolder(dirPath);
      }

      // Write the file
      await this.app.vault.adapter.write(this.configPath, yamlContent);
    } catch (error) {
      console.error('Failed to save YAML config:', error);
      throw error;
    }
  }

  /**
   * Merge YAML configuration into plugin settings
   */
  private mergeYamlIntoSettings(
    settings: MessageSyncSettings,
    yamlConfig: YamlConfig
  ): MessageSyncSettings {
    console.log('🔄 Merging YAML config into settings...');
    console.log('🔄 Input settings:', settings);
    console.log('🔄 Input YAML config:', yamlConfig);
    console.log('🔄 YAML config sources:', yamlConfig.sources);
    console.log('🔄 YAML config slack sources:', yamlConfig.sources.slack);

    const slackConfigs: SlackConfig[] = yamlConfig.sources.slack.map((source, index) => ({
      id: source.name || `slack-${index}`,
      name: source.name,
      token: source.token,
      channels: source.channels,
      output: source.output,
      schedule: source.schedule as 'manual' | 'hourly' | 'daily' | 'weekly',
      enabled: source.enabled,
    }));

    console.log('🔄 Mapped slack configs:', slackConfigs);

    const mergedSettings = {
      ...settings,
      slackConfigs,
      outputFolder: yamlConfig.global.obsidian.notesFolder,
      autoSync: yamlConfig.global.sync.enabled,
      debugMode: yamlConfig.global.logging.level === 'debug',
    };

    console.log('🔄 Final merged settings:', mergedSettings);
    return mergedSettings;
  }

  /**
   * Convert plugin settings to YAML format
   */
  convertSettingsToYaml(settings: MessageSyncSettings): YamlConfig {
    // Generate output template based on organization setting
    const getOutputTemplate = (organization: string): string => {
      const baseFolder = settings.outputFolder;
      switch (organization) {
        case 'daily':
          return `${baseFolder}/slack/{{channel}}/{{date}}.md`;
        case 'weekly':
          return `${baseFolder}/slack/{{channel}}/{{week}}.md`;
        case 'monthly':
          return `${baseFolder}/slack/{{channel}}/{{month}}.md`;
        case 'yearly':
          return `${baseFolder}/slack/{{channel}}/{{year}}.md`;
        default:
          return `${baseFolder}/slack/{{channel}}/{{month}}.md`;
      }
    };

    const slackSources: SlackSourceConfig[] = settings.slackConfigs.map((config) => ({
      service: 'slack',
      name: config.name,
      token: config.token,
      channels: config.channels,
      output: getOutputTemplate(settings.organization),
      schedule: config.schedule,
      enabled: config.enabled,
    }));

    return {
      global: {
        obsidian: {
          vaultPath: this.app.vault.adapter.getName() || '',
          notesFolder: settings.outputFolder,
          organization: settings.organization,
          showNotifications: settings.showNotifications,
        },
        sync: {
          enabled: settings.autoSync,
          defaultSchedule: 'manual',
          syncInterval: settings.syncInterval,
        },
        logging: {
          level: settings.debugMode ? 'debug' : 'info',
        },
        environment: {
          nodeEnv: 'development',
        },
      },
      sources: {
        slack: slackSources,
        signal: [],
        teams: [],
        telegram: [],
      },
    };
  }

  /**
   * Get current settings
   */
  getSettings(): MessageSyncSettings {
    return { ...this.settings };
  }

  /**
   * Add a new Slack configuration
   */
  async addSlackConfig(config: Omit<SlackConfig, 'id'>): Promise<void> {
    const newConfig: SlackConfig = {
      ...config,
      id: `slack-${Date.now()}`,
    };

    const updatedSettings = {
      ...this.settings,
      slackConfigs: [...this.settings.slackConfigs, newConfig],
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * Update an existing Slack configuration
   */
  async updateSlackConfig(id: string, updates: Partial<SlackConfig>): Promise<void> {
    const updatedSettings = {
      ...this.settings,
      slackConfigs: this.settings.slackConfigs.map((config) =>
        config.id === id ? { ...config, ...updates } : config
      ),
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * Remove a Slack configuration
   */
  async removeSlackConfig(id: string): Promise<void> {
    const updatedSettings = {
      ...this.settings,
      slackConfigs: this.settings.slackConfigs.filter((config) => config.id !== id),
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * Watch for external changes to the configuration file
   */
  watchConfigFile(): void {
    // Register event listener for file changes
    this.app.vault.on('modify', async (file) => {
      if (file.path === this.configPath && file instanceof TFile) {
        await this.onFileModified(file);
      }
    });
  }

  /**
   * Handle external file modifications
   */
  private async onFileModified(file: TFile): Promise<void> {
    if (file.path === this.configPath) {
      try {
        // Reload settings from file
        await this.loadSettings();
        this.notifyWatchers();
      } catch (error) {
        console.error('Failed to reload configuration after file change:', error);
      }
    }
  }

  /**
   * Add a change watcher
   */
  addWatcher(callback: () => void): void {
    this.watchers.add(callback);
  }

  /**
   * Remove a change watcher
   */
  removeWatcher(callback: () => void): void {
    this.watchers.delete(callback);
  }

  /**
   * Notify all watchers of changes
   */
  private notifyWatchers(): void {
    this.watchers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in config watcher:', error);
      }
    });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: YamlConfig): string[] {
    const errors: string[] = [];

    // Validate global settings
    if (!config.global?.obsidian?.vaultPath) {
      errors.push('Missing vault path in global configuration');
    }

    if (!config.global?.obsidian?.notesFolder) {
      errors.push('Missing notes folder in global configuration');
    }

    // Validate Slack configurations
    if (!config.sources.slack || config.sources.slack.length === 0) {
      errors.push('No Slack sources configured');
    } else {
      config.sources.slack.forEach((slackConfig, index) => {
        if (!slackConfig.name) {
          errors.push(`Slack config ${index}: Missing name`);
        }

        if (!slackConfig.token) {
          errors.push(`Slack config ${index}: Missing token`);
        }

        if (!slackConfig.channels || slackConfig.channels.length === 0) {
          errors.push(`Slack config ${index}: Missing channels`);
        }

        if (!slackConfig.output) {
          errors.push(`Slack config ${index}: Missing output template`);
        }
      });
    }

    return errors;
  }

  /**
   * Generate a default configuration
   */
  generateDefaultConfig(): YamlConfig {
    return {
      global: {
        obsidian: {
          vaultPath: this.app.vault.adapter.getName() || '',
          notesFolder: 'sync',
        },
        sync: {
          enabled: false,
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
        slack: [],
        signal: [],
        teams: [],
        telegram: [],
      },
    };
  }
}
