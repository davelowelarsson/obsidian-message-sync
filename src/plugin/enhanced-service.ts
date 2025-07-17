/**
 * Enhanced Message Sync Service for Obsidian Plugin
 *
 * This service orchestrates all the modular components to provide a clean,
 * feature-rich sync experience. It combines the Slack service, file download service,
 * markdown processor, and configuration adapter into a unified interface.
 */

import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import type { SlackChannel, SlackMessage } from '../types/slack';
import { EnhancedConfigurationAdapter } from './core/config/configuration-adapter';
import {
  type FileDownloadResult,
  FileDownloadService,
} from './core/services/file-download-service';
import { SlackService } from './core/services/slack-service';
import { MarkdownProcessor } from './core/utils/markdown-processor';
import { TemplateResolver } from './core/utils/template-resolver';
import type { MessageSyncSettings, SlackSourceConfig, SyncResult } from './types';

export interface EnhancedSyncOptions {
  downloadFiles: boolean;
  includeThreads: boolean;
  includeMetadata: boolean;
  userDisplayFormat: 'username' | 'displayname' | 'realname';
  onProgress?: (progress: { current: number; total: number; status: string }) => void;
}

export interface ChannelSyncResult {
  channelId: string;
  channelName: string;
  messageCount: number;
  filesDownloaded: number;
  filePath: string;
  errors: string[];
}

/**
 * Enhanced message sync service with modular architecture
 */
export class EnhancedMessageSyncService {
  private app: App;
  private configAdapter: EnhancedConfigurationAdapter;
  private slackService: SlackService | null = null;
  private fileDownloadService: FileDownloadService | null = null;
  private markdownProcessor: MarkdownProcessor;
  private templateResolver: TemplateResolver;

  constructor(app: App, settings: MessageSyncSettings) {
    this.app = app;
    this.configAdapter = new EnhancedConfigurationAdapter(app, settings.configPath);
    this.markdownProcessor = new MarkdownProcessor();
    this.templateResolver = new TemplateResolver();
  }

  /**
   * Initialize the service by loading configuration and setting up services
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing enhanced plugin service...');

    // Load and validate configuration
    const configResult = await this.configAdapter.getConfig();
    if (!configResult) {
      throw new Error('Configuration not found or invalid');
    }

    // Get enabled Slack sources
    const enabledSources = this.configAdapter.getEnabledSlackSources(configResult);
    if (enabledSources.length === 0) {
      throw new Error('No enabled Slack sources found');
    }

    // Use the first enabled source for now (TODO: support multiple sources)
    const primarySource = enabledSources[0];
    if (!primarySource) {
      throw new Error('No primary Slack source found');
    }
    const slackToken = primarySource.token;

    // Initialize Slack service
    this.slackService = new SlackService({
      token: slackToken,
      onProgress: (progress) => {
        console.log(
          `📊 Slack API progress: ${progress.current}/${progress.total} - ${progress.status}`
        );
      },
    });

    // Initialize file download service
    const outputConfig = await this.configAdapter.getOutputConfig();
    this.fileDownloadService = new FileDownloadService(this.app, slackToken, {
      outputDir: outputConfig.notesFolder || 'sync', // Use the notes folder as base
      assetsDir: 'assets',
      downloadFiles: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    console.log('✅ Enhanced plugin service initialized successfully');
  }

  /**
   * Test authentication and configuration
   */
  async testConfiguration(): Promise<boolean> {
    if (!this.slackService) {
      await this.initialize();
    }

    const authResult = await this.slackService?.testAuth();
    if (!authResult || !authResult.ok) {
      throw new Error(`Authentication failed: ${authResult?.error || 'Unknown error'}`);
    }

    console.log('✅ Configuration test successful');
    return true;
  }

  /**
   * Get list of available channels
   */
  async getAvailableChannels(): Promise<Array<{ id: string; name: string; memberCount?: number }>> {
    if (!this.slackService) {
      await this.initialize();
    }

    const channelsResult = await this.slackService?.getChannels();
    if (!channelsResult || !channelsResult.ok) {
      throw new Error(`Failed to get channels: ${channelsResult?.error || 'Unknown error'}`);
    }

    return (channelsResult.data || []).map((channel) => ({
      id: channel.id,
      name: channel.name || channel.id,
      ...(channel.num_members !== undefined && { memberCount: channel.num_members }),
    }));
  }

