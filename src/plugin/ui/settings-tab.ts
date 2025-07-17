import { type App, PluginSettingTab } from 'obsidian';
import type MessageSyncPlugin from '../main';
import { PluginConfigurationAdapter } from '../plugin-config-adapter';
import { AdvancedSettings } from './advanced-settings';
import { OnboardingSettings } from './onboarding-settings';

export class MessageSyncSettingsTab extends PluginSettingTab {
  plugin: MessageSyncPlugin;
  private configAdapter: PluginConfigurationAdapter;
  private onboardingSettings: OnboardingSettings;
  private advancedSettings: AdvancedSettings;

  constructor(app: App, plugin: MessageSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.configAdapter = new PluginConfigurationAdapter(app, plugin.settings, plugin);
    this.onboardingSettings = new OnboardingSettings(app, plugin, this.configAdapter);
    this.advancedSettings = new AdvancedSettings(app, plugin, this.configAdapter, async () => {
      await this.refresh();
    });

    // Set up callback to refresh when onboarding is complete
    this.onboardingSettings.setOnConfigurationComplete(async () => {
      await this.refresh();
    });
  }

  async display(): Promise<void> {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h1', { text: 'Message Sync Settings' });

    // Check if user has existing configuration
    const analysis = await this.configAdapter.getConfigurationAnalysis();
    const hasExistingConfig = analysis.isValid || analysis.summary?.hasValidTokens;

    // Debug information (only show if no config exists)
    if (!hasExistingConfig) {
      const debugInfo = containerEl.createEl('details');
      debugInfo.createEl('summary', { text: '🔍 Configuration Analysis' });
      const debugContent = debugInfo.createEl('pre');
      debugContent.textContent = JSON.stringify(analysis, null, 2);
    }

    if (!hasExistingConfig) {
      // Show onboarding wizard for new users
      const onboardingContainer = containerEl.createDiv({ cls: 'onboarding-container' });
      await this.onboardingSettings.display(onboardingContainer);
    } else {
      // Show advanced interface for configured users
      const advancedContainer = containerEl.createDiv({ cls: 'advanced-container' });
      await this.advancedSettings.display(advancedContainer);
    }
  }

  /**
   * Force refresh of the settings display
   */
  async refresh(): Promise<void> {
    // Add debug info to verify refresh is working
    const debugRefresh = this.containerEl.createEl('div', {
      cls: 'debug-refresh',
      text: `🔄 Refreshed at ${new Date().toLocaleTimeString()}`,
    });
    setTimeout(() => debugRefresh.remove(), 2000);

    await this.display();
  }
}
