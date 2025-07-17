/**
 * Enhanced Settings Tab for Obsidian Message Sync Plugin
 *
 * Provides a comprehensive UI for managing Slack configurations with proper two-way sync
 * Includes quick actions, danger zone, and real-time synchronization
 */

import type { App } from 'obsidian';
import { Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import { stringify } from 'yaml';
import { ConfigurationManager } from '../config/configuration-manager';
import type MessageSyncPlugin from '../main';
import type { SlackConfig } from '../types';

class ConfirmModal extends Modal {
  private result: boolean = false;
  private message: string;
  private onConfirm: (result: boolean) => void;

  constructor(app: App, message: string, onConfirm: (result: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  override onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Confirm Action' });
    contentEl.createEl('p', { text: this.message });

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const confirmButton = buttonContainer.createEl('button', { text: 'Confirm', cls: 'mod-cta' });
    confirmButton.onclick = () => {
      this.result = true;
      this.close();
    };

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => {
      this.result = false;
      this.close();
    };
  }

  override onClose() {
    this.onConfirm(this.result);
  }
}

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
      const isValid = await this.validateConfiguration();

      if (isValid) {
        new Notice('✅ Configuration is valid!');
      } else {
        new Notice('❌ Configuration has errors. Check console for details.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Validation failed: ${errorMessage}`);
      console.error('Validation failed:', error);
    }
  }

  private async validateConfiguration(): Promise<boolean> {
    let isValid = true;
    const errors: string[] = [];

    // Check if at least one Slack config is enabled
    const enabledConfigs = this.plugin.settings.slackConfigs.filter((config) => config.enabled);
    if (enabledConfigs.length === 0) {
      errors.push('No Slack configurations are enabled');
      isValid = false;
    }

    // Validate each enabled Slack config
    for (const config of enabledConfigs) {
      if (!config.token) {
        errors.push(`Slack workspace "${config.name}" is missing a token`);
        isValid = false;
      }

      if (!config.token.startsWith('xoxb-') && !config.token.startsWith('xoxp-')) {
        errors.push(`Slack workspace "${config.name}" has an invalid token format`);
        isValid = false;
      }

      if (config.channels.length === 0) {
        errors.push(`Slack workspace "${config.name}" has no channels configured`);
        isValid = false;
      }
    }

    // Check output folder
    if (!this.plugin.settings.outputFolder) {
      errors.push('Output folder is not configured');
      isValid = false;
    }

    if (errors.length > 0) {
      console.error('Configuration validation errors:', errors);
    }

    return isValid;
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
              await this.configManager.loadSettings();
              new Notice('Settings loaded from YAML configuration');
              this.display(); // Refresh the settings display
            } catch (error) {
              new Notice(
                `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          })
      );

    new Setting(containerEl)
      .setName('Export to config file')
      .setDesc('Save current settings to the YAML configuration file')
      .addButton((button) =>
        button.setButtonText('Save to YAML').onClick(async () => {
          try {
            await this.configManager.saveSettings(this.plugin.settings);
            new Notice('Settings exported to YAML configuration');
          } catch (error) {
            new Notice(
              `Failed to export settings: ${error instanceof Error ? error.message : String(error)}`
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
            this.plugin.settings.outputFolder = value;
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
            this.plugin.settings.organization = value as 'daily' | 'weekly' | 'monthly' | 'yearly';
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
      id: `config-${Date.now()}`,
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
    configContainer.createEl('h4', {
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
            await this.updateSlackConfig(index, { name: value });
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

        // Update the display to show the new name
        if (updates.name || updates.enabled !== undefined) {
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
            const configYaml = this.configManager.convertSettingsToYaml(this.plugin.settings);
            const yamlString = stringify(configYaml, { indent: 2 });
            const fileName = `message-sync-config-${new Date().toISOString().split('T')[0]}.yaml`;

            // Create the file in the vault
            await this.app.vault.create(fileName, yamlString);
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

    const dangerContainer = containerEl.createEl('div', { cls: 'danger-zone-container' });

    new Setting(dangerContainer)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values')
      .addButton((button) =>
        button
          .setButtonText('Reset All Settings')
          .setWarning()
          .onClick(async () => {
            new ConfirmModal(
              this.app,
              'Are you sure you want to reset all settings to defaults? This cannot be undone.',
              async (confirmed) => {
                if (confirmed) {
                  await this.resetToDefaults();
                }
              }
            ).open();
          })
      );

    new Setting(dangerContainer)
      .setName('Clear all sync data')
      .setDesc('Delete all synchronized message files')
      .addButton((button) =>
        button
          .setButtonText('Clear Sync Data')
          .setWarning()
          .onClick(async () => {
            new ConfirmModal(
              this.app,
              'Are you sure you want to delete all synchronized message files? This cannot be undone.',
              async (confirmed) => {
                if (confirmed) {
                  await this.clearSyncData();
                }
              }
            ).open();
          })
      );

    new Setting(dangerContainer)
      .setName('Force resync')
      .setDesc('Delete all data and re-download all messages')
      .addButton((button) =>
        button
          .setButtonText('Force Resync')
          .setWarning()
          .onClick(async () => {
            new ConfirmModal(
              this.app,
              'Are you sure you want to delete all data and re-download? This will take a long time and cannot be undone.',
              async (confirmed) => {
                if (confirmed) {
                  await this.forceResync();
                }
              }
            ).open();
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
    await this.plugin.saveSettings();

    // Also save to YAML config
    try {
      await this.configManager.saveSettings(this.plugin.settings);
    } catch (error) {
      console.warn('Failed to save to YAML config:', error);
    }
  }
}
