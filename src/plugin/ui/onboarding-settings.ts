import { type App, Notice, Setting } from 'obsidian';
import type MessageSyncPlugin from '../main';
import type { PluginConfigurationAdapter } from '../plugin-config-adapter';
import { EnhancedButton, SettingsCard } from './ui-components';

export interface OnboardingData {
  sources: string[];
  schedule: string;
  outputPath: string;
  slackBotToken?: string | undefined;
  slackUserToken?: string | undefined;
  slackChannels?: string[];
}

export class OnboardingSettings {
  private app: App;
  private plugin: MessageSyncPlugin;
  private configAdapter: PluginConfigurationAdapter;
  private currentStep = 1;
  private containerEl!: HTMLElement;
  private onConfigurationComplete?: () => Promise<void>;

  private onboardingData: OnboardingData = {
    sources: [],
    schedule: 'manual',
    outputPath: 'sync',
  };

  constructor(app: App, plugin: MessageSyncPlugin, configAdapter: PluginConfigurationAdapter) {
    this.app = app;
    this.plugin = plugin;
    this.configAdapter = configAdapter;
  }

  /**
   * Set callback for when configuration is complete
   */
  setOnConfigurationComplete(callback: () => Promise<void>): void {
    this.onConfigurationComplete = callback;
  }

  /**
   * Display the onboarding wizard
   */
  async display(containerEl: HTMLElement): Promise<void> {
    this.containerEl = containerEl;

    // Clear only the onboarding container
    containerEl.empty();

    const wizardCard = new SettingsCard(
      containerEl,
      '🚀 Welcome to Message Sync',
      "Let's set up your first sync configuration in just a few steps"
    );

    const content = wizardCard.getContent();

    // Progress indicator
    this.displayProgressIndicator(content);

    // Step content
    switch (this.currentStep) {
      case 1:
        await this.displayStep1_ChooseSource(content);
        break;
      case 2:
        await this.displayStep2_ConfigureSource(content);
        break;
      case 3:
        await this.displayStep3_ChooseSchedule(content);
        break;
      case 4:
        await this.displayStep4_ChooseOutput(content);
        break;
      case 5:
        await this.displayStep5_Review(content);
        break;
      default:
        this.currentStep = 1;
        await this.displayStep1_ChooseSource(content);
    }
  }

  /**
   * Display progress indicator for the wizard
   */
  private displayProgressIndicator(content: HTMLElement): void {
    const progressContainer = content.createEl('div', { cls: 'onboarding-progress' });

    const steps = [
      { number: 1, title: 'Choose Source', icon: '📱' },
      { number: 2, title: 'Configure', icon: '⚙️' },
      { number: 3, title: 'Schedule', icon: '⏰' },
      { number: 4, title: 'Output', icon: '📂' },
      { number: 5, title: 'Review', icon: '✅' },
    ];

    steps.forEach((step, index) => {
      const stepEl = progressContainer.createEl('div', {
        cls: `progress-step ${this.currentStep === step.number ? 'active' : ''} ${this.currentStep > step.number ? 'completed' : ''}`,
      });

      stepEl.createEl('div', { cls: 'step-icon', text: step.icon });
      stepEl.createEl('div', { cls: 'step-number', text: step.number.toString() });
      stepEl.createEl('div', { cls: 'step-title', text: step.title });

      if (index < steps.length - 1) {
        progressContainer.createEl('div', { cls: 'step-connector' });
      }
    });
  }

  /**
   * Step 1: Choose what to sync
   */
  private async displayStep1_ChooseSource(content: HTMLElement): Promise<void> {
    const stepContainer = content.createEl('div', { cls: 'onboarding-step' });

    stepContainer.createEl('h2', { text: '📱 What would you like to sync?' });
    stepContainer.createEl('p', {
      text: 'Select the message sources you want to sync to Obsidian',
    });

    const sourcesContainer = stepContainer.createEl('div', { cls: 'source-options' });

    // Slack option
    const slackOption = sourcesContainer.createEl('div', { cls: 'source-option' });
    slackOption.createEl('div', { cls: 'source-icon', text: '💬' });
    slackOption.createEl('h3', { text: 'Slack' });
    slackOption.createEl('p', { text: 'Sync messages from Slack channels and DMs' });

    const slackCheckbox = slackOption.createEl('input', { type: 'checkbox' });
    slackCheckbox.checked = this.onboardingData.sources.includes('slack');
    slackCheckbox.addEventListener('change', () => {
      if (slackCheckbox.checked) {
        if (!this.onboardingData.sources.includes('slack')) {
          this.onboardingData.sources.push('slack');
        }
      } else {
        this.onboardingData.sources = this.onboardingData.sources.filter((s) => s !== 'slack');
      }
    });

    // Navigation buttons
    const buttonContainer = stepContainer.createEl('div', { cls: 'step-buttons' });

    new EnhancedButton(buttonContainer, 'Next: Configure →', async () => {
      if (this.onboardingData.sources.length === 0) {
        new Notice('Please select at least one source to continue');
        return;
      }
      this.currentStep = 2;
      await this.display(this.containerEl);
    });
  }

