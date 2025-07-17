/**
 * Enhanced Settings Tab for Obsidian Message Sync Plugin
 *
 * Provides a comprehensive UI for managing Slack configurations with proper two-way sync
 * Includes quick actions, danger zone, and real-time synchronization
 */

import type { App } from 'obsidian';
import { Notice, PluginSettingTab, Setting } from 'obsidian';
import { ConfigurationManager } from '../config/configuration-manager';
import type MessageSyncPlugin from '../main';
import type { SlackConfig } from '../types';

export class EnhancedSettingsTab extends PluginSettingTab {
  plugin: MessageSyncPlugin;
  configManager: ConfigurationManager;
  private syncInProgress = false;

  constructor(app: App, plugin: MessageSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.configManager = new ConfigurationManager(app, plugin.settings);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h2', { text: 'Message Sync Settings' });

    // Quick actions section (always visible)
    this.addQuickActionsSection();

    // Configuration sync section
    this.addConfigurationSyncSection();

    // General settings
    this.addGeneralSettings();

    // Slack configurations
    this.addSlackConfigurationsSection();

    // Advanced settings
    this.addAdvancedSettings();

    // Danger zone section
    this.addDangerZoneSection();
  }

  private addQuickActionsSection(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Quick Actions' });

    const actionsContainer = containerEl.createEl('div', { cls: 'quick-actions-container' });

    // Configuration status indicator
    const statusEl = actionsContainer.createEl('div', {
      cls: 'config-status',
      attr: {
        style: 'margin-bottom: 12px; padding: 8px; border-radius: 4px; font-size: 0.9em;',
      },
    });

    const slackCount = this.plugin.settings.slackConfigs.length;
    const enabledCount = this.plugin.settings.slackConfigs.filter((c) => c.enabled).length;

    if (slackCount === 0) {
      statusEl.setText('⚠️ No Slack configurations found');
      statusEl.setAttribute(
        'style',
        `${statusEl.getAttribute('style')} background-color: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107;`
      );
    } else {
      statusEl.setText(`✅ ${enabledCount}/${slackCount} Slack configurations enabled`);
      statusEl.setAttribute(
        'style',
        `${statusEl.getAttribute('style')} background-color: rgba(40, 167, 69, 0.1); border-left: 4px solid #28a745;`
      );
    }

    // Sync Now button
    new Setting(actionsContainer)
      .setName('Sync Now')
      .setDesc('Immediately sync messages from all enabled Slack workspaces')
      .addButton((button) =>
        button
          .setButtonText(this.syncInProgress ? 'Syncing...' : 'Sync Now')
          .setCta()
          .setDisabled(this.syncInProgress)
          .onClick(async () => {
            await this.handleSyncNow();
          })
      );

    // Validate Config button
    new Setting(actionsContainer)
      .setName('Validate Configuration')
      .setDesc('Check if your configuration is valid and ready for sync')
      .addButton((button) =>
        button.setButtonText('Validate Config').onClick(async () => {
          await this.handleValidateConfig();
        })
      );
  }