  /**
   * Sync all configured channels
   */
  async sync(options: Partial<EnhancedSyncOptions> = {}): Promise<SyncResult> {
    if (!this.slackService) {
      await this.initialize();
    }

    const syncOptions: EnhancedSyncOptions = {
      downloadFiles: true,
      includeThreads: true,
      includeMetadata: true,
      userDisplayFormat: 'displayname',
      ...options,
    };

    console.log('🔄 Starting enhanced sync process...');

    try {
      const channelsToSync = await this.getChannelsToSync();
      return await this.processSyncChannels(channelsToSync, syncOptions);
    } catch (error) {
      const errorMsg = `Enhanced sync failed: ${error}`;
      console.error('❌', errorMsg);
      return {
        messageCount: 0,
        errors: [errorMsg],
        filesCreated: 0,
        filesUpdated: 0,
      };
    }
  }

  /**
   * Get channels to sync based on configuration
   */
  private async getChannelsToSync(): Promise<SlackChannel[]> {
    const configuredChannels = await this.configAdapter.getConfiguredChannels();
    let channelsToSync: SlackChannel[] = [];

    if (configuredChannels.length > 0) {
      channelsToSync = await this.getConfiguredChannels(configuredChannels);
    } else {
      channelsToSync = await this.getAllChannels();
    }

    return channelsToSync;
  }

  /**
   * Get specific configured channels
   */
  private async getConfiguredChannels(
    configuredChannels: SlackSourceConfig[]
  ): Promise<SlackChannel[]> {
    const channelsToSync: SlackChannel[] = [];

    for (const channelConfig of configuredChannels) {
      for (const channelId of channelConfig.channels) {
        const channelResult = await this.slackService?.getChannelInfo(channelId);
        if (channelResult?.ok && channelResult.data) {
          channelsToSync.push(channelResult.data);
        }
      }
    }

    return channelsToSync;
  }

  /**
   * Get all available channels
   */
  private async getAllChannels(): Promise<any[]> {
    const allChannelsResult = await this.slackService?.getChannels();
    return allChannelsResult?.ok && allChannelsResult.data ? allChannelsResult.data : [];
  }

