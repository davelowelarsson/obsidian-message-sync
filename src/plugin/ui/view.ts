import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type MessageSyncPlugin from '../main';
import type { MessageSyncViewState } from '../types';

export const VIEW_TYPE_MESSAGE_SYNC = 'message-sync-view';

export class MessageSyncView extends ItemView {
  private plugin: MessageSyncPlugin;
  private state: MessageSyncViewState;

  constructor(leaf: WorkspaceLeaf, plugin: MessageSyncPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.state = {
      isLoading: false,
      lastSync: null,
      totalMessages: 0,
      recentActivity: [],
    };
  }

  getViewType(): string {
    return VIEW_TYPE_MESSAGE_SYNC;
  }

  getDisplayText(): string {
    return 'Message Sync';
  }

  override getIcon(): string {
    return 'refresh-cw';
  }

  override async onOpen(): Promise<void> {
    this.render();
  }

  override async onClose(): Promise<void> {
    // Cleanup if needed
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Header
    const headerEl = contentEl.createEl('div', { cls: 'message-sync-header' });
    headerEl.createEl('h2', { text: 'Message Sync' });

    // Status section
    const statusEl = contentEl.createEl('div', { cls: 'message-sync-status' });
    statusEl.createEl('h3', { text: 'Status' });

    if (this.state.isLoading) {
      statusEl.createEl('p', { text: '🔄 Syncing...', cls: 'message-sync-loading' });
    } else {
      statusEl.createEl('p', {
        text: this.state.lastSync
          ? `✓ Last sync: ${this.state.lastSync.toLocaleString()}`
          : '⏸ No sync yet',
        cls: 'message-sync-last-sync',
      });
    }

    // Quick actions
    const actionsEl = contentEl.createEl('div', { cls: 'message-sync-actions' });
    actionsEl.createEl('h3', { text: 'Actions' });

    const syncButton = actionsEl.createEl('button', {
      text: 'Sync Now',
      cls: 'mod-cta message-sync-sync-button',
    });
    syncButton.addEventListener('click', async () => {
      await this.handleSync();
    });

    const configButton = actionsEl.createEl('button', {
      text: 'Open Settings',
      cls: 'message-sync-config-button',
    });
    configButton.addEventListener('click', () => {
      // Open settings - this is a workaround for the missing setting property
      (
        this.plugin.app as { setting?: { openTabById?: (id: string) => void } }
      ).setting?.openTabById?.('message-sync');
    });

    // Configuration info
    const configEl = contentEl.createEl('div', { cls: 'message-sync-config' });
    configEl.createEl('h3', { text: 'Configuration' });

    this.renderConfigInfo(configEl);

    // Recent activity
    const activityEl = contentEl.createEl('div', { cls: 'message-sync-activity' });
    activityEl.createEl('h3', { text: 'Recent Activity' });

    if (this.state.recentActivity.length === 0) {
      activityEl.createEl('p', { text: 'No recent activity', cls: 'message-sync-no-activity' });
    } else {
      const activityList = activityEl.createEl('ul', { cls: 'message-sync-activity-list' });
      for (const activity of this.state.recentActivity.slice(-10)) {
        const li = activityList.createEl('li', { cls: 'message-sync-activity-item' });
        li.createEl('span', {
          text: activity.timestamp.toLocaleTimeString(),
          cls: 'message-sync-activity-time',
        });
        li.createEl('span', {
          text: activity.message,
          cls: `message-sync-activity-${activity.type}`,
        });
        if (activity.details) {
          li.createEl('div', { text: activity.details, cls: 'message-sync-activity-details' });
        }
      }
    }

    // CLI Integration section
    const cliEl = contentEl.createEl('div', { cls: 'message-sync-cli' });
    cliEl.createEl('h3', { text: 'CLI Integration' });

    const cliInfo = cliEl.createEl('div', { cls: 'message-sync-cli-info' });
    cliInfo.createEl('p', { text: 'This plugin shares the same configuration as the CLI tool.' });
    cliInfo.createEl('p', { text: 'You can use both the plugin and CLI interchangeably.' });

    // CLI commands reference
    const cliCommands = cliEl.createEl('div', { cls: 'message-sync-cli-commands' });
    cliCommands.createEl('h4', { text: 'Useful CLI Commands' });

    const commandList = cliCommands.createEl('ul');
    const commands = [
      { cmd: 'obsidian-sync status', desc: 'Check sync status and configuration' },
      { cmd: 'obsidian-sync sync --all-channels', desc: 'Sync all channels' },
      { cmd: 'obsidian-sync sync --channel <channel-id>', desc: 'Sync specific channel' },
      { cmd: 'obsidian-sync sync --since <date>', desc: 'Sync messages since date' },
      { cmd: 'obsidian-sync config --validate', desc: 'Validate configuration' },
    ];

    for (const { cmd, desc } of commands) {
      const li = commandList.createEl('li');
      li.createEl('code', { text: cmd });
      li.createEl('span', { text: ` - ${desc}` });
    }
  }

  private async renderConfigInfo(container: HTMLElement): Promise<void> {
    try {
      const status = await this.plugin.service.getConfigStatus();

      if (status.valid) {
        container.createEl('p', {
          text: `✓ Configuration valid`,
          cls: 'message-sync-config-valid',
        });
        container.createEl('p', {
          text: `Path: ${status.path}`,
          cls: 'message-sync-config-path',
        });
      } else {
        container.createEl('p', {
          text: `✗ Configuration invalid: ${status.error}`,
          cls: 'message-sync-config-invalid',
        });
      }
    } catch {
      container.createEl('p', {
        text: `✗ Failed to check configuration`,
        cls: 'message-sync-config-error',
      });
    }
  }

  private async handleSync(): Promise<void> {
    if (this.state.isLoading) return;

    this.state.isLoading = true;
    this.addActivity('sync', 'Sync started');
    this.render();

    try {
      const result = await this.plugin.service.sync();

      this.state.lastSync = new Date();
      this.state.totalMessages += result.messageCount;

      if (result.errors.length === 0) {
        this.addActivity(
          'sync',
          `Sync completed: ${result.messageCount} messages, ${result.filesCreated} files created`
        );
      } else {
        this.addActivity('error', `Sync completed with ${result.errors.length} errors`);
        for (const error of result.errors.slice(0, 3)) {
          this.addActivity('error', error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addActivity('error', `Sync failed: ${errorMessage}`);
    } finally {
      this.state.isLoading = false;
      this.render();
    }
  }

  private addActivity(type: 'sync' | 'error' | 'config', message: string, details?: string): void {
    const activity: import('../types').ActivityItem = {
      timestamp: new Date(),
      type,
      message,
    };

    if (details) {
      activity.details = details;
    }

    this.state.recentActivity.push(activity);

    // Keep only last 50 activities
    if (this.state.recentActivity.length > 50) {
      this.state.recentActivity = this.state.recentActivity.slice(-50);
    }
  }
}