  /**
   * Step 2: Configure the selected source
   */
  private async displayStep2_ConfigureSource(content: HTMLElement): Promise<void> {
    const stepContainer = content.createEl('div', { cls: 'onboarding-step' });

    if (this.onboardingData.sources.includes('slack')) {
      stepContainer.createEl('h2', { text: '⚙️ Configure Slack' });
      stepContainer.createEl('p', {
        text: 'Provide your Slack token to connect to your workspace',
      });

      const tokenSection = stepContainer.createEl('div', { cls: 'config-section' });

      const tokenHelp = tokenSection.createEl('div', { cls: 'token-help' });
      tokenHelp.createEl('p', { text: 'Get your token from https://api.slack.com/apps' });
      tokenHelp.createEl('p', { text: 'Accepts both bot tokens (xoxb-) and user tokens (xoxp-)' });

      new Setting(tokenSection)
        .setName('Slack Token')
        .setDesc('Your Slack bot token (xoxb-) or user token (xoxp-)')
        .addText((text) => {
          text.setPlaceholder('xoxb-your-token-here or xoxp-your-token-here');
          text.setValue(
            this.onboardingData.slackBotToken || this.onboardingData.slackUserToken || ''
          );
          text.onChange(async (value) => {
            // Auto-detect token type and store appropriately
            if (value.startsWith('xoxb-')) {
              this.onboardingData.slackBotToken = value;
              this.onboardingData.slackUserToken = undefined;
            } else if (value.startsWith('xoxp-')) {
              this.onboardingData.slackUserToken = value;
              this.onboardingData.slackBotToken = undefined;
            } else {
              // For non-prefixed tokens, store as bot token by default
              this.onboardingData.slackBotToken = value;
              this.onboardingData.slackUserToken = undefined;
            }
          });
        });

      const channelSection = stepContainer.createEl('div', { cls: 'config-section' });
      channelSection.createEl('h3', { text: '📺 Channels to Sync' });

      new Setting(channelSection)
        .setName('Channel Names')
        .setDesc('Enter channel names separated by commas (e.g., general, random)')
        .addText((text) => {
          text.setPlaceholder('general, random');
          text.setValue(this.onboardingData.slackChannels?.join(', ') || '');
          text.onChange(async (value) => {
            this.onboardingData.slackChannels = value
              .split(',')
              .map((c) => c.trim())
              .filter((c) => c);
          });
        });
    }

    // Navigation buttons
    const buttonContainer = stepContainer.createEl('div', { cls: 'step-buttons' });

    new EnhancedButton(buttonContainer, '← Back', async () => {
      this.currentStep = 1;
      await this.display(this.containerEl);
    });

    new EnhancedButton(buttonContainer, 'Next: Schedule →', async () => {
      if (this.onboardingData.sources.includes('slack')) {
        const hasBotToken =
          this.onboardingData.slackBotToken && this.onboardingData.slackBotToken.trim().length > 0;
        const hasUserToken =
          this.onboardingData.slackUserToken &&
          this.onboardingData.slackUserToken.trim().length > 0;

        if (!hasBotToken && !hasUserToken) {
          new Notice('Please enter at least one Slack token (bot or user)');
          return;
        }

        if (!this.onboardingData.slackChannels || this.onboardingData.slackChannels.length === 0) {
          new Notice('Please enter at least one channel name');
          return;
        }
      }
      this.currentStep = 3;
      await this.display(this.containerEl);
    });
  }

