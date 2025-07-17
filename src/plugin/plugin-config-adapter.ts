/**
 * Plugin Configuration Adapter
 *
 * This adapter bridges the existing CLI configuration system with Obsidian's
 * plugin environment by providing browser-compatible implementations.
 */

import { type App, normalizePath } from 'obsidian';
import type MessageSyncPlugin from './main';
import type { MessageSyncSettings } from './types';

export interface PluginConfigSummary {
  strategy: 'plugin' | 'yaml' | 'legacy';
  hasConfigFile: boolean;
  hasValidTokens: boolean;
  enabledSourcesCount: number;
  vaultPath: string;
  notesFolder: string;
  configPath?: string;
}

export interface PluginConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Plugin-compatible configuration manager that adapts the CLI configuration
 * system to work within Obsidian's constraint environment.
 */
export class PluginConfigurationAdapter {
  private app: App;
  private settings: MessageSyncSettings;
  private plugin: MessageSyncPlugin;

  constructor(app: App, settings: MessageSyncSettings, plugin: MessageSyncPlugin) {
    this.app = app;
    this.settings = settings;
    this.plugin = plugin;
  }

  /**
   * Get configuration summary adapted for plugin environment
   */
  async getConfigurationSummary(): Promise<PluginConfigSummary> {
    const hasConfigFile = await this.hasValidConfigFile();
    const hasValidTokens = await this.hasValidTokens();

    let strategy: 'plugin' | 'yaml' | 'legacy' = 'plugin';
    if (hasConfigFile) {
      strategy = 'yaml';
    } else if (this.hasEnvironmentTokens()) {
      strategy = 'legacy';
    }

    return {
      strategy,
      hasConfigFile,
      hasValidTokens,
      enabledSourcesCount: hasValidTokens ? 1 : 0, // Simplified for plugin
      vaultPath: this.app.vault.adapter.getName(),
      notesFolder: this.settings.outputFolder || 'Slack Messages',
      configPath: this.settings.configPath,
    };
  }