  private async handleSyncNow(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    this.display(); // Refresh to show "Syncing..." state

    try {
      if (this.plugin.settings.showNotifications) {
        new Notice('Starting manual sync...');
      }

      // Use the plugin's sync method
      await this.plugin.service.sync();

      if (this.plugin.settings.showNotifications) {
        new Notice('Sync completed successfully!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Sync failed: ${errorMessage}`);
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
      this.display(); // Refresh to show normal state
    }
  }

  private async handleValidateConfig(): Promise<void> {
    try {
      console.log('🔍 Starting configuration validation...');

      // Log current plugin settings for debugging
      console.log('Plugin settings:', {
        configPath: this.plugin.settings.configPath,
        outputFolder: this.plugin.settings.outputFolder,
        slackConfigs: this.plugin.settings.slackConfigs,
      });

      const validationResult = await this.validateConfiguration();

      if (validationResult.isValid) {
        new Notice('✅ Configuration is valid!');
        console.log('✅ Configuration validation passed');
      } else {
        new Notice(`❌ Configuration has errors: ${validationResult.errors.join(', ')}`);
        console.error('❌ Configuration validation failed:', validationResult.errors);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Validation failed: ${errorMessage}`);
      console.error('Validation failed:', error);
    }
  }

  private async validateConfiguration(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    console.log('🔍 Validating configuration...'); // First, try to load from YAML to get the most up-to-date configuration
    try {
      // Create a new ConfigurationManager with the current settings
      const configManager = new ConfigurationManager(this.plugin.app, this.plugin.settings);

      console.log('📂 Config path:', this.plugin.settings.configPath);
      console.log('📂 Attempting to load settings from YAML...');

      const loadedSettings = await configManager.loadSettings();
      console.log('📥 Loaded settings from ConfigurationManager:', loadedSettings);

      // Update the plugin settings with the loaded settings
      this.plugin.settings = loadedSettings;
      console.log('✅ Successfully loaded settings from YAML');
      console.log('🔧 Updated plugin settings:', this.plugin.settings);
    } catch (error) {
      console.warn('⚠️ Could not load YAML settings, using plugin settings:', error);
    }

    // Validate basic settings
    this.validateBasicSettings(errors);

    // Validate Slack configurations
    this.validateSlackConfigs(errors);

    const isValid = errors.length === 0;

    console.log(`Validation result: ${isValid ? 'VALID' : 'INVALID'}`);
    if (!isValid) {
      console.log('Validation errors:', errors);
    }

    return { isValid, errors };
  }

  private validateBasicSettings(errors: string[]): void {
    if (!this.plugin.settings.outputFolder) {
      errors.push('Output folder is not configured');
    }

    if (!this.plugin.settings.configPath) {
      errors.push('Config file path is not configured');
    }
  }

  private validateSlackConfigs(errors: string[]): void {
    const enabledConfigs = this.plugin.settings.slackConfigs.filter((config) => config.enabled);
    console.log(`Found ${enabledConfigs.length} enabled Slack configurations`);

    if (enabledConfigs.length === 0) {
      errors.push('No Slack configurations are enabled');
      return;
    }

    for (const config of enabledConfigs) {
      console.log(`Validating Slack config: ${config.name}`);

      if (!config.token) {
        errors.push(`Slack workspace "${config.name}" is missing a token`);
      } else if (!config.token.startsWith('xoxb-') && !config.token.startsWith('xoxp-')) {
        errors.push(`Slack workspace "${config.name}" has an invalid token format`);
      }

      if (!config.channels || config.channels.length === 0) {
        errors.push(`Slack workspace "${config.name}" has no channels configured`);
      }

      if (!config.output) {
        errors.push(`Slack workspace "${config.name}" has no output template configured`);
      }
    }
  }

  private addConfigurationSyncSection(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Configuration Synchronization' });

    new Setting(containerEl)
      .setName('Config file path')
      .setDesc('Path to the YAML configuration file (relative to plugin data folder)')
      .addText((text) =>
        text
          .setPlaceholder('config.yaml')
          .setValue(this.plugin.settings.configPath)
          .onChange(async (value) => {
            this.plugin.settings.configPath = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Sync from config file')
      .setDesc('Load settings from the YAML configuration file')
      .addButton((button) =>
        button
          .setButtonText('Load from YAML')
          .setCta()
          .onClick(async () => {
            try {
              console.log('📥 Loading settings from YAML...');
              console.log('Current plugin settings before load:', this.plugin.settings);

              const loadedSettings = await this.configManager.loadSettings();
              this.plugin.settings = loadedSettings;
              await this.plugin.saveSettings();

              console.log('✅ Settings loaded from YAML:', this.plugin.settings);
              new Notice('Settings loaded from YAML configuration');
              this.display(); // Refresh the settings display
            } catch (error) {
              console.error('❌ Failed to load settings from YAML:', error);
              new Notice(
                `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          })
      );

    new Setting(containerEl)
      .setName('Save to config file')
      .setDesc('Save current settings to the YAML configuration file')
      .addButton((button) =>
        button.setButtonText('Save to YAML').onClick(async () => {
          try {
            await this.configManager.saveSettings(this.plugin.settings);
            new Notice('Settings saved to YAML configuration');
          } catch (error) {
            new Notice(
              `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        })
      );
  }

  private addGeneralSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'General Settings' });

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc('Folder where synchronized messages will be stored')
      .addText((text) =>
        text
          .setPlaceholder('sync')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            console.log(
              '📝 Output folder changed from:',
              this.plugin.settings.outputFolder,
              'to:',
              value
            );
            this.plugin.settings.outputFolder = value;
            console.log('📝 Plugin settings after change:', this.plugin.settings);
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Organization')
      .setDesc('How to organize messages (daily, weekly, monthly, or yearly)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('daily', 'Daily')
          .addOption('weekly', 'Weekly')
          .addOption('monthly', 'Monthly')
          .addOption('yearly', 'Yearly')
          .setValue(this.plugin.settings.organization)
          .onChange(async (value) => {
            console.log(
              '📝 Organization changed from:',
              this.plugin.settings.organization,
              'to:',
              value
            );
            this.plugin.settings.organization = value as 'daily' | 'weekly' | 'monthly' | 'yearly';
            console.log('📝 Plugin settings after change:', this.plugin.settings);
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto sync')
      .setDesc('Automatically sync messages at regular intervals')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Sync interval')
      .setDesc('How often to sync messages (in minutes)')
      .addText((text) =>
        text
          .setPlaceholder('60')
          .setValue(String(this.plugin.settings.syncInterval))
          .onChange(async (value) => {
            const interval = parseInt(value);
            if (!Number.isNaN(interval) && interval > 0) {
              this.plugin.settings.syncInterval = interval;
              await this.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Show notifications')
      .setDesc('Show notifications when sync starts and completes')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showNotifications).onChange(async (value) => {
          this.plugin.settings.showNotifications = value;
          await this.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Enable debug logging')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.saveSettings();
        })
      );
  }

  private addSlackConfigurationsSection(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Slack Configurations' });

    // Add new Slack configuration button
    new Setting(containerEl)
      .setName('Add Slack workspace')
      .setDesc('Add a new Slack workspace configuration')
      .addButton((button) =>
        button
          .setButtonText('Add Workspace')
          .setCta()
          .onClick(() => {
            this.addSlackConfig();
          })
      );

    // Display existing Slack configurations
    this.plugin.settings.slackConfigs.forEach((config, index) => {
      this.addSlackConfigSection(config, index);
    });
  }

  private addSlackConfig(): void {
    const newConfig: SlackConfig = {
      id: `slack-${Date.now()}`, // Generate unique ID
      name: `Workspace ${this.plugin.settings.slackConfigs.length + 1}`,
      token: '',
      channels: [],
      output: 'sync/slack/{{channel}}/{{month}}.md',
      schedule: 'manual',
      enabled: true,
      lastSync: null,
    };

    this.plugin.settings.slackConfigs.push(newConfig);
    this.saveSettings();
    this.display(); // Refresh the display
  }

  private addSlackConfigSection(config: SlackConfig, index: number): void {
    const { containerEl } = this;

    // Create a collapsible section for each Slack config
    const configContainer = containerEl.createEl('div', { cls: 'slack-config-container' });
    const configHeading = configContainer.createEl('h4', {
      text: `${config.name} (${config.enabled ? 'Enabled' : 'Disabled'})`,
    });

    new Setting(configContainer)
      .setName('Workspace name')
      .setDesc('Display name for this Slack workspace')
      .addText((text) =>
        text
          .setPlaceholder('My Workspace')
          .setValue(config.name)
          .onChange(async (value) => {
            // Update the config immediately
            if (index >= 0 && index < this.plugin.settings.slackConfigs.length) {
              const config = this.plugin.settings.slackConfigs[index];
              if (config) {
                config.name = value;
                await this.saveSettings();
                // Update only the heading text to show new name
                configHeading.textContent = `${value} (${config.enabled ? 'Enabled' : 'Disabled'})`;
              }
            }
          })
      );

    new Setting(configContainer)
      .setName('Bot token')
      .setDesc('Slack bot token (starts with xoxb-)')
      .addText((text) =>
        text
          .setPlaceholder('xoxb-your-bot-token')
          .setValue(config.token)
          .onChange(async (value) => {
            await this.updateSlackConfig(index, { token: value });
          })
      );

    new Setting(configContainer)
      .setName('Channels')
      .setDesc('Comma-separated list of channel names (without #)')
      .addTextArea((text) =>
        text
          .setPlaceholder('general, random, development')
          .setValue(config.channels.join(', '))
          .onChange(async (value) => {
            const channels = value
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c.length > 0);
            await this.updateSlackConfig(index, { channels });
          })
      );

    new Setting(configContainer)
      .setName('Enabled')
      .setDesc('Enable sync for this workspace')
      .addToggle((toggle) =>
        toggle.setValue(config.enabled).onChange(async (value) => {
          await this.updateSlackConfig(index, { enabled: value });
        })
      );

    new Setting(configContainer)
      .setName('Remove workspace')
      .setDesc('Remove this Slack workspace configuration')
      .addButton((button) =>
        button
          .setButtonText('Remove')
          .setWarning()
          .onClick(() => {
            this.removeSlackConfig(index);
          })
      );

    // Show last sync time if available
    if (config.lastSync) {
      const lastSyncEl = configContainer.createEl('div', { cls: 'slack-config-info' });
      lastSyncEl.createEl('small', {
        text: `Last sync: ${new Date(config.lastSync).toLocaleString()}`,
      });
    }
  }

  private async updateSlackConfig(index: number, updates: Partial<SlackConfig>): Promise<void> {
    if (index >= 0 && index < this.plugin.settings.slackConfigs.length) {
      const config = this.plugin.settings.slackConfigs[index];
      if (config) {
        Object.assign(config, updates);
        await this.saveSettings();

        // Only re-render for enabled status changes, not name changes from typing
        // This prevents the input from losing focus while typing
        if (updates.enabled !== undefined) {
          this.display();
        }
      }
    }
  }

  private removeSlackConfig(index: number): void {
    if (index >= 0 && index < this.plugin.settings.slackConfigs.length) {
      this.plugin.settings.slackConfigs.splice(index, 1);
      this.saveSettings();
      this.display(); // Refresh the display
    }
  }

  private addAdvancedSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Advanced Settings' });

    new Setting(containerEl)
      .setName('Export configuration')
      .setDesc('Export current configuration to a file')
      .addButton((button) =>
        button.setButtonText('Export').onClick(async () => {
          try {
            // For now, just export the plugin settings as JSON
            const configData = JSON.stringify(this.plugin.settings, null, 2);
            const fileName = `message-sync-config-${new Date().toISOString().split('T')[0]}.json`;

            // Create the file in the vault
            await this.app.vault.create(fileName, configData);
            new Notice(`Configuration exported to ${fileName}`);
          } catch (error) {
            new Notice(
              `Failed to export configuration: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        })
      );
  }

  private addDangerZoneSection(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Danger Zone', cls: 'danger-zone-heading' });

    const dangerContainer = containerEl.createEl('div', {
      cls: 'danger-zone-container',
      attr: {
        style:
          'border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin-top: 16px; background-color: rgba(220, 38, 38, 0.05);',
      },
    });

    new Setting(dangerContainer)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values (double-click to confirm)')
      .addButton((button) =>
        button
          .setButtonText('Reset All Settings')
          .setWarning()
          .onClick(async () => {
            await this.resetToDefaults();
          })
      );

    new Setting(dangerContainer)
      .setName('Clear all sync data')
      .setDesc('Delete all synchronized message files (double-click to confirm)')
      .addButton((button) =>
        button
          .setButtonText('Clear Sync Data')
          .setWarning()
          .onClick(async () => {
            await this.clearSyncData();
          })
      );

    new Setting(dangerContainer)
      .setName('Force resync')
      .setDesc('Delete all data and re-download all messages (double-click to confirm)')
      .addButton((button) =>
        button
          .setButtonText('Force Resync')
          .setWarning()
          .onClick(async () => {
            await this.forceResync();
          })
      );
  }

  private async resetToDefaults(): Promise<void> {
    try {
      // Reset to defaults
      const defaultSettings = {
        configPath: 'config.yaml',
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily' as const,
        slackConfigs: [],
      };

      this.plugin.settings = defaultSettings;
      await this.saveSettings();
      this.display(); // Refresh the display
      new Notice('Settings reset to defaults');
    } catch (error) {
      new Notice(
        `Failed to reset settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async clearSyncData(): Promise<void> {
    try {
      // Delete all files in the sync folder
      const syncFolder = this.plugin.settings.outputFolder;
      const folder = this.app.vault.getAbstractFileByPath(syncFolder);

      if (folder) {
        await this.app.vault.delete(folder);
        new Notice('All sync data cleared');
      } else {
        new Notice('No sync data found');
      }
    } catch (error) {
      new Notice(
        `Failed to clear sync data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async forceResync(): Promise<void> {
    try {
      // Clear all sync data first
      await this.clearSyncData();

      // Reset last sync timestamps
      for (const config of this.plugin.settings.slackConfigs) {
        config.lastSync = null;
      }

      await this.saveSettings();

      // Start a new sync
      await this.handleSyncNow();

      new Notice('Force resync completed');
    } catch (error) {
      new Notice(
        `Failed to force resync: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async saveSettings(): Promise<void> {
    console.log('🔄 SettingsTab.saveSettings called with plugin settings:', this.plugin.settings);
    await this.plugin.saveSettings();

    // Note: YAML sync is handled by the ConfigurationManager internally
    // We don't need to call it explicitly here
  }
}