  /**
   * Step 3: Choose sync schedule
   */
  private async displayStep3_ChooseSchedule(content: HTMLElement): Promise<void> {
    const stepContainer = content.createEl('div', { cls: 'onboarding-step' });

    stepContainer.createEl('h2', { text: '⏰ How often should we sync?' });
    stepContainer.createEl('p', { text: 'Choose when to sync your messages' });

    const scheduleContainer = stepContainer.createEl('div', { cls: 'schedule-options' });

    const scheduleOptions = [
      {
        value: 'manual',
        icon: '👆',
        title: 'Manual Sync',
        desc: 'Sync only when you click the sync button',
      },
      { value: 'hourly', icon: '⏰', title: 'Every Hour', desc: 'Automatically sync every hour' },
      { value: 'daily', icon: '📅', title: 'Daily', desc: 'Automatically sync once per day' },
    ];

    scheduleOptions.forEach((option) => {
      const optionEl = scheduleContainer.createEl('div', { cls: 'schedule-option' });
      optionEl.createEl('div', { cls: 'schedule-icon', text: option.icon });
      optionEl.createEl('h3', { text: option.title });
      optionEl.createEl('p', { text: option.desc });

      const radio = optionEl.createEl('input', { type: 'radio', value: option.value });
      radio.name = 'schedule';
      radio.checked = this.onboardingData.schedule === option.value;
      radio.addEventListener('change', () => {
        this.onboardingData.schedule = option.value;
      });
    });

    // Navigation buttons
    const buttonContainer = stepContainer.createEl('div', { cls: 'step-buttons' });

    new EnhancedButton(buttonContainer, '← Back', async () => {
      this.currentStep = 2;
      await this.display(this.containerEl);
    });

    new EnhancedButton(buttonContainer, 'Next: Output →', async () => {
      this.currentStep = 4;
      await this.display(this.containerEl);
    });
  }

  /**
   * Step 4: Choose output location
   */
  private async displayStep4_ChooseOutput(content: HTMLElement): Promise<void> {
    const stepContainer = content.createEl('div', { cls: 'onboarding-step' });

    stepContainer.createEl('h2', { text: '📂 Where should we save synced messages?' });
    stepContainer.createEl('p', { text: 'Choose where to store your synchronized messages' });

    const outputSection = stepContainer.createEl('div', { cls: 'output-section' });

    new Setting(outputSection)
      .setName('Output Folder')
      .setDesc('Folder name where synced messages will be saved (relative to your vault)')
      .addText((text) => {
        text.setPlaceholder('sync');
        text.setValue(this.onboardingData.outputPath);
        text.onChange(async (value) => {
          this.onboardingData.outputPath = value || 'sync';
        });
      });

    // Navigation buttons
    const buttonContainer = stepContainer.createEl('div', { cls: 'step-buttons' });

    new EnhancedButton(buttonContainer, '← Back', async () => {
      this.currentStep = 3;
      await this.display(this.containerEl);
    });

    new EnhancedButton(buttonContainer, 'Next: Review →', async () => {
      this.currentStep = 5;
      await this.display(this.containerEl);
    });
  }

  /**
   * Step 5: Review and create configuration
   */
  private async displayStep5_Review(content: HTMLElement): Promise<void> {
    const stepContainer = content.createEl('div', { cls: 'onboarding-step' });

    stepContainer.createEl('h2', { text: '✅ Review Your Configuration' });
    stepContainer.createEl('p', { text: 'Review your settings and create your configuration' });

    const reviewContainer = stepContainer.createEl('div', { cls: 'review-container' });

    // Create review sections
    this.createReviewSection(reviewContainer, '📱 Sources', this.onboardingData.sources);
    this.createReviewSection(reviewContainer, '⏰ Schedule', [this.getScheduleText()]);
    this.createReviewSection(reviewContainer, '📂 Output', [
      `Messages will be saved to: ${this.onboardingData.outputPath}/`,
    ]);

    if (this.onboardingData.sources.includes('slack')) {
      this.createSlackReviewSection(reviewContainer);
    }

    // Navigation buttons
    const buttonContainer = stepContainer.createEl('div', { cls: 'step-buttons' });

    new EnhancedButton(buttonContainer, '← Back', async () => {
      this.currentStep = 4;
      await this.display(this.containerEl);
    });

    new EnhancedButton(buttonContainer, '🚀 Create Configuration', async () => {
      await this.createConfigurationFromOnboarding();
    });
  }

  private createReviewSection(container: HTMLElement, title: string, items: string[]): void {
    const section = container.createEl('div', { cls: 'review-section' });
    section.createEl('h3', { text: title });
    items.forEach((item) => {
      section.createEl('p', { text: `• ${item}` });
    });
  }

  private createSlackReviewSection(container: HTMLElement): void {
    const section = container.createEl('div', { cls: 'review-section' });
    section.createEl('h3', { text: '💬 Slack Configuration' });

    const hasBotToken =
      this.onboardingData.slackBotToken && this.onboardingData.slackBotToken.trim().length > 0;
    const hasUserToken =
      this.onboardingData.slackUserToken && this.onboardingData.slackUserToken.trim().length > 0;

    if (hasBotToken) section.createEl('p', { text: 'Bot Token: Configured ✓' });
    if (hasUserToken) section.createEl('p', { text: 'User Token: Configured ✓' });
    if (!hasBotToken && !hasUserToken) section.createEl('p', { text: 'Tokens: Not configured ✗' });

    section.createEl('p', {
      text: `Channels: ${this.onboardingData.slackChannels?.join(', ') || 'None'}`,
    });
  }

