import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { EnhancedMessageSyncService } from './enhanced-service';
import type { MessageSyncSettings, SyncResult } from './types';

// Legacy interface for backward compatibility
export interface ConfigStatus {
  valid: boolean;
  path?: string;
  error?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  memberCount?: number | undefined;
}

/**
 * Legacy Message Sync Service - Wrapper for Enhanced Service
 *
 * This service provides backward compatibility while using the new modular architecture.
 * It wraps the EnhancedMessageSyncService and maintains the same API.
 */
export class MessageSyncService {
  private enhancedService: EnhancedMessageSyncService;

  constructor(app: App, settings: MessageSyncSettings) {
    this.enhancedService = new EnhancedMessageSyncService(app, settings);
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing plugin service (legacy wrapper)...');

    try {
      await this.enhancedService.initialize();
      console.log('✅ Plugin service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize plugin service:', error);
      throw error;
    }
  }

  async getConfigStatus(): Promise<ConfigStatus> {
    console.log('🔧 Getting configuration status...');

    try {
      const status = this.enhancedService.getStatus();

      if (!status.hasValidConfig) {
        return {
          valid: false,
          path: status.configPath,
          error: 'Configuration is invalid or missing',
        };
      }

      return {
        valid: true,
        path: status.configPath,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async testConfiguration(): Promise<boolean> {
    try {
      return await this.enhancedService.testConfiguration();
    } catch (error) {
      console.error('❌ Configuration test failed:', error);
      return false;
    }
  }

  async getAvailableChannels(): Promise<SlackChannel[]> {
    console.log('📋 Getting available channels...');

    try {
      const channels = await this.enhancedService.getAvailableChannels();
      return channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        memberCount: channel.memberCount,
      }));
    } catch (error) {
      const errorMsg = `Failed to get channels: ${error}`;
      console.error('❌', errorMsg);
      new Notice(errorMsg);

      // Return mock data on error for backward compatibility
      return [{ id: 'error', name: 'Error fetching channels', memberCount: 0 }];
    }
  }

  async sync(): Promise<SyncResult> {
    console.log('🔄 Starting sync process (legacy wrapper)...');

    try {
      const result = await this.enhancedService.sync({
        downloadFiles: true,
        includeThreads: true,
        includeMetadata: true,
        userDisplayFormat: 'displayname',
        onProgress: (progress) => {
          console.log(
            `📊 Sync progress: ${progress.current}/${progress.total} - ${progress.status}`
          );
        },
      });

      new Notice(
        `Sync completed! ${result.messageCount} messages processed, ${result.filesCreated} files created, ${result.filesUpdated} files updated.`
      );

      return result;
    } catch (error) {
      const errorMsg = `Sync failed: ${error}`;
      console.error('❌', errorMsg);
      new Notice(errorMsg);
      return {
        messageCount: 0,
        errors: [errorMsg],
        filesCreated: 0,
        filesUpdated: 0,
      };
    }
  }

  async syncSince(date: Date): Promise<SyncResult> {
    console.log(`🔄 Starting sync since ${date.toISOString()}...`);

    // For now, just call the regular sync method
    // TODO: Implement date filtering in enhanced service
    const result = await this.sync();

    new Notice(
      `Sync since ${date.toISOString()} completed! Note: Date filtering not yet implemented.`
    );
    return result;
  }

  async syncChannels(channelIds: string[]): Promise<SyncResult> {
    console.log(`🔄 Starting sync for specific channels: ${channelIds.join(', ')}...`);

    try {
      const result = await this.enhancedService.syncChannels(channelIds, {
        downloadFiles: true,
        includeThreads: true,
        includeMetadata: true,
        userDisplayFormat: 'displayname',
        onProgress: (progress) => {
          console.log(
            `📊 Channel sync progress: ${progress.current}/${progress.total} - ${progress.status}`
          );
        },
      });

      new Notice(
        `Channel sync completed! ${result.messageCount} messages processed from ${channelIds.length} channels.`
      );

      return result;
    } catch (error) {
      const errorMsg = `Channel sync failed: ${error}`;
      console.error('❌', errorMsg);
      new Notice(errorMsg);
      return {
        messageCount: 0,
        errors: [errorMsg],
        filesCreated: 0,
        filesUpdated: 0,
      };
    }
  }

  updateSettings(settings: MessageSyncSettings): void {
    this.enhancedService.updateSettings(settings);
  }

  async cleanup(): Promise<void> {
    await this.enhancedService.cleanup();
  }

  // Additional methods for enhanced functionality

  /**
   * Get enhanced service instance for advanced features
   */
  getEnhancedService(): EnhancedMessageSyncService {
    return this.enhancedService;
  }

  /**
   * Update sync options for enhanced features
   */
  updateSyncOptions(options: {
    downloadFiles?: boolean;
    includeThreads?: boolean;
    includeMetadata?: boolean;
    userDisplayFormat?: 'username' | 'displayname' | 'realname';
  }): void {
    this.enhancedService.updateSyncOptions(options);
  }

  /**
   * Get current service status
   */
  getServiceStatus(): {
    initialized: boolean;
    hasValidConfig: boolean;
    slackConnected: boolean;
    configPath: string;
  } {
    return this.enhancedService.getStatus();
  }
}
