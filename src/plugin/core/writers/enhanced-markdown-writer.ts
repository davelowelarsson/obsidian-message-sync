import { dirname } from 'node:path';
import { type App, normalizePath, TFile, type Vault } from 'obsidian';
import type { SlackChannel, SlackMessage, SlackUser } from '../../../types/slack';
import {
  type ConversionOptions,
  type UniversalMessage,
  UniversalMessageConverter,
} from '../utils/message-converter';
import { sanitizeFilename, validateVaultPath } from '../utils/security';
import { TemplateResolver } from '../utils/template-resolver';

/**
 * Enhanced markdown writer for Obsidian plugin
 * Converts messages to beautifully formatted markdown files
 */
export class EnhancedMarkdownWriter {
  private userCache = new Map<string, SlackUser>();
  private channelCache = new Map<string, SlackChannel>();
  private messageConverter: UniversalMessageConverter;
  private templateResolver: TemplateResolver;
  private options: Required<MarkdownWriterOptions>;

  constructor(
    private app: App,
    private vault: Vault,
    options: MarkdownWriterOptions = {}
  ) {
    this.messageConverter = new UniversalMessageConverter();
    this.templateResolver = new TemplateResolver({
      channelNameFormat: 'name',
      sanitizeFilenames: true,
    });

    // Set default options
    this.options = {
      includeAttachments: options.includeAttachments ?? true,
      includeFiles: options.includeFiles ?? true,
      includeReactions: options.includeReactions ?? true,
      includeThreads: options.includeThreads ?? true,
      groupByDate: options.groupByDate ?? true,
      dateFormat: options.dateFormat ?? 'YYYY-MM-DD',
      outputDir: options.outputDir ?? 'slack-sync',
      filenameTemplate: options.filenameTemplate ?? '{{channelName}}-{{date}}',
      messagesPerFile: options.messagesPerFile ?? 1000,
      enableTableView: options.enableTableView ?? false,
      customTemplate: options.customTemplate ?? '',
    };
  }

  /**
   * Write messages to markdown files
   */
  async writeMessages(
    messages: SlackMessage[],
    channel: SlackChannel,
    users: SlackUser[] = []
  ): Promise<string[]> {
    // Update caches
    this.updateUserCache(users);
    this.channelCache.set(channel.id, channel);

    // Group messages by date if enabled
    const messageGroups = this.options.groupByDate
      ? this.groupMessagesByDate(messages)
      : new Map([[this.formatDate(new Date()), messages]]);

    const createdFiles: string[] = [];

    for (const [dateKey, dateMessages] of messageGroups) {
      const filePath = this.generateFilePath(channel, dateKey);
      const content = await this.createMarkdownContent(dateMessages, channel, dateKey);

      await this.writeToVault(filePath, content);
      createdFiles.push(filePath);
    }

    return createdFiles;
  }

  /**
   * Append messages to existing file
   */
  async appendMessages(
    messages: SlackMessage[],
    channel: SlackChannel,
    users: SlackUser[] = []
  ): Promise<string> {
    this.updateUserCache(users);
    this.channelCache.set(channel.id, channel);

    const dateKey = this.formatDate(new Date());
    const filePath = this.generateFilePath(channel, dateKey);
    const newContent = await this.createMarkdownContent(messages, channel, dateKey, true);

    // Check if file exists
    const existingFile = this.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      const existingContent = await this.vault.read(existingFile);
      const updatedContent = this.mergeMarkdownContent(existingContent, newContent);
      await this.vault.modify(existingFile, updatedContent);
    } else {
      await this.writeToVault(filePath, newContent);
    }