  private getScheduleText(): string {
    const scheduleTexts = {
      manual: 'Manual sync only',
      hourly: 'Every hour',
      daily: 'Once per day',
    };
    return (
      scheduleTexts[this.onboardingData.schedule as keyof typeof scheduleTexts] ||
      'Manual sync only'
    );
  }

  /**
   * Create configuration from onboarding data
   */
  private async createConfigurationFromOnboarding(): Promise<void> {
    try {
      if (!this.validateOnboardingData()) {
        return;
      }

      await this.setupConfigPath();
      const configData = this.buildConfigData();
      const success = await this.configAdapter.createConfigFromOnboarding(configData);

      if (success) {
        await this.saveSlackConfigToSettings();
        await this.finalizeConfiguration();
      } else {
        new Notice('❌ Failed to create configuration. Check that the config path is writable.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`❌ Error creating configuration: ${errorMessage}`);
    }
  }

  /**
   * Validate onboarding data has required tokens
   */
  private validateOnboardingData(): boolean {
    const hasToken = this.onboardingData.slackBotToken || this.onboardingData.slackUserToken;
    if (!hasToken) {
      new Notice('❌ Please provide a Slack token to continue');
      return false;
    }
    return true;
  }

  /**
   * Setup configuration file path
   */
  private async setupConfigPath(): Promise<void> {
    const pluginFolder = `${this.app.vault.configDir}/plugins/obsidian-message-sync-dev`;
    this.plugin.settings.configPath = `${pluginFolder}/config.yaml`;
    await this.plugin.saveSettings();
  }

  /**
   * Build configuration data object
   */
  private buildConfigData(): {
    slackBotToken?: string;
    slackUserToken?: string;
    slackChannels?: string[];
    outputPath?: string;
    schedule?: string;
  } {
    const configData: {
      slackBotToken?: string;
      slackUserToken?: string;
      slackChannels?: string[];
      outputPath?: string;
      schedule?: string;
    } = {};

    if (this.onboardingData.slackBotToken) {
      configData.slackBotToken = this.onboardingData.slackBotToken;
    }
    if (this.onboardingData.slackUserToken) {
      configData.slackUserToken = this.onboardingData.slackUserToken;
    }
    if (this.onboardingData.slackChannels) {
      configData.slackChannels = this.onboardingData.slackChannels;
    }
    configData.outputPath = this.onboardingData.outputPath;
    configData.schedule = this.onboardingData.schedule;

    return configData;
  }

  /**
   * Save Slack configuration to plugin settings
   */
  private async saveSlackConfigToSettings(): Promise<void> {
    if (this.onboardingData.sources.includes('slack')) {
      const token = this.onboardingData.slackBotToken || this.onboardingData.slackUserToken;
      if (token) {
        const newSlackConfig = {
          id: `config-${Date.now()}`,
          name: 'Default Slack',
          token: token,
          channels: this.onboardingData.slackChannels || ['general'],
          output: 'sync/slack/{{channel}}/{{month}}.md',
          schedule: 'manual' as const,
          enabled: true,
          lastSync: null,
        };
        this.plugin.settings.slackConfigs = [newSlackConfig];
      }
      await this.plugin.saveSettings();
    }
  }

  /**
   * Finalize configuration setup
   */
  private async finalizeConfiguration(): Promise<void> {
    // Force reload the configuration to ensure it's detected
    this.configAdapter.reloadConfiguration();

    new Notice('🎉 Configuration created successfully!');
    new Notice('Ready to sync! Use the "Sync Now" button to start your first sync.');

    // Reset the onboarding state
    this.resetOnboardingState();

    // Call the configuration complete callback to refresh the parent
    if (this.onConfigurationComplete) {
      await this.onConfigurationComplete();
    }
  }

  private resetOnboardingState(): void {
    this.currentStep = 1;
    this.onboardingData = {
      sources: [],
      schedule: 'manual',
      outputPath: 'sync',
    };
  }

  // Public method to check if configuration was created
  isConfigurationComplete(): boolean {
    return (
      this.plugin.settings.slackConfigs &&
      this.plugin.settings.slackConfigs.length > 0 &&
      this.plugin.settings.configPath !== undefined
    );
  }
}