  /**
   * Process sync for all channels
   */
  private async processSyncChannels(
    channelsToSync: any[],
    syncOptions: EnhancedSyncOptions
  ): Promise<SyncResult> {
    const results: ChannelSyncResult[] = [];
    let totalMessages = 0;
    let totalFiles = 0;
    const errors: string[] = [];

    for (let i = 0; i < channelsToSync.length; i++) {
      const channel = channelsToSync[i];

      if (syncOptions.onProgress) {
        syncOptions.onProgress({
          current: i + 1,
          total: channelsToSync.length,
          status: `Syncing channel: ${channel.name || channel.id}`,
        });
      }

      try {
        const channelResult = await this.syncChannel(channel, syncOptions);
        results.push(channelResult);
        totalMessages += channelResult.messageCount;
        totalFiles += channelResult.filesDownloaded;
      } catch (error) {
        const errorMsg = `Failed to sync channel ${channel.name || channel.id}: ${error}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

    const result: SyncResult = {
      messageCount: totalMessages,
      errors,
      filesCreated: totalFiles,
      filesUpdated: 0, // We don't track updates vs creates yet
    };

    console.log('✅ Enhanced sync completed successfully:', result);
    return result;
  }

  /**
   * Sync specific channels
   */
  async syncChannels(
    channelIds: string[],
    options: Partial<EnhancedSyncOptions> = {}
  ): Promise<SyncResult> {
    if (!this.slackService) {
      await this.initialize();
    }

    const syncOptions: EnhancedSyncOptions = {
      downloadFiles: true,
      includeThreads: true,
      includeMetadata: true,
      userDisplayFormat: 'displayname',
      ...options,
    };

    console.log(`🔄 Starting sync for channels: ${channelIds.join(', ')}`);

    try {
      const results: ChannelSyncResult[] = [];
      let totalMessages = 0;
      let totalFiles = 0;
      const errors: string[] = [];

      for (let i = 0; i < channelIds.length; i++) {
        const channelId = channelIds[i];

        if (syncOptions.onProgress) {
          syncOptions.onProgress({
            current: i + 1,
            total: channelIds.length,
            status: `Syncing channel: ${channelId}`,
          });
        }

        try {
          // Get channel info
          if (!channelId) {
            throw new Error('Channel ID is required');
          }

          const channelResult = await this.slackService?.getChannelInfo(channelId);
          if (!channelResult || !channelResult.ok || !channelResult.data) {
            throw new Error(`Channel not found: ${channelId}`);
          }

          const channelSyncResult = await this.syncChannel(channelResult.data, syncOptions);
          results.push(channelSyncResult);
          totalMessages += channelSyncResult.messageCount;
          totalFiles += channelSyncResult.filesDownloaded;
        } catch (error) {
          const errorMsg = `Failed to sync channel ${channelId}: ${error}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      const result: SyncResult = {
        messageCount: totalMessages,
        errors,
        filesCreated: totalFiles,
        filesUpdated: 0,
      };

      console.log('✅ Channel sync completed:', result);
      return result;
    } catch (error) {
      const errorMsg = `Channel sync failed: ${error}`;
      console.error('❌', errorMsg);
      return {
        messageCount: 0,
        errors: [errorMsg],
        filesCreated: 0,
        filesUpdated: 0,
      };
    }
  }

  /**
   * Sync a single channel
   */
  private async syncChannel(
    channel: any,
    options: EnhancedSyncOptions
  ): Promise<ChannelSyncResult> {
    console.log(`🔄 Syncing channel: ${channel.name || channel.id}`);

    try {
      // Get and validate messages
      const messages = await this.getChannelMessages(channel);
      if (messages.length === 0) {
        return this.createEmptyChannelResult(channel);
      }

      // Setup user cache
      const userCache = await this.setupUserCache(messages);

      // Handle file downloads
      const { fileDownloadResults, filesDownloaded } = await this.handleFileDownloads(
        messages,
        channel,
        options
      );

      // Setup markdown processor
      this.setupMarkdownProcessor(options);

      // Get output configuration
      const outputTemplate = await this.getOutputTemplate(channel);

      // Process messages and write files
      const processedFiles = await this.processMessagesAndWriteFiles(
        messages,
        channel,
        userCache,
        fileDownloadResults,
        outputTemplate
      );

      console.log(
        `✅ Successfully synced channel ${channel.name || channel.id} - ${messages.length} messages across ${processedFiles.length} files`
      );

      return {
        channelId: channel.id,
        channelName: channel.name || channel.id,
        messageCount: messages.length,
        filesDownloaded,
        filePath: processedFiles[0] || '',
        errors: [],
      };
    } catch (error) {
      const errorMsg = `Failed to sync channel ${channel.name || channel.id}: ${error}`;
      console.error('❌', errorMsg);
      return {
        channelId: channel.id,
        channelName: channel.name || channel.id,
        messageCount: 0,
        filesDownloaded: 0,
        filePath: '',
        errors: [errorMsg],
      };
    }
  }

  /**
   * Get messages from channel
   */
  private async getChannelMessages(channel: any): Promise<any[]> {
    const messagesResult = await this.slackService?.getChannelMessages({
      channel: channel.id,
      limit: 100,
    });

    if (!messagesResult || !messagesResult.ok || !messagesResult.data) {
      throw new Error(`Failed to get messages: ${messagesResult?.error || 'Unknown error'}`);
    }

    const messages = messagesResult.data.messages;
    console.log(`📨 Found ${messages.length} messages in ${channel.name || channel.id}`);
    return messages;
  }

  /**
   * Create empty channel result
   */
  private createEmptyChannelResult(channel: any): ChannelSyncResult {
    return {
      channelId: channel.id,
      channelName: channel.name || channel.id,
      messageCount: 0,
      filesDownloaded: 0,
      filePath: '',
      errors: [],
    };
  }

  /**
   * Setup user cache for messages
   */
  private async setupUserCache(messages: any[]): Promise<Map<string, any>> {
    const userIds = [...new Set(messages.map((msg) => msg.user).filter(Boolean))] as string[];
    await this.slackService?.populateUserCache(userIds);

    const userCache = new Map();
    for (const userId of userIds) {
      const user = this.slackService?.getCachedUser(userId);
      if (user) {
        userCache.set(userId, user);
      }
    }
    return userCache;
  }

  /**
   * Handle file downloads for messages
   */
  private async handleFileDownloads(
    messages: any[],
    channel: any,
    options: EnhancedSyncOptions
  ): Promise<{ fileDownloadResults: Map<string, FileDownloadResult[]>; filesDownloaded: number }> {
    const fileDownloadResults: Map<string, FileDownloadResult[]> = new Map();
    let filesDownloaded = 0;

    if (options.downloadFiles && this.fileDownloadService) {
      const channelPath = this.templateResolver.createTemplateVariables(
        channel,
        new Date()
      ).channel;

      for (const message of messages) {
        if (message.files && message.files.length > 0) {
          const results = await this.downloadMessageFiles(message, channelPath);
          fileDownloadResults.set(message.ts, results);
          filesDownloaded += results.filter((r) => r.wasDownloaded).length;
        }
      }
    }

    return { fileDownloadResults, filesDownloaded };
  }

  /**
   * Download files for a specific message
   */
  private async downloadMessageFiles(message: any, channelPath: string): Promise<any[]> {
    const messageTimestamp = parseFloat(message.ts) * 1000;
    const dateKey =
      new Date(messageTimestamp).toISOString().split('T')[0] ||
      new Date().toISOString().substring(0, 10);

    const channelDateKey = `${channelPath}/${dateKey}`;
    return (await this.fileDownloadService?.downloadMessageFiles(message, channelDateKey)) || [];
  }

  /**
   * Setup markdown processor with options
   */
  private setupMarkdownProcessor(options: EnhancedSyncOptions): void {
    this.markdownProcessor.updateOptions({
      includeMetadata: options.includeMetadata,
      includeAttachments: options.downloadFiles,
      includeThreads: options.includeThreads,
      userDisplayFormat: options.userDisplayFormat,
    });
  }

  /**
   * Get output template for channel
   */
  private async getOutputTemplate(channel: any): Promise<string> {
    const sources = await this.configAdapter.getConfiguredChannels();
    const currentSource = this.findMatchingSource(sources, channel);

    if (!currentSource || !currentSource.output) {
      console.log(`⚠️ No output template found for channel ${channel.id} (name: ${channel.name})`);
      console.log(
        `🔍 Available sources:`,
        sources.map((s) => ({ name: s.name, channels: s.channels }))
      );
      throw new Error(`No output template found for channel ${channel.id}`);
    }

    console.log('🔍 Using output template:', currentSource.output);

    // Modify template to include channel path
    let outputTemplate = currentSource.output;
    if (outputTemplate.includes('slack/{{date}}')) {
      outputTemplate = outputTemplate.replace('slack/{{date}}', 'slack/{{channel}}/{{date}}');
    }

    console.log('🔍 Modified template to include channel:', outputTemplate);
    return outputTemplate;
  }

  /**
   * Find matching source for channel
   */
  private findMatchingSource(sources: any[], channel: any): any {
    return sources.find((s) => {
      if (s.channels.includes(channel.id)) return true;
      if (channel.name && s.channels.includes(channel.name)) return true;
      if (channel.name && s.channels.includes(`#${channel.name}`)) return true;
      return false;
    });
  }

  /**
   * Process messages and write markdown files
   */
  private async processMessagesAndWriteFiles(
    messages: any[],
    channel: any,
    userCache: Map<string, any>,
    fileDownloadResults: Map<string, any[]>,
    outputTemplate: string
  ): Promise<string[]> {
    const messagesByDate = this.groupMessagesByContentDate(messages, outputTemplate);
    console.log(`🔍 Grouped ${messages.length} messages into ${messagesByDate.size} date groups`);

    const processedFiles: string[] = [];

    for (const [dateKey, dateMessages] of messagesByDate) {
      console.log(`🔍 Processing ${dateMessages.length} messages for date: ${dateKey}`);

      const firstMessage = dateMessages[0];
      if (!firstMessage) {
        console.warn(`⚠️ No messages found for date group: ${dateKey}`);
        continue;
      }

      const filePath = await this.processDateGroup(
        dateMessages,
        channel,
        userCache,
        fileDownloadResults,
        outputTemplate,
        firstMessage,
        dateKey
      );

      if (filePath) {
        processedFiles.push(filePath);
      }
    }

    return processedFiles;
  }

  /**
   * Process a single date group of messages
   */
  private async processDateGroup(
    dateMessages: any[],
    channel: any,
    userCache: Map<string, any>,
    fileDownloadResults: Map<string, any[]>,
    outputTemplate: string,
    firstMessage: any,
    dateKey: string
  ): Promise<string | null> {
    const contentDate = new Date(parseFloat(firstMessage.ts) * 1000);

    // Process messages into markdown
    const markdownOutput = this.markdownProcessor.processMessages({
      channel,
      messages: dateMessages,
      userCache,
      fileDownloadResults,
    });

    // Resolve output path
    const outputPath = this.templateResolver.resolveOutputPath(
      outputTemplate,
      channel,
      contentDate
    );

    console.log(`🔍 Resolved output path for ${dateKey}:`, outputPath);

    const fullPath = normalizePath(outputPath);

    // Ensure directory exists
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await this.ensureDirectoryExists(dirPath);

    // Handle existing content
    const existingContent = (await this.app.vault.adapter.exists(fullPath))
      ? await this.app.vault.adapter.read(fullPath)
      : '';

    let finalContent = markdownOutput.content;
    if (existingContent) {
      finalContent = this.mergeMarkdownContent(existingContent, markdownOutput.content);
    }

    // Write file
    await this.app.vault.adapter.write(fullPath, finalContent);
    console.log(`✅ Processed ${dateMessages.length} messages for ${dateKey} to ${fullPath}`);

    return fullPath;
  }

  /**
   * Group messages by their content date (not sync date)
   * Groups according to the template granularity (date, month, year, week)
   */
  private groupMessagesByContentDate(
    messages: SlackMessage[],
    template: string
  ): Map<string, SlackMessage[]> {
    const groups = new Map<string, SlackMessage[]>();

    // Determine grouping granularity from template
    const granularity = this.determineTemplateGranularity(template);
    console.log(`🔍 Grouping messages by ${granularity} based on template: ${template}`);

    for (const message of messages) {
      const messageDate = new Date(parseFloat(message.ts) * 1000);
      const dateKey = this.formatDateByGranularity(messageDate, granularity);

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)?.push(message);
    }

    // Sort groups by date (oldest first)
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    return new Map(sortedEntries);
  }

