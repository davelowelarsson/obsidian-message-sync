/**
 * Enhanced UI Components for Message Sync Plugin
 */

import type { ButtonComponent, ToggleComponent } from 'obsidian';
import { Setting } from 'obsidian';

export const UI_CONSTANTS = {
  colors: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    muted: 'var(--text-muted)',
    primary: 'var(--text-normal)',
    accent: 'var(--color-accent)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  typography: {
    small: '0.8em',
    normal: '1em',
    large: '1.1em',
    heading: '1.2em',
  },
};

export const CSS_CLASSES = {
  card: 'message-sync-card',
  cardHeader: 'message-sync-card-header',
  cardContent: 'message-sync-card-content',
  statusIndicator: 'message-sync-status',
  channelGrid: 'message-sync-channel-grid',
  channelItem: 'message-sync-channel-item',
  progressBar: 'message-sync-progress',
  button: 'message-sync-button',
  toggle: 'message-sync-toggle',
};

export class SettingsCard {
  private element: HTMLElement;
  private contentEl: HTMLElement;

  constructor(parent: HTMLElement, title: string, description?: string) {
    this.element = parent.createEl('div', { cls: CSS_CLASSES.card });

    const headerEl = this.element.createEl('div', { cls: CSS_CLASSES.cardHeader });
    headerEl.createEl('h3', { text: title });

    if (description) {
      this.element.createEl('p', { text: description });
    }

    this.contentEl = this.element.createEl('div', { cls: CSS_CLASSES.cardContent });
  }

  getContent(): HTMLElement {
    return this.contentEl;
  }

  addDivider(): void {
    this.contentEl.createEl('hr');
  }

  addStatusIndicator(type: 'success' | 'warning' | 'error' | 'info', message: string): HTMLElement {
    const statusEl = this.contentEl.createEl('div', { cls: CSS_CLASSES.statusIndicator });
    statusEl.addClass(`status-${type}`);
    statusEl.createEl('span', { text: message });
    return statusEl;
  }
}

export class EnhancedToggle {
  private setting: Setting;
  private toggle!: ToggleComponent;
  private statusEl: HTMLElement;

  constructor(
    parent: HTMLElement,
    name: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => Promise<void>
  ) {
    this.setting = new Setting(parent)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) => {
        this.toggle = toggle;
        toggle.setValue(value);
        toggle.onChange(async (newValue) => {
          this.updateStatus(newValue);
          await onChange(newValue);
        });
      });

    this.statusEl = this.setting.settingEl.createEl('span', { cls: 'toggle-status' });
    this.updateStatus(value);
  }

  private updateStatus(enabled: boolean): void {
    this.statusEl.setText(enabled ? '(Enabled)' : '(Disabled)');
    this.statusEl.removeClass('status-enabled', 'status-disabled');
    this.statusEl.addClass(enabled ? 'status-enabled' : 'status-disabled');
  }

  setValue(value: boolean): void {
    this.toggle.setValue(value);
    this.updateStatus(value);
  }

  getValue(): boolean {
    return this.toggle.getValue();
  }
}

export class EnhancedButton {
  private button!: ButtonComponent;
  private originalText: string;
  private isLoading = false;

  constructor(parent: HTMLElement, text: string, onClick: () => Promise<void>) {
    this.originalText = text;

    new Setting(parent).addButton((button) => {
      this.button = button;
      button.setButtonText(text);
      button.onClick(async () => {
        if (this.isLoading) return;

        this.setLoading(true);
        try {
          await onClick();
          this.setSuccess();
        } catch {
          this.setError();
          // Error handling - could be logged to plugin's error system
        } finally {
          setTimeout(() => this.reset(), 2000);
        }
      });
    });
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    if (loading) {
      this.button.setButtonText('Loading...');
      this.button.setDisabled(true);
    }
  }

  private setSuccess(): void {
    this.button.setButtonText('✓ Success');
    this.button.buttonEl.addClass('mod-success');
  }

  private setError(): void {
    this.button.setButtonText('✗ Error');
    this.button.buttonEl.addClass('mod-error');
  }

  private reset(): void {
    this.isLoading = false;
    this.button.setButtonText(this.originalText);
    this.button.setDisabled(false);
    this.button.buttonEl.removeClass('mod-success', 'mod-error');
  }
}

export const UIUtils = {
  formatSyncResults(result: {
    messageCount: number;
    filesCreated: number;
    errors: string[];
  }): string {
    if (result.errors.length > 0) {
      return `⚠ ${result.messageCount} messages, ${result.errors.length} errors`;
    }
    return `✓ ${result.messageCount} messages, ${result.filesCreated} files`;
  },

  getConfigStatusClass(valid: boolean): string {
    return valid ? 'status-success' : 'status-error';
  },

  createSection(parent: HTMLElement, title: string, description?: string): HTMLElement {
    const section = parent.createEl('div', { cls: 'settings-section' });
    section.createEl('h2', { text: title });
    if (description) {
      section.createEl('p', { text: description });
    }
    return section;
  },

  createLoadingIndicator(parent: HTMLElement, text = 'Loading...'): HTMLElement {
    const indicator = parent.createEl('div', { cls: 'loading-indicator' });
    indicator.createEl('span', { text });
    return indicator;
  },

  debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: unknown[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  },

  validateInput(value: string, type: 'email' | 'url' | 'number' | 'required'): boolean {
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'number':
        return !Number.isNaN(Number(value));
      case 'required':
        return value.trim().length > 0;
      default:
        return true;
    }
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  },

  formatDate(date: Date): string {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
};
