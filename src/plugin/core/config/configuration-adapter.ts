import { type App, normalizePath } from 'obsidian';
import { parse as parseYAML } from 'yaml';
import type { EnhancedPluginConfig, SlackSourceConfig, YamlConfig } from '../../types';

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced configuration adapter for plugin settings
 */
export class EnhancedConfigurationAdapter {
  private cachedConfig: EnhancedPluginConfig | null = null;

  constructor(
    private app: App,
    private configPath: string = 'message-sync-config.json'
  ) {}

  /**
   * Get the current configuration
   */
  async getConfig(): Promise<EnhancedPluginConfig | null> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      // For plugin configs, try to read from the vault first
      // This handles both absolute paths and relative paths from vault root
      let configExists = false;
      let configContent = '';

      // Normalize the path to handle both absolute and relative paths
      const normalizedPath = normalizePath(this.configPath);

      try {
        configExists = await this.app.vault.adapter.exists(normalizedPath);
        if (configExists) {
          configContent = await this.app.vault.adapter.read(normalizedPath);
        }
      } catch (error) {
        console.log('Config file not found in vault, trying as absolute path:', error);
        // If vault access fails, it might be an absolute path outside vault
        return null;
      }

      if (!configExists) {
        return null;
      }

      // Parse YAML configuration (with JSON fallback)
      let config: EnhancedPluginConfig;
      try {
        config = parseYAML(configContent) as EnhancedPluginConfig;
      } catch (yamlError) {
        try {
          config = JSON.parse(configContent) as EnhancedPluginConfig;
        } catch (_jsonError) {
          throw new Error(`Configuration parsing failed: ${yamlError}`);
        }
      }

      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        console.warn('Configuration validation failed:', validation.errors);
        return null;
      }

      this.cachedConfig = config;
      return config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return null;
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(config: EnhancedPluginConfig): Promise<void> {
    try {
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      const configContent = JSON.stringify(config, null, 2);
      await this.app.vault.adapter.write(this.configPath, configContent);

      this.cachedConfig = config;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Get enabled Slack sources
   */
  getEnabledSlackSources(config: EnhancedPluginConfig): SlackSourceConfig[] {
    if (!config.sources?.slack) {
      return [];
    }
    return config.sources.slack.filter((source) => source.enabled);
  }

  /**
   * Get output configuration
   */
  async getOutputConfig(): Promise<YamlConfig['global']['obsidian']> {
    const config = await this.getConfig();
    return (
      config?.global?.obsidian || {
        vaultPath: '',
        notesFolder: 'message-sync',
        organization: 'daily',
        showNotifications: true,
      }
    );
  }

  /**
   * Get configured channels
   */
  async getConfiguredChannels(): Promise<SlackSourceConfig[]> {
    const config = await this.getConfig();
    return config?.sources?.slack || [];
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: EnhancedPluginConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required configuration
    if (!config.sources?.slack?.length) {
      errors.push('No Slack sources configured');
    }

    // Validate each Slack source
    for (const [index, source] of (config.sources?.slack || []).entries()) {
      const prefix = `Slack source ${index + 1}`;

      console.log(`🔍 Validating ${prefix}:`, JSON.stringify(source, null, 2));

      if (!source.token) {
        errors.push(`${prefix}: Missing token`);
      }

      if (!source.channels || !Array.isArray(source.channels) || source.channels.length === 0) {
        console.log(`❌ ${prefix}: channels validation failed`, {
          hasChannels: !!source.channels,
          isArray: Array.isArray(source.channels),
          length: source.channels?.length,
        });
        errors.push(`${prefix}: Missing channels or channels array is empty`);
      }

      if (!source.name) {
        warnings.push(`${prefix}: Missing name, using default`);
      }
    }

    console.log('✅ Validation result:', { isValid: errors.length === 0, errors, warnings });
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Update configuration path
   */
  updateConfigPath(newPath: string): void {
    this.configPath = normalizePath(newPath);
    this.clearCache();
  }

  /**
   * Check if configuration exists
   */
  async configExists(): Promise<boolean> {
    return await this.app.vault.adapter.exists(this.configPath);
  }

  /**
   * Get configuration path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