  /**
   * Determine the finest granularity from template variables
   */
  private determineTemplateGranularity(template: string): 'date' | 'month' | 'year' | 'week' {
    // Check for template variables in order of finest to coarsest
    if (template.includes('{{date}}')) {
      return 'date';
    }
    if (template.includes('{{week}}')) {
      return 'week';
    }
    if (template.includes('{{month}}')) {
      return 'month';
    }
    if (template.includes('{{year}}')) {
      return 'year';
    }

    // Default to date if no template variables found
    return 'date';
  }

  /**
   * Format date according to granularity
   */
  private formatDateByGranularity(
    date: Date,
    granularity: 'date' | 'month' | 'year' | 'week'
  ): string {
    switch (granularity) {
      case 'date':
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      case 'week': {
        // Calculate ISO week (same logic as template resolver)
        const jan4 = new Date(date.getFullYear(), 0, 4);
        const mondayOfWeek1 = new Date(jan4);
        while (mondayOfWeek1.getDay() !== 1) {
          mondayOfWeek1.setDate(mondayOfWeek1.getDate() - 1);
        }
        const daysDiff = Math.floor(
          (date.getTime() - mondayOfWeek1.getTime()) / (24 * 60 * 60 * 1000)
        );
        const weekNum = Math.floor(daysDiff / 7) + 1;
        return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
      }
      case 'month':
        return date.toISOString().slice(0, 7); // YYYY-MM
      case 'year':
        return date.getFullYear().toString(); // YYYY
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Merge new markdown content with existing content
   */
  private mergeMarkdownContent(existingContent: string, newContent: string): string {
    // Simple merge strategy: append new content with a separator
    // In a more sophisticated implementation, you might want to:
    // - Parse the markdown structure
    // - Merge at specific sections
    // - Avoid duplicates

    const separator = '\n\n---\n\n';

    // Check if the existing content already contains the new content
    if (existingContent.includes(newContent.trim())) {
      return existingContent;
    }

    // Append new content with separator
    return existingContent.trim() + separator + newContent.trim();
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const exists = await this.app.vault.adapter.exists(dirPath);
      if (!exists) {
        await this.app.vault.createFolder(dirPath);
      }
    } catch (error) {
      console.warn(`⚠️ Could not create directory ${dirPath}:`, error);
    }
  }

  /**
   * Update service settings
   */
  updateSettings(settings: MessageSyncSettings): void {
    this.configAdapter.updateConfigPath(settings.configPath);
    this.configAdapter.updateConfigPath(settings.configPath);

    // Clear services to force re-initialization
    this.slackService = null;
    this.fileDownloadService = null;
  }

  /**
   * Update sync options
   */
  updateSyncOptions(options: Partial<EnhancedSyncOptions>): void {
    const processOptions: any = {};

    if (options.includeMetadata !== undefined) {
      processOptions.includeMetadata = options.includeMetadata;
    }
    if (options.downloadFiles !== undefined) {
      processOptions.includeAttachments = options.downloadFiles;
    }
    if (options.includeThreads !== undefined) {
      processOptions.includeThreads = options.includeThreads;
    }
    if (options.userDisplayFormat !== undefined) {
      processOptions.userDisplayFormat = options.userDisplayFormat;
    }

    this.markdownProcessor.updateOptions(processOptions);
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    hasValidConfig: boolean;
    slackConnected: boolean;
    configPath: string;
  } {
    return {
      initialized: this.slackService !== null,
      hasValidConfig: this.configAdapter !== null,
      slackConnected: this.slackService !== null,
      configPath: this.configAdapter.getConfigPath(),
    };
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    if (this.slackService) {
      this.slackService.clearCaches();
    }

    this.slackService = null;
    this.fileDownloadService = null;
  }
}
