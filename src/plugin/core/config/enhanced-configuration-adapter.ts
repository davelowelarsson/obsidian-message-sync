/**
 * Enhanced Configuration Adapter for Obsidian Plugin
 *
 * Handles configuration loading and parsing specifically for the Obsidian plugin environment.
 * This adapter works with Obsidian's file system APIs and provides a clean interface
 * for configuration management with multi-source support and template resolution.
 */

import { type App, normalizePath } from 'obsidian';
import { parse as parseYAML } from 'yaml';
import type {
  ConfigValidationResult,
  EnhancedPluginConfig,
  SlackSourceConfig,
  TemplateContext,
} from '../../types';

// Default configuration template
const DEFAULT_CONFIG: EnhancedPluginConfig = {
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
    slack: [],
  },
};

/**
 * Enhanced configuration adapter for Obsidian plugin
 */
export class EnhancedConfigurationAdapter {
  private app: App;
  private configPath: string;
  private cachedConfig: EnhancedPluginConfig | null = null;

  constructor(app: App, configPath: string) {
    this.app = app;
    this.configPath = normalizePath(configPath);
  }

  /**
   * Load and parse configuration file
   */
  async loadConfig(): Promise<ConfigValidationResult> {
    try {
      // Check if config file exists
      const exists = await this.app.vault.adapter.exists(this.configPath);
      if (!exists) {
        return {
          valid: false,
          error: `Configuration file not found: ${this.configPath}`,
        };
      }

      // Read config file
      const configContent = await this.app.vault.adapter.read(this.configPath);

      // Parse configuration
      const config = this.parseConfig(configContent);

      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        return validationResult;
      }

      // Cache valid config
      this.cachedConfig = config;

      return {
        valid: true,
        config,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error loading configuration',
      };
    }
  }

  /**
   * Get cached configuration (loads if not cached)
   */
  async getConfig(): Promise<EnhancedPluginConfig | null> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const result = await this.loadConfig();
    return result.valid ? result.config || null : null;
  }

  /**
   * Resolve template variables in a path
   */
  resolveTemplate(template: string, context?: Partial<TemplateContext>): string {
    const now = new Date();
    const defaultContext: TemplateContext = {
      date: now.toISOString().split('T')[0] || now.toISOString().slice(0, 10), // YYYY-MM-DD
      week: this.getWeekString(now),
      month: now.toISOString().slice(0, 7), // YYYY-MM
      year: now.getFullYear().toString(),
      ...context,
    };

    let resolved = template;
    for (const [key, value] of Object.entries(defaultContext)) {
      resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return resolved;
  }

  /**
   * Get week string in YYYY-WW format
   */
  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${year}-${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get enabled Slack sources
   */
  async getEnabledSlackSources(): Promise<SlackSourceConfig[]> {
    const config = await this.getConfig();
    if (!config) return [];

    return config.sources.slack.filter((source) => source.enabled);
  }

  /**
   * Get source by name
   */
  async getSlackSourceByName(name: string): Promise<SlackSourceConfig | null> {
    const config = await this.getConfig();
    if (!config) return null;

    return config.sources.slack.find((source) => source.name === name) || null;
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Parse configuration content (YAML or JSON)
   */
  private parseConfig(configContent: string): EnhancedPluginConfig {
    try {
      // Try YAML first
      const parsed = parseYAML(configContent);
      return this.normalizeConfig(parsed);
    } catch (yamlError) {
      try {
        // Fallback to JSON
        const parsed = JSON.parse(configContent);
        return this.normalizeConfig(parsed);
      } catch (_jsonError) {
        throw new Error(`Configuration parsing failed: ${yamlError}`);
      }
    }
  }

  /**
   * Normalize configuration to match expected structure
   */
  private normalizeConfig(config: unknown): EnhancedPluginConfig {
    // Type guard for config object
    if (!config || typeof config !== 'object') {
      return DEFAULT_CONFIG;
    }

    const configObj = config as Record<string, unknown>;

    // If this is a legacy configuration, convert it
    if (configObj['slack'] && !configObj['sources']) {
      const slackConfig = configObj['slack'] as Record<string, unknown>;
      return {
        ...DEFAULT_CONFIG,
        sources: {
          slack: [
            {
              service: 'slack',
              name: 'LegacySlackSource',
              channels: slackConfig['channelId'] ? [slackConfig['channelId'] as string] : [],
              token: (slackConfig['token'] as string) || '',
              output: (configObj['outputDir'] as string) || '{{date}}.md',
              schedule: 'manual',
              enabled: true,
            },
          ],
        },
      };
    }

    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...configObj,
      global: {
        ...DEFAULT_CONFIG.global,
        ...((configObj['global'] as Record<string, unknown>) || {}),
      },
      sources: {
        ...DEFAULT_CONFIG.sources,
        ...((configObj['sources'] as Record<string, unknown>) || {}),
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: EnhancedPluginConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    if (!config.sources || !config.sources.slack) {
      errors.push('Configuration must have sources.slack defined');
    }

    // Validate Slack sources
    if (config.sources.slack) {
      config.sources.slack.forEach((source, index) => {
        if (!source.name) {
          errors.push(`Slack source ${index + 1} must have a name`);
        }
        if (!source.channels || !Array.isArray(source.channels) || source.channels.length === 0) {
          errors.push(
            `Slack source ${index + 1} must have channels array with at least one channel`
          );
        }
        if (!source.token) {
          errors.push(`Slack source ${index + 1} must have a token`);
        }
        if (!source.output) {
          errors.push(`Slack source ${index + 1} must have an output path`);
        }
      });
    }

    // Validate global settings
    if (config.global?.obsidian?.notesFolder && !config.global.obsidian.notesFolder.trim()) {
      errors.push('Global obsidian.notesFolder cannot be empty');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; '),
        warnings,
      };
    }

    return {
      valid: true,
      config,
      warnings,
    };
  }
}
