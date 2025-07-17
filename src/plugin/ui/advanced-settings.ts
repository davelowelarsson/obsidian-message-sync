import { type App, type ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import type MessageSyncPlugin from '../main';
import type { PluginConfigurationAdapter } from '../plugin-config-adapter';
import { EnhancedButton, SettingsCard } from './ui-components';

export class AdvancedSettings {
  private plugin: MessageSyncPlugin;
  private configAdapter: PluginConfigurationAdapter;
  private refreshCallback: () => void;

  constructor(
    _app: App,
    plugin: MessageSyncPlugin,
    configAdapter: PluginConfigurationAdapter,
    refreshCallback: () => void
  ) {
    this.plugin = plugin;
    this.configAdapter = configAdapter;
    this.refreshCallback = refreshCallback;
  }

  /**
   * Display the advanced interface for configured users
   */
  async display(containerEl: HTMLElement): Promise<void> {
    // Quick actions section
    await this.displayQuickActions(containerEl);

    // Configuration overview
    await this.displayConfigurationOverview(containerEl);

    // Basic plugin settings
    this.displayBasicSettings(containerEl);

    // Advanced sync options
    this.displayAdvancedSyncOptions(containerEl);

    // Danger Zone section
    this.displayDangerZone(containerEl);
  }

  /**
   * Quick actions for configured users
   */
  private async displayQuickActions(containerEl: HTMLElement): Promise<void> {
    const actionsCard = new SettingsCard(
      containerEl,
      '⚡ Quick Actions',
      'Common tasks and actions'
    );

    const content = actionsCard.getContent();
    const actionButtons = content.createEl('div', { cls: 'quick-actions' });

    new EnhancedButton(actionButtons, '🔄 Sync Now', async () => {
      await this.performSync(actionButtons);
    });

    new EnhancedButton(actionButtons, '🔍 Validate Config', async () => {
      await this.validateConfig();
    });

    new EnhancedButton(actionButtons, '📊 View Status', async () => {
      await this.viewStatus();
    });

    new EnhancedButton(actionButtons, '🔧 Reconfigure', async () => {
      await this.reconfigure();
    });
  }

  /**
   * Configuration overview for configured users
   */
  private async displayConfigurationOverview(containerEl: HTMLElement): Promise<void> {
    const overviewCard = new SettingsCard(
      containerEl,
      '📊 Configuration Overview',
      'Current configuration status and summary'
    );

    const content = overviewCard.getContent();
    const analysis = await this.configAdapter.getConfigurationAnalysis();

    if (analysis.summary) {
      const summary = content.createEl('div', { cls: 'config-summary' });

      // Status indicator
      const statusEl = summary.createEl('div', { cls: 'status-indicator' });
      statusEl.createEl('span', {
        cls: `status-badge ${analysis.isValid ? 'valid' : 'invalid'}`,
        text: analysis.isValid ? '✅ Valid' : '❌ Invalid',
      });

      // Configuration details
      const details = summary.createEl('div', { cls: 'config-details' });
      details.createEl('p', { text: `Sources: ${analysis.summary.enabledSourcesCount}` });
      details.createEl('p', {
        text: `Valid tokens: ${analysis.summary.hasValidTokens ? 'Yes' : 'No'}`,
      });
      details.createEl('p', { text: `Config file: ${analysis.summary.configPath || 'Not set'}` });
    }
  }

  /**
   * Basic plugin settings
   */
  private displayBasicSettings(containerEl: HTMLElement): void {
    const basicCard = new SettingsCard(
      containerEl,
      '⚙️ Basic Settings',
      'Configure basic plugin behavior'
    );

    const content = basicCard.getContent();

    // Output folder setting
    new Setting(content)
      .setName('Output folder')
      .setDesc('Folder where synced messages will be stored')
      .addText((text) =>
        text
          .setPlaceholder('sync')
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Auto sync setting
    new Setting(content)
      .setName('Enable auto sync')
      .setDesc('Automatically sync messages at regular intervals')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        })
      );

    // Sync interval setting
    new Setting(content)
      .setName('Sync interval')
      .setDesc('Time between automatic syncs (in minutes)')
      .addText((text) =>
        text
          .setPlaceholder('60')
          .setValue(this.plugin.settings.syncInterval.toString())
          .onChange(async (value) => {
            const interval = parseInt(value);
            if (!Number.isNaN(interval) && interval > 0) {
              this.plugin.settings.syncInterval = interval;
              await this.plugin.saveSettings();
            }
          })
      );

    // Show notifications setting
    new Setting(content)
      .setName('Show notifications')
      .setDesc('Show notifications when sync starts and completes')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showNotifications).onChange(async (value) => {
          this.plugin.settings.showNotifications = value;
          await this.plugin.saveSettings();
        })
      );

    // Debug mode setting
    new Setting(content)
      .setName('Debug mode')
      .setDesc('Enable debug logging to console')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );
  }

  /**
   * Advanced sync options
   */
  private displayAdvancedSyncOptions(containerEl: HTMLElement): void {
    const advancedCard = new SettingsCard(
      containerEl,
      '🚀 Advanced Sync Options',
      'Advanced synchronization settings'
    );

    const content = advancedCard.getContent();

    // Sync since date
    new Setting(content)
      .setName('Sync Since Date')
      .setDesc('Sync messages since a specific date')
      .addText((text) => text.setPlaceholder('YYYY-MM-DD').setValue(''))
      .addButton((button) =>
        button.setButtonText('Sync Since').onClick(async () => {
          await this.performSyncSince(button);
        })
      );

    // Organization options
    new Setting(content)
      .setName('Organization')
      .setDesc('How to organize synced messages')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('daily', 'Daily (YYYY/MM/DD)')
          .addOption('monthly', 'Monthly (YYYY/MM)')
          .addOption('yearly', 'Yearly (YYYY)')
          .setValue(this.plugin.settings.organization || 'daily')
          .onChange(async (value) => {
            this.plugin.settings.organization = value as 'daily' | 'monthly' | 'yearly';
            await this.plugin.saveSettings();
          })
      );

    // Config path setting
    new Setting(content)
      .setName('Configuration file path')
      .setDesc('Path to the YAML configuration file')
      .addText((text) =>
        text
          .setPlaceholder('config.yaml')
          .setValue(this.plugin.settings.configPath)
          .onChange(async (value) => {
            this.plugin.settings.configPath = value;
            await this.plugin.saveSettings();
          })
      );
  }

  /**
   * Danger Zone settings
   */
  private displayDangerZone(containerEl: HTMLElement): void {
    const dangerCard = new SettingsCard(
      containerEl,
      '⚠️ Danger Zone',
      'Destructive actions that cannot be undone'
    );

    const content = dangerCard.getContent();

    // Add danger zone styling
    content.addClass('danger-zone');

    // Clear configuration section
    const clearConfigSection = content.createEl('div', { cls: 'danger-section' });

    const clearConfigHeader = clearConfigSection.createEl('div', { cls: 'danger-header' });
    clearConfigHeader.createEl('h3', { text: 'Clear Configuration' });
    clearConfigHeader.createEl('p', {
      text: 'Remove all configuration data and reset to defaults. This will delete your tokens, settings, and config files.',
      cls: 'danger-description',
    });

    const clearConfigActions = clearConfigSection.createEl('div', { cls: 'danger-actions' });

    new Setting(clearConfigActions)
      .setName('Clear all configuration')
      .setDesc('This will remove all plugin settings and configuration files')
      .addButton((button) =>
        button
          .setButtonText('Clear Configuration')
          .setCta()
          .onClick(async () => {
            await this.clearConfiguration();
          })
      );

    // Reset to onboarding section
    const resetSection = content.createEl('div', { cls: 'danger-section' });

    const resetHeader = resetSection.createEl('div', { cls: 'danger-header' });
    resetHeader.createEl('h3', { text: 'Reset to Onboarding' });
    resetHeader.createEl('p', {
      text: 'Keep your configuration files but reset the plugin to show the onboarding wizard.',
      cls: 'danger-description',
    });

    const resetActions = resetSection.createEl('div', { cls: 'danger-actions' });

    new Setting(resetActions)
      .setName('Reset to onboarding')
      .setDesc('This will clear plugin settings but keep configuration files')
      .addButton((button) =>
        button.setButtonText('Reset to Onboarding').onClick(async () => {
          await this.resetToOnboarding();
        })
      );

    // Delete config files section
    const deleteFilesSection = content.createEl('div', { cls: 'danger-section' });

    const deleteFilesHeader = deleteFilesSection.createEl('div', { cls: 'danger-header' });
    deleteFilesHeader.createEl('h3', { text: 'Delete Configuration Files' });
    deleteFilesHeader.createEl('p', {
      text: 'Permanently delete all configuration files (config.yaml, data.json). Plugin settings will remain.',
      cls: 'danger-description',
    });

    const deleteFilesActions = deleteFilesSection.createEl('div', { cls: 'danger-actions' });

    new Setting(deleteFilesActions)
      .setName('Delete configuration files')
      .setDesc('This will permanently delete config.yaml and data.json files')
      .addButton((button) =>
        button
          .setButtonText('Delete Files')
          .setCta()
          .onClick(async () => {
            await this.deleteConfigFiles();
          })
      );

    // Add CSS styles
    this.addDangerZoneStyles(containerEl);
  }

  /**
   * Add danger zone CSS styles
   */
  private addDangerZoneStyles(containerEl: HTMLElement): void {
    const style = containerEl.createEl('style');
    style.textContent = `
      .danger-zone {
        border: 1px solid var(--color-red);
        border-radius: 6px;
        background-color: var(--background-secondary);
      }

      .danger-section {
        padding: 16px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .danger-section:last-child {
        border-bottom: none;
      }

      .danger-header h3 {
        color: var(--color-red);
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .danger-description {
        color: var(--text-muted);
        margin: 0 0 16px 0;
        font-size: 12px;
        line-height: 1.4;
      }

      .danger-actions .setting-item {
        border: none;
        padding: 0;
      }

      .danger-actions .setting-item-control button {
        background-color: var(--color-red);
        color: white;
        border: 1px solid var(--color-red);
      }

      .danger-actions .setting-item-control button:hover {
        background-color: var(--color-red-hover);
        border-color: var(--color-red-hover);
      }
    `;
  }

  /**
   * Clear all configuration data
   */
  private async clearConfiguration(): Promise<void> {
    const confirmed = await this.confirmAction(
      'Are you sure you want to clear all configuration? This will:\n\n' +
        '• Remove all plugin settings\n' +
        '• Delete config.yaml file\n' +
        '• Delete data.json file\n' +
        '• Reset to default onboarding state\n\n' +
        'This action cannot be undone.',
      'Clear Configuration'
    );

    if (!confirmed) return;

    try {
      // Clear plugin settings
      Object.keys(this.plugin.settings).forEach((key) => {
        // @ts-ignore - Dynamic property access for settings reset
        this.plugin.settings[key] = undefined;
      });

      // Reset to default settings
      const defaultSettings = {
        configPath: '',
        autoSync: false,
        syncInterval: 60,
        outputFolder: 'sync',
        showNotifications: true,
        debugMode: false,
        organization: 'daily' as const,
      };

      Object.assign(this.plugin.settings, defaultSettings);

      // Save cleared settings
      await this.plugin.saveSettings();

      // Delete config files
      await this.deleteConfigFiles();

      new Notice('✅ Configuration cleared successfully. Plugin will restart to onboarding.');

      // Refresh the settings tab to show onboarding
      setTimeout(() => {
        this.refreshCallback();
      }, 1000);
    } catch (error) {
      console.error('Failed to clear configuration:', error);
      new Notice('❌ Failed to clear configuration. Check console for details.');
    }
  }

  /**
   * Reset to onboarding state
   */
  private async resetToOnboarding(): Promise<void> {
    const confirmed = await this.confirmAction(
      'Are you sure you want to reset to onboarding? This will:\n\n' +
        '• Clear plugin settings (tokens, etc.)\n' +
        '• Keep configuration files intact\n' +
        '• Show onboarding wizard on next settings open\n\n' +
        'You can reconfigure using existing files.',
      'Reset to Onboarding'
    );

    if (!confirmed) return;

    try {
      // Clear sensitive settings but keep file paths
      if ('slackToken' in this.plugin.settings) {
        this.plugin.settings.slackToken = undefined;
      }
      this.plugin.settings.autoSync = false;

      // Save settings
      await this.plugin.saveSettings();

      new Notice('✅ Reset to onboarding successfully.');

      // Refresh the settings tab to show onboarding
      setTimeout(() => {
        this.refreshCallback();
      }, 1000);
    } catch (error) {
      console.error('Failed to reset to onboarding:', error);
      new Notice('❌ Failed to reset. Check console for details.');
    }
  }

  /**
   * Delete configuration files
   */
  private async deleteConfigFiles(): Promise<void> {
    const confirmed = await this.confirmAction(
      'Are you sure you want to delete configuration files? This will:\n\n' +
        '• Delete config.yaml file\n' +
        '• Delete data.json file\n' +
        '• Keep plugin settings intact\n\n' +
        'This action cannot be undone.',
      'Delete Files'
    );

    if (!confirmed) return;

    try {
      const filesToDelete = [
        '.obsidian/plugins/obsidian-message-sync-dev/config.yaml',
        '.obsidian/plugins/obsidian-message-sync-dev/data.json',
      ];

      for (const filePath of filesToDelete) {
        try {
          if (await this.plugin.app.vault.adapter.exists(filePath)) {
            await this.plugin.app.vault.adapter.remove(filePath);
            console.log(`Deleted: ${filePath}`);
          }
        } catch (error) {
          console.warn(`Failed to delete ${filePath}:`, error);
        }
      }

      new Notice('✅ Configuration files deleted successfully.');
    } catch (error) {
      console.error('Failed to delete configuration files:', error);
      new Notice('❌ Failed to delete files. Check console for details.');
    }
  }

  /**
   * Perform sync operation
   */
  private async performSync(actionButtons: HTMLElement): Promise<void> {
    try {
      new Notice('Starting sync...');

      // Check if we have a token configured
      if (!this.plugin.settings.slackConfigs || this.plugin.settings.slackConfigs.length === 0) {
        new Notice('❌ No Slack configurations found. Please complete the onboarding process.');
        return;
      }

      new Notice('🔄 Starting sync...');

      // Use the plugin's service to perform actual sync
      const result = await this.plugin.service.sync();

      if (result.errors.length > 0) {
        new Notice(`❌ Sync completed with errors: ${result.errors.join(', ')}`);
      } else if (result.messageCount === 0) {
        new Notice('ℹ️ No messages found to sync.');
      } else {
        new Notice(`✅ Successfully synced ${result.messageCount} messages!`);
      }

      // Show success result
      const syncResult = actionButtons.createEl('div', { cls: 'sync-result' });
      syncResult.innerHTML = `
        <h4>✅ Sync Complete</h4>
        <p>📥 Messages processed: ${result.messageCount}</p>
        <p>📄 Files created: ${result.filesCreated}</p>
        <p>📝 Files updated: ${result.filesUpdated}</p>
        ${result.errors.length > 0 ? `<p>⚠️ Errors: ${result.errors.length}</p>` : ''}
      `;

      // Remove result after 10 seconds
      setTimeout(() => {
        syncResult.remove();
      }, 10000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`❌ Sync failed: ${errorMessage}`);
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfig(): Promise<void> {
    const validation = await this.configAdapter.validateConfiguration();
    if (validation.isValid) {
      new Notice('✅ Configuration is valid!');
    } else {
      new Notice('❌ Configuration has errors');
    }
  }

  /**
   * View status
   */
  private async viewStatus(): Promise<void> {
    const analysis = await this.configAdapter.getConfigurationAnalysis();
    new Notice(`Config status: ${analysis.isValid ? 'Valid' : 'Invalid'}`);
  }

  /**
   * Reconfigure - triggers onboarding restart
   */
  private async reconfigure(): Promise<void> {
    new Notice('Starting reconfiguration...');
    // This will be handled by the parent settings tab to switch back to onboarding
    // For now, just show a notice
    new Notice('Please restart the plugin to reconfigure');
  }

  /**
   * Perform sync since date
   */
  private async performSyncSince(button: ButtonComponent): Promise<void> {
    // Find the parent element and get the input
    const inputEl = button.buttonEl.parentElement?.querySelector(
      'input[type="text"]'
    ) as HTMLElement & { value: string };
    const dateValue = inputEl?.value || '';

    if (!dateValue) {
      button.setButtonText('No date');
      setTimeout(() => {
        button.setButtonText('Sync Since');
      }, 2000);
      return;
    }

    const sinceDate = new Date(dateValue);
    if (Number.isNaN(sinceDate.getTime())) {
      button.setButtonText('Invalid date');
      setTimeout(() => {
        button.setButtonText('Sync Since');
      }, 2000);
      return;
    }

    button.setButtonText('Syncing...');
    try {
      const result = await this.plugin.service.syncSince(sinceDate);
      if (result.errors.length === 0) {
        button.setButtonText('✓ Synced');
      } else {
        button.setButtonText('✗ Errors');
      }
      setTimeout(() => {
        button.setButtonText('Sync Since');
      }, 3000);
    } catch {
      button.setButtonText('✗ Failed');
      setTimeout(() => {
        button.setButtonText('Sync Since');
      }, 2000);
    }
  }

  /**
   * Show confirmation dialog
   */
  private async confirmAction(message: string, actionName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmationModal(this.plugin.app, message, actionName, resolve);
      modal.open();
    });
  }
}

/**
 * Simple confirmation modal
 */
class ConfirmationModal extends Modal {
  private message: string;
  private actionName: string;
  private resolve: (confirmed: boolean) => void;

  constructor(
    app: App,
    message: string,
    actionName: string,
    resolve: (confirmed: boolean) => void
  ) {
    super(app);
    this.message = message;
    this.actionName = actionName;
    this.resolve = resolve;
  }

  override onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Confirm Action' });

    const messageEl = contentEl.createEl('div', { cls: 'confirmation-message' });
    messageEl.style.whiteSpace = 'pre-line';
    messageEl.style.marginBottom = '20px';
    messageEl.textContent = this.message;

    const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'flex-end';

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => {
      this.resolve(false);
      this.close();
    });

    const confirmButton = buttonContainer.createEl('button', { text: this.actionName });
    confirmButton.style.backgroundColor = 'var(--color-red)';
    confirmButton.style.color = 'white';
    confirmButton.addEventListener('click', () => {
      this.resolve(true);
      this.close();
    });
  }

  override onClose() {
    this.resolve(false);
  }
}