  /**
   * Validate current configuration
   */
  async validateConfiguration(): Promise<PluginConfigValidation> {
    console.log('🔍 Starting configuration validation...');
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic plugin settings
    console.log('📋 Plugin settings:', this.settings);

    if (!this.settings.configPath) {
      console.log('⚠️ No configuration file path specified');
      warnings.push('No configuration file path specified');
    }

    if (!this.settings.outputFolder) {
      console.log('❌ Output folder is required');
      errors.push('Output folder is required');
    }

    if (this.settings.syncInterval < 5) {
      console.log('⚠️ Sync interval below 5 minutes');
      warnings.push('Sync interval below 5 minutes may cause performance issues');
    }

    // Check configuration file if specified
    if (this.settings.configPath) {
      console.log('📄 Validating config file:', this.settings.configPath);
      const configValid = await this.validateConfigFile();
      console.log('📄 Config file validation result:', configValid);
      if (!configValid.isValid) {
        errors.push(...configValid.errors);
        warnings.push(...configValid.warnings);
      }
    }

    // Check for valid tokens
    console.log('🔑 Checking for valid tokens...');
    const hasTokens = await this.hasValidTokens();
    console.log('🔑 Has valid tokens:', hasTokens);
    if (!hasTokens) {
      console.log('❌ No valid authentication tokens found');
      errors.push('No valid authentication tokens found');
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    console.log('✅ Validation complete:', result);
    return result;
  }

  /**
   * Check if configuration file exists and is valid
   */
  private async hasValidConfigFile(): Promise<boolean> {
    if (!this.settings.configPath) return false;

    try {
      const configPath = normalizePath(this.settings.configPath);

      // Check if the config file exists using the file system adapter
      const exists = await this.app.vault.adapter.exists(configPath);

      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration file content
   */
  private async validateConfigFile(): Promise<PluginConfigValidation> {
    console.log('📄 Starting config file validation...');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.settings.configPath) {
      console.log('❌ No configuration file path specified');
      errors.push('No configuration file path specified');
      return { isValid: false, errors, warnings };
    }
    try {
      const configPath = normalizePath(this.settings.configPath);
      console.log('📄 Checking config file at:', configPath);

      // Use the file system adapter to read the config file (works outside vault)
      const content = await this.app.vault.adapter.read(configPath);
      console.log('📄 Config file content length:', content.length);

      // Basic YAML validation
      if (content.trim().length === 0) {
        console.log('❌ Configuration file is empty');
        errors.push('Configuration file is empty');
        return { isValid: false, errors, warnings };
      }

      // Check for common YAML issues
      if (content.includes('\t')) {
        console.log('⚠️ Configuration file contains tabs');
        warnings.push('Configuration file contains tabs - use spaces for indentation');
      }

      // Check for basic structure (simplified validation)
      const lines = content.split('\n');
      let hasSlackSection = false;
      let hasToken = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('slack:')) {
          console.log('✅ Found slack section');
          hasSlackSection = true;
        }
        // Look for token in the format: token: "actual-token" or token: actual-token
        if (
          trimmed.includes('token:') &&
          !trimmed.includes('YOUR_TOKEN_HERE') &&
          !trimmed.includes('your_token_here') &&
          (trimmed.includes('xoxp-') || trimmed.includes('xoxb-'))
        ) {
          console.log('✅ Found valid token');
          hasToken = true;
        }
      }

      if (!hasSlackSection) {
        console.log('⚠️ No Slack configuration section found');
        warnings.push('No Slack configuration section found');
      }

      if (!hasToken) {
        console.log('⚠️ No valid token found in configuration');
        warnings.push('No valid token found in configuration');
      }

      const result = { isValid: errors.length === 0, errors, warnings };
      console.log('📄 Config file validation result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to read configuration file:', error);
      errors.push(`Failed to read configuration file: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Check if we have valid authentication tokens
   */
  private async hasValidTokens(): Promise<boolean> {
    console.log('🔑 Checking for valid tokens...');

    // First check if we have environment variables (for legacy mode)
    const hasEnvTokens = this.hasEnvironmentTokens();
    console.log('🔑 Environment tokens:', hasEnvTokens);
    if (hasEnvTokens) {
      return true;
    }

    // Check plugin settings for tokens
    console.log('🔑 Plugin settings slackConfigs:', this.settings.slackConfigs);
    if (this.settings.slackConfigs && this.settings.slackConfigs.length > 0) {
      const hasValidToken = this.settings.slackConfigs.some((config) => config.token);
      console.log('✅ Found valid slackConfigs in plugin settings');
      return hasValidToken;
    }

    // Then check configuration file
    if (this.settings.configPath) {
      console.log('🔑 Checking config file for tokens:', this.settings.configPath);
      try {
        const configPath = normalizePath(this.settings.configPath);
        const content = await this.app.vault.adapter.read(configPath);
        console.log('📄 Config file content preview:', `${content.substring(0, 200)}...`);

        // Simple token detection - look for actual Slack tokens
        const hasTokenKey = content.includes('token:');
        const hasPlaceholder1 = content.includes('YOUR_TOKEN_HERE');
        const hasPlaceholder2 = content.includes('your_token_here');
        const hasSlackToken = content.includes('xoxp-') || content.includes('xoxb-');

        console.log('🔍 Token detection:', {
          hasTokenKey,
          hasPlaceholder1,
          hasPlaceholder2,
          hasSlackToken,
          isValid: hasTokenKey && !hasPlaceholder1 && !hasPlaceholder2 && hasSlackToken,
        });

        return hasTokenKey && !hasPlaceholder1 && !hasPlaceholder2 && hasSlackToken;
      } catch (error) {
        console.error('❌ Error reading config file:', error);
        // Fall through to false
      }
    }

    console.log('❌ No valid tokens found');
    return false;
  }

  /**
   * Check if environment variables have tokens (for legacy mode)
   */
  private hasEnvironmentTokens(): boolean {
    // In plugin environment, we can't access process.env directly
    // This would need to be passed in or configured differently
    return false;
  }

  /**
   * Get configuration file content
   */
  async getConfigFileContent(): Promise<string | null> {
    if (!this.settings.configPath) return null;

    try {
      const configPath = normalizePath(this.settings.configPath);

      // Use the file system adapter to read the config file
      const content = await this.app.vault.adapter.read(configPath);

      return content;
    } catch {
      // Fall through to null
    }

    return null;
  }

  /**
   * Write configuration file content
   */
  async writeConfigFile(content: string): Promise<boolean> {
    if (!this.settings.configPath) {
      return false;
    }

    try {
      const configPath = normalizePath(this.settings.configPath);

      // Ensure directory exists
      const dirPath = configPath.substring(0, configPath.lastIndexOf('/'));
      if (dirPath) {
        try {
          await this.app.vault.adapter.mkdir(dirPath);
        } catch (_error) {
          // Directory might already exist, that's ok
        }
      }

      await this.app.vault.adapter.write(configPath, content);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Create a configuration file with actual onboarding data
   */
  async createConfigFromOnboarding(onboardingData: {
    slackBotToken?: string;
    slackUserToken?: string;
    slackChannels?: string[];
    outputPath?: string;
    schedule?: string;
  }): Promise<boolean> {
    const token =
      onboardingData.slackBotToken || onboardingData.slackUserToken || 'YOUR_SLACK_TOKEN_HERE';
    const channels = onboardingData.slackChannels || ['general'];

    // First, update the plugin settings with the token for immediate validation
    const newSlackConfig = {
      id: `config-${Date.now()}`,
      name: 'Default Slack',
      token: token,
      channels: channels,
      output: 'sync/slack/{{channel}}/{{month}}.md',
      schedule: 'manual' as const,
      enabled: true,
      lastSync: null,
    };
    this.settings.slackConfigs = [newSlackConfig];
    this.settings.outputFolder = onboardingData.outputPath || 'sync';
    this.settings.configPath = '.obsidian/plugins/obsidian-message-sync-dev/config.yaml';

    // Save the plugin settings through the plugin's saveSettings method
    try {
      await this.plugin.saveSettings();
      console.log('✅ Plugin settings saved successfully');
    } catch (error) {
      console.error('❌ Failed to save plugin settings:', error);
      // Continue anyway
    }

    // Now create the YAML config file
    let vaultPath: string;
    try {
      // Try to get the actual vault path
      const adapter = this.app.vault.adapter as { path?: string; basePath?: string };
      if (adapter.path && typeof adapter.path === 'string') {
        vaultPath = adapter.path;
      } else if (adapter.basePath && typeof adapter.basePath === 'string') {
        vaultPath = adapter.basePath;
      } else {
        vaultPath = this.app.vault.getName();
      }
    } catch {
      vaultPath = this.app.vault.getName();
    }
    const schedule = onboardingData.schedule === 'manual' ? 'manual' : '0 */6 * * *';

    const configWithActualData = `# Message Sync Configuration
# Generated by Obsidian Message Sync Plugin

global:
  obsidian:
    vaultPath: "${vaultPath}"
    notesFolder: "${onboardingData.outputPath || 'sync'}"

  sync:
    enabled: true
    defaultSchedule: "${schedule}"

  logging:
    level: "info"

  environment:
    nodeEnv: "development"

sources:
  slack:
    - service: slack
      name: "primary-slack"
      token: "${token}"
      channels: ${JSON.stringify(channels)}
      output: "${onboardingData.outputPath || 'sync'}/slack/{{date}}.md"
      schedule: "${schedule}"
      enabled: true

  signal: []
  teams: []
  telegram: []
`;

    return await this.writeConfigFile(configWithActualData);
  }

  /**
   * Create a default configuration file
   */
  async createDefaultConfig(): Promise<boolean> {
    const defaultConfig = `# Message Sync Configuration
# Generated by Obsidian Message Sync Plugin

global:
  obsidian:
    vaultPath: "${this.app.vault.adapter.getName()}"
    notesFolder: "${this.settings.outputFolder || 'Slack Messages'}"

  sync:
    enabled: true
    maxConcurrentSources: 3
    interval: ${this.settings.syncInterval || 60}

  logging:
    level: "info"

sources:
  slack:
    - name: "MySlackWorkspace"
      enabled: true
      token: "YOUR_SLACK_TOKEN_HERE"
      channels:
        - "#general"
        - "#random"
      output:
        path: "{{global.obsidian.notesFolder}}/{{source.name}}/{{date.year}}/{{date.month}}"
        filename: "{{channel.name}}-{{date.day}}.md"

templateVariables:
  date:
    year: "{{new Date().getFullYear()}}"
    month: "{{new Date().getMonth() + 1}}"
    day: "{{new Date().getDate()}}"

  source:
    name: "{{source.name}}"

  channel:
    name: "{{channel.name}}"
`;

    return await this.writeConfigFile(defaultConfig);
  }

  /**
   * Get configuration analysis for display
   */
  async getConfigurationAnalysis(): Promise<{
    strategy: string;
    isValid: boolean;
    summary?: PluginConfigSummary;
    validation?: PluginConfigValidation;
    configContent?: string;
  }> {
    console.log('🔍 Starting configuration analysis...');
    const summary = await this.getConfigurationSummary();
    console.log('📊 Configuration summary:', summary);

    const validation = await this.validateConfiguration();
    console.log('✅ Configuration validation:', validation);

    const configContent = await this.getConfigFileContent();
    console.log('📄 Config content length:', configContent?.length || 0);

    const result = {
      strategy: summary.strategy,
      isValid: validation.isValid,
      summary,
      validation,
      ...(configContent && { configContent }),
    };

    console.log('🏁 Configuration analysis result:', result);
    return result;
  }

  /**
   * Reload configuration (clear cache)
   */
  reloadConfiguration(): void {
    // Configuration reloaded - no cache to clear in this implementation
  }

  /**
   * Check if configuration has changed
   */
  isConfigurationValid(): boolean {
    // This is a simplified check - in a full implementation,
    // we would cache the validation result
    return this.settings.configPath !== undefined && this.settings.outputFolder !== undefined;
  }

  /**
   * Get available configuration templates
   */
  getConfigTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    content: string;
  }> {
    return [
      {
        id: 'basic',
        name: 'Basic Slack Configuration',
        description: 'Simple setup for syncing Slack channels',
        content: `# Basic Slack Configuration
global:
  obsidian:
    vaultPath: "${this.app.vault.adapter.getName()}"
    notesFolder: "${this.settings.outputFolder || 'Slack Messages'}"

sources:
  slack:
    - name: "MyWorkspace"
      enabled: true
      token: "YOUR_SLACK_TOKEN_HERE"
      channels:
        - "#general"
        - "#random"
`,
      },
      {
        id: 'advanced',
        name: 'Advanced Multi-Source Configuration',
        description: 'Full-featured setup with multiple services',
        content: `# Advanced Multi-Source Configuration
global:
  obsidian:
    vaultPath: "${this.app.vault.adapter.getName()}"
    notesFolder: "${this.settings.outputFolder || 'Messages'}"

  sync:
    enabled: true
    maxConcurrentSources: 5
    interval: ${this.settings.syncInterval || 60}

sources:
  slack:
    - name: "WorkSlack"
      enabled: true
      token: "YOUR_WORK_SLACK_TOKEN_HERE"
      channels:
        - "#general"
        - "#dev-team"

    - name: "PersonalSlack"
      enabled: false
      token: "YOUR_PERSONAL_SLACK_TOKEN_HERE"
      channels:
        - "#friends"
`,
      },
    ];
  }
}