    return filePath;
  }

  /**
   * Create markdown content from messages
   */
  private async createMarkdownContent(
    messages: SlackMessage[],
    channel: SlackChannel,
    dateKey: string,
    isAppend = false
  ): Promise<string> {
    const parts: string[] = [];

    if (!isAppend) {
      // Add file header
      parts.push(this.createFileHeader(channel, dateKey, messages.length));
    }

    // Convert messages to universal format and then to markdown
    const universalMessages = messages.map((message) =>
      this.messageConverter.convertSlackMessage(
        message,
        {
          includeAttachments: this.options.includeAttachments,
          includeFiles: this.options.includeFiles,
          includeReactions: this.options.includeReactions,
          includeThreads: this.options.includeThreads,
          resolveUserNames: true,
          downloadFiles: this.options.includeFiles,
        },
        {
          channelId: channel.id,
          channelName: channel.name || channel.id,
          userCache: this.userCache,
        }
      )
    );

    // Group by threads if enabled
    const threadGroups = this.options.includeThreads
      ? this.groupMessagesByThread(universalMessages)
      : universalMessages.map((msg) => [msg]);

    for (const threadMessages of threadGroups) {
      if (threadMessages.length === 1) {
        // Single message
        const firstMessage = threadMessages[0];
        if (firstMessage) {
          const markdown = this.convertMessageToMarkdown(firstMessage);
          parts.push(markdown);
        }
      } else {
        // Thread
        parts.push(this.createThreadMarkdown(threadMessages));
      }
      parts.push(''); // Empty line between messages/threads
    }

    return parts.join('\\n');
  }

  /**
   * Convert a single message to markdown
   */
  private convertMessageToMarkdown(message: UniversalMessage): string {
    const conversionOptions: ConversionOptions = {
      includeAttachments: this.options.includeAttachments,
      includeFiles: this.options.includeFiles,
      includeReactions: this.options.includeReactions,
      includeThreads: this.options.includeThreads,
      resolveUserNames: true,
      downloadFiles: false,
    };

    if (this.options.customTemplate) {
      return this.applyCustomTemplate(message, this.options.customTemplate);
    }

    const markdown = this.messageConverter.convertToMarkdown(message, conversionOptions);
    return this.enhanceMarkdown(markdown, message);
  }

  /**
   * Create thread markdown
   */
  private createThreadMarkdown(messages: UniversalMessage[]): string {
    const parts: string[] = [];

    if (messages.length === 0) return '';

    const mainMessage = messages[0];
    const replies = messages.slice(1);

    // Main message
    if (mainMessage) {
      parts.push(this.convertMessageToMarkdown(mainMessage));
    }

    if (replies.length > 0) {
      parts.push('');
      parts.push('**Thread Replies:**');
      parts.push('');

      for (const reply of replies) {
        const replyMarkdown = this.convertMessageToMarkdown(reply);
        // Indent reply
        const indentedReply = replyMarkdown
          .split('\\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\\n');
        parts.push(indentedReply);
        parts.push('');
      }
    }

    return parts.join('\\n');
  }

  /**
   * Enhance markdown with additional formatting
   */
  private enhanceMarkdown(markdown: string, message: UniversalMessage): string {
    let enhanced = markdown;

    // Add message ID for reference
    if (message.id) {
      enhanced += `\\n\\n*Message ID: ${message.id}*`;
    }

    // Add permalink if available
    if (message.metadata.permalink) {
      enhanced += `\\n*[Permalink](${message.metadata.permalink})*`;
    }

    return enhanced;
  }

  /**
   * Apply custom template
   */
  private applyCustomTemplate(message: UniversalMessage, template: string): string {
    return template
      .replace(/{{author}}/g, message.author.displayName || message.author.name)
      .replace(/{{timestamp}}/g, message.timestamp.toISOString())
      .replace(/{{date}}/g, this.formatDate(message.timestamp))
      .replace(/{{time}}/g, this.formatTime(message.timestamp))
      .replace(/{{content}}/g, message.content.formatted || message.content.text)
      .replace(/{{channelName}}/g, message.metadata.channelName)
      .replace(/{{messageId}}/g, message.id)
      .replace(/{{permalink}}/g, message.metadata.permalink || '');
  }

  /**
   * Create file header
   */
  private createFileHeader(channel: SlackChannel, dateKey: string, messageCount: number): string {
    const parts: string[] = [];
    parts.push(`# ${channel.name || channel.id} - ${dateKey}`);
    parts.push('');
    parts.push(`> **Channel:** ${channel.name || channel.id}`);
    parts.push(`> **Date:** ${dateKey}`);
    parts.push(`> **Messages:** ${messageCount}`);
    parts.push(`> **Generated:** ${new Date().toISOString()}`);
    parts.push('');
    parts.push('---');
    parts.push('');
    return parts.join('\\n');
  }

  /**
   * Group messages by date
   */
  private groupMessagesByDate(messages: SlackMessage[]): Map<string, SlackMessage[]> {
    const groups = new Map<string, SlackMessage[]>();

    for (const message of messages) {
      const date = new Date(parseFloat(message.ts) * 1000);
      const dateKey = this.formatDate(date);

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)?.push(message);
    }

    return groups;
  }

  /**
   * Group messages by thread
   */
  private groupMessagesByThread(messages: UniversalMessage[]): UniversalMessage[][] {
    const threads = new Map<string, UniversalMessage[]>();
    const standalone: UniversalMessage[] = [];

    for (const message of messages) {
      this.categorizeMessage(message, messages, threads, standalone);
    }

    return this.combineStandaloneAndThreads(standalone, threads);
  }

  /**
   * Categorize a message as thread reply or standalone
   */
  private categorizeMessage(
    message: UniversalMessage,
    allMessages: UniversalMessage[],
    threads: Map<string, UniversalMessage[]>,
    standalone: UniversalMessage[]
  ): void {
    const threadTs = message.thread?.parentId || message.id;

    if (message.thread?.parentId) {
      this.addToThread(threads, threadTs, message);
    } else {
      this.handlePotentialThreadStart(message, allMessages, threads, standalone);
    }
  }

  /**
   * Add message to thread
   */
  private addToThread(
    threads: Map<string, UniversalMessage[]>,
    threadTs: string,
    message: UniversalMessage
  ): void {
    if (!threads.has(threadTs)) {
      threads.set(threadTs, []);
    }
    threads.get(threadTs)?.push(message);
  }

  /**
   * Handle potential thread start message
   */
  private handlePotentialThreadStart(
    message: UniversalMessage,
    allMessages: UniversalMessage[],
    threads: Map<string, UniversalMessage[]>,
    standalone: UniversalMessage[]
  ): void {
    const hasReplies = allMessages.some(
      (m) => m.thread?.parentId === message.id && m.id !== message.id
    );

    if (hasReplies) {
      if (!threads.has(message.id)) {
        threads.set(message.id, []);
      }
      threads.get(message.id)?.unshift(message); // Add as first message
    } else {
      standalone.push(message);
    }
  }

  /**
   * Combine standalone messages and threads
   */
  private combineStandaloneAndThreads(
    standalone: UniversalMessage[],
    threads: Map<string, UniversalMessage[]>
  ): UniversalMessage[][] {
    const result: UniversalMessage[][] = standalone.map((msg) => [msg]);
    result.push(...Array.from(threads.values()));
    return result;
  }

  /**
   * Generate file path
   */
  private generateFilePath(channel: SlackChannel, dateKey: string): string {
    const template = this.options.filenameTemplate;

    // Use TemplateResolver to format channel name properly (handles DM conversion)
    const formattedChannelName = this.templateResolver.getFormattedChannelName(channel);
    const channelName = sanitizeFilename(formattedChannelName);

    const filename = template
      .replace(/{{channelName}}/g, channelName)
      .replace(/{{date}}/g, dateKey)
      .replace(/{{channelId}}/g, channel.id);

    const fullPath = normalizePath(`${this.options.outputDir}/${filename}.md`);

    // Validate path
    validateVaultPath(this.app, fullPath);

    return fullPath;
  }

  /**
   * Write content to vault
   */
  private async writeToVault(filePath: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (dir !== '.' && !this.vault.getAbstractFileByPath(dir)) {
      await this.vault.createFolder(dir);
    }

    // Write file
    const existingFile = this.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      await this.vault.modify(existingFile, content);
    } else {
      await this.vault.create(filePath, content);
    }
  }

  /**
   * Merge existing content with new content
   */
  private mergeMarkdownContent(existing: string, newContent: string): string {
    // Simple merge - append new content
    // In a more sophisticated implementation, you might want to:
    // - Detect and merge by date sections
    // - Avoid duplicates
    // - Sort chronologically
    return `${existing}\\n\\n---\\n\\n${newContent}`;
  }

  /**
   * Update user cache
   */
  private updateUserCache(users: SlackUser[]): void {
    for (const user of users) {
      this.userCache.set(user.id, user);
    }
    this.messageConverter.updateUserCache(this.userCache);
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0] || '';
  }

  /**
   * Format time
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }

  /**
   * Get writer statistics
   */
  getStats(): {
    userCacheSize: number;
    channelCacheSize: number;
    options: MarkdownWriterOptions;
  } {
    return {
      userCacheSize: this.userCache.size,
      channelCacheSize: this.channelCache.size,
      options: this.options,
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.userCache.clear();
    this.channelCache.clear();
    this.messageConverter.clearCaches();
  }
}

/**
 * Options for the markdown writer
 */
export interface MarkdownWriterOptions {
  /** Include attachments in output */
  includeAttachments?: boolean;
  /** Include files in output */
  includeFiles?: boolean;
  /** Include reactions in output */
  includeReactions?: boolean;
  /** Include thread replies */
  includeThreads?: boolean;
  /** Group messages by date */
  groupByDate?: boolean;
  /** Date format for grouping */
  dateFormat?: string;
  /** Output directory */
  outputDir?: string;
  /** Filename template */
  filenameTemplate?: string;
  /** Maximum messages per file */
  messagesPerFile?: number;
  /** Enable table view for structured data */
  enableTableView?: boolean;
  /** Custom message template */
  customTemplate?: string;
}

/**
 * Default markdown writer options
 */
export const DEFAULT_MARKDOWN_OPTIONS: Required<MarkdownWriterOptions> = {
  includeAttachments: true,
  includeFiles: true,
  includeReactions: true,
  includeThreads: true,
  groupByDate: true,
  dateFormat: 'YYYY-MM-DD',
  outputDir: 'slack-sync',
  filenameTemplate: '{{channelName}}-{{date}}',
  messagesPerFile: 1000,
  enableTableView: false,
  customTemplate: '',
};
