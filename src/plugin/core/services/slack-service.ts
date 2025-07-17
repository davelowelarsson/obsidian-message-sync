/**
 * Browser-compatible Slack Service for Obsidian Plugin
 *
 * This service provides Slack API functionality optimized for the Obsidian plugin environment.
 * It uses Obsidian's request API to bypass CORS restrictions and provides a clean interface
 * for Slack operations.
 */

import { request } from 'obsidian';
import type { SlackChannel, SlackMessage, SlackUser } from '../../../types/slack';

// Simple rate limit config for plugin
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerSecond: number;
  burstLimit: number;
}

export interface SlackServiceOptions {
  token: string;
  rateLimitConfig?: Partial<RateLimitConfig>;
  onProgress?: ((progress: { current: number; total: number; status: string }) => void) | undefined;
}

// Type aliases for Slack API interaction
type SlackApiParams = Record<string, string | number | boolean>;

export interface SlackAuthTestResponse {
  user_id?: string;
  team_id?: string;
  url?: string;
  team?: string;
  user?: string;
  bot_id?: string;
  scopes?: string[];
  response_metadata?: {
    scopes?: string[];
    next_cursor?: string;
  };
}

export interface SlackApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

export interface ChannelHistoryOptions {
  channel: string;
  cursor?: string | undefined;
  limit?: number;
  oldest?: string;
  latest?: string;
}

export interface MessageBatch {
  messages: SlackMessage[];
  cursor?: string;
  hasMore: boolean;
}

/**
 * Browser-compatible Slack service for Obsidian plugins
 */
export class SlackService {
  private token: string;
  private onProgress?:
    | ((progress: { current: number; total: number; status: string }) => void)
    | undefined;
  private userCache = new Map<string, SlackUser>();
  private channelCache = new Map<string, SlackChannel>();
  private lastRequestTime = 0;
  private requestCount = 0;

  constructor(options: SlackServiceOptions) {
    if (!options.token || typeof options.token !== 'string' || options.token.trim() === '') {
      throw new Error('Slack token is required and must be a non-empty string');
    }

    this.token = options.token;
    this.onProgress = options.onProgress;
  }

  /**
   * Test authentication with Slack API
   */
  async testAuth(): Promise<SlackApiResponse<SlackAuthTestResponse>> {
    try {
      const response = await this.makeRequest('auth.test');
      console.log('🔍 Auth test response:', response);
      console.log(
        '🔍 Token scopes:',
        response.response_metadata?.scopes || 'No scopes in response'
      );
      return {
        ok: true,
        data: response,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Get list of channels with pagination support
   */
  async getChannels(): Promise<SlackApiResponse<SlackChannel[]>> {
    try {
      const allChannels: SlackChannel[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const params: Record<string, string | number> = {
          types: 'public_channel,private_channel,mpim,im',
          limit: 200, // Increased limit
        };

        if (cursor) {
          params['cursor'] = cursor;
        }

        console.log(`🔍 Fetching channels page with params:`, params);
        const response = await this.makeRequest('conversations.list', params);

        console.log(`🔍 Raw API response:`, {
          ok: response.ok,
          channelCount: response.channels?.length || 0,
          hasMetadata: !!response.response_metadata,
          cursor: response.response_metadata?.next_cursor,
          error: response.error,
        });

        const channels = response.channels || [];
        console.log(`🔍 Fetched ${channels.length} channels in this page`);

        // Debug: Log channel names for troubleshooting
        for (const channel of channels) {
          console.log(
            `  - Channel: ${channel.id} = "${channel.name}" (type: ${channel.is_private ? 'private' : 'public'}, archived: ${channel.is_archived})`
          );
        }

        allChannels.push(...channels);

        // Check for pagination
        cursor = response.response_metadata?.next_cursor;
        hasMore = !!cursor;
        console.log(`🔍 Pagination: hasMore=${hasMore}, cursor=${cursor || 'none'}`);
      }

      console.log(`🔍 Total channels fetched: ${allChannels.length}`);

      // Cache channels for later use
      for (const channel of allChannels) {
        this.channelCache.set(channel.id, channel);
      }

      return {
        ok: true,
        data: allChannels,
      };
    } catch (error) {
      console.error(`❌ Error fetching channels:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get channels',
      };
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channelInput: string): Promise<SlackApiResponse<SlackChannel>> {
    // First resolve the channel input to a channel ID
    const resolvedIdResponse = await this.resolveChannelId(channelInput);
    if (!resolvedIdResponse.ok) {
      return {
        ok: false,
        error: resolvedIdResponse.error || 'Failed to resolve channel ID',
      };
    }

    const channelId = resolvedIdResponse.data;
    if (!channelId) {
      return {
        ok: false,
        error: 'Channel ID resolution returned empty result',
      };
    }

    // Check cache first
    if (this.channelCache.has(channelId)) {
      const cachedData = this.channelCache.get(channelId);
      if (cachedData) {
        return {
          ok: true,
          data: cachedData,
        };
      }
    }

    try {
      const response = await this.makeRequest('conversations.info', {
        channel: channelId,
      });

      const channel = response.channel;

      // For DM channels, enhance with user info
      if (channel.is_im && channel.user) {
        const userResponse = await this.getUserInfo(channel.user);
        if (userResponse.ok && userResponse.data) {
          const user = userResponse.data;
          channel.name = `DM with ${user.display_name || user.real_name || user.name || channel.user}`;
        }
      }

      // Cache the channel
      this.channelCache.set(channelId, channel);

      return {
        ok: true,
        data: channel,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get channel info',
      };
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<SlackApiResponse<SlackUser>> {
    // Check cache first
    if (this.userCache.has(userId)) {
      const cachedData = this.userCache.get(userId);
      if (cachedData) {
        return {
          ok: true,
          data: cachedData,
        };
      }
    }

    try {
      const response = await this.makeRequest('users.info', {
        user: userId,
      });

      const user = response.user;

      // Cache the user
      this.userCache.set(userId, user);

      return {
        ok: true,
        data: user,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get user info',
      };
    }
  }

  /**
   * Get channel messages with pagination
   */
  async getChannelMessages(
    options: ChannelHistoryOptions
  ): Promise<SlackApiResponse<MessageBatch>> {
    try {
      // First resolve the channel input to a channel ID
      const resolvedIdResponse = await this.resolveChannelId(options.channel);
      if (!resolvedIdResponse.ok) {
        return {
          ok: false,
          error: resolvedIdResponse.error || 'Failed to resolve channel ID',
        };
      }

      const channelId = resolvedIdResponse.data;
      if (!channelId) {
        return {
          ok: false,
          error: 'Channel ID resolution returned empty result',
        };
      }

      const params: Record<string, string | number> = {
        channel: channelId,
        limit: options.limit || 100,
      };

      if (options.cursor) params['cursor'] = options.cursor;
      if (options.oldest) params['oldest'] = options.oldest;
      if (options.latest) params['latest'] = options.latest;

      const response = await this.makeRequest('conversations.history', params);

      const messages = response.messages || [];
      const cursor = response.response_metadata?.next_cursor;

      return {
        ok: true,
        data: {
          messages,
          cursor,
          hasMore: !!cursor,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get channel messages',
      };
    }
  }

  /**
   * Get all messages from a channel since a specific timestamp
   */
  async getAllMessagesSince(
    channelId: string,
    since: string
  ): Promise<SlackApiResponse<SlackMessage[]>> {
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await this.getChannelMessages({
          channel: channelId,
          cursor,
          oldest: since,
          limit: 100,
        });

        if (!response.ok || !response.data) {
          return {
            ok: false,
            error: response.error || 'Failed to get messages',
          };
        }

        allMessages.push(...response.data.messages);
        cursor = response.data.cursor;
        hasMore = response.data.hasMore;

        // Update progress if callback provided
        if (this.onProgress) {
          this.onProgress({
            current: allMessages.length,
            total: allMessages.length + (hasMore ? 100 : 0), // Estimate
            status: `Fetching messages from channel...`,
          });
        }

        // Rate limiting handled by makeRequest
      }

      return {
        ok: true,
        data: allMessages,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get all messages',
      };
    }
  }

  /**
   * Populate user cache with multiple users
   */
  async populateUserCache(userIds: string[]): Promise<void> {
    const uncachedUsers = userIds.filter((id) => !this.userCache.has(id));

    if (uncachedUsers.length === 0) return;

    // Fetch users in parallel with rate limiting
    const userPromises = uncachedUsers.map(async (userId) => {
      try {
        const response = await this.getUserInfo(userId);
        if (response.ok && response.data) {
          this.userCache.set(userId, response.data);
        }
      } catch (error) {
        console.warn(`Failed to fetch user ${userId}:`, error);
      }
    });

    await Promise.allSettled(userPromises);
  }

  /**
   * Get cached user or return fallback
   */
  getCachedUser(userId: string): SlackUser | null {
    return this.userCache.get(userId) || null;
  }

  /**
   * Get cached channel or return fallback
   */
  getCachedChannel(channelId: string): SlackChannel | null {
    return this.channelCache.get(channelId) || null;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.userCache.clear();
    this.channelCache.clear();
  }

  /**
   * Resolve channel name or ID to channel ID
   * Supports multiple formats:
   * - Channel ID: C033GL7MQ
   * - Channel name: devsecops
   * - Channel name with hash: #devsecops
   */
  async resolveChannelId(channelInput: string): Promise<SlackApiResponse<string>> {
    try {
      console.log(`🔍 Resolving channel: "${channelInput}"`);

      const cleanChannelInput = this.cleanChannelInput(channelInput);
      console.log(`🔍 Clean channel input: "${cleanChannelInput}"`);

      // Check if it's already a channel ID
      const directIdResult = this.checkDirectChannelId(cleanChannelInput);
      if (directIdResult) {
        return directIdResult;
      }

      // Ensure channel cache is populated
      const cacheResult = await this.ensureChannelCache();
      if (!cacheResult.ok) {
        return cacheResult;
      }

      // Search in cache
      const cacheSearchResult = this.searchChannelInCache(cleanChannelInput);
      if (cacheSearchResult) {
        return cacheSearchResult;
      }

      // Try direct API call
      const directApiResult = await this.tryDirectChannelApi(cleanChannelInput);
      if (directApiResult) {
        return directApiResult;
      }

      // Final attempt with cache refresh
      const refreshResult = await this.tryWithCacheRefresh(cleanChannelInput);
      if (refreshResult) {
        return refreshResult;
      }

      return {
        ok: false,
        error: `Channel not found: ${channelInput}. Make sure the channel exists and you have access to it.`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to resolve channel',
      };
    }
  }

  /**
   * Clean channel input by removing # prefix
   */
  private cleanChannelInput(channelInput: string): string {
    return channelInput.startsWith('#') ? channelInput.slice(1) : channelInput;
  }

  /**
   * Check if input is already a channel ID
   */
  private checkDirectChannelId(cleanChannelInput: string): SlackApiResponse<string> | null {
    if (cleanChannelInput.match(/^[CD][A-Z0-9]{8,}$/)) {
      console.log(`✅ Already a channel ID: ${cleanChannelInput}`);
      return { ok: true, data: cleanChannelInput };
    }
    return null;
  }

  /**
   * Ensure channel cache is populated
   */
  private async ensureChannelCache(): Promise<SlackApiResponse<string>> {
    if (this.channelCache.size === 0) {
      console.log(`🔍 Channel cache empty, fetching channels...`);
      const channelsResponse = await this.getChannels();
      if (!channelsResponse.ok) {
        return {
          ok: false,
          error: `Failed to get channels list: ${channelsResponse.error}`,
        };
      }
      console.log(`✅ Fetched ${channelsResponse.data?.length || 0} channels`);
    } else {
      console.log(`🔍 Using cached channels (${this.channelCache.size} channels)`);
    }
    return { ok: true, data: '' };
  }

  /**
   * Search for channel in cache
   */
  private searchChannelInCache(cleanChannelInput: string): SlackApiResponse<string> | null {
    console.log(`🔍 Available channels in cache:`);
    for (const [channelId, channel] of this.channelCache.entries()) {
      console.log(
        `  - ${channelId}: "${channel.name}" (${channel.is_private ? 'private' : 'public'})`
      );
    }

    for (const [channelId, channel] of this.channelCache.entries()) {
      if (channel.name && channel.name.toLowerCase() === cleanChannelInput.toLowerCase()) {
        console.log(`✅ Found channel by name: ${cleanChannelInput} -> ${channelId}`);
        return { ok: true, data: channelId };
      }
    }
    return null;
  }

  /**
   * Try direct API call for channel
   */
  private async tryDirectChannelApi(
    cleanChannelInput: string
  ): Promise<SlackApiResponse<string> | null> {
    console.log(`❌ Channel "${cleanChannelInput}" not found in cache, trying direct API call...`);

    try {
      const response = await this.makeRequest('conversations.info', {
        channel: cleanChannelInput,
      });

      if (response.channel) {
        console.log(
          `✅ Found channel via direct API: ${cleanChannelInput} -> ${response.channel.id}`
        );
        this.channelCache.set(response.channel.id, response.channel);
        return { ok: true, data: response.channel.id };
      }
    } catch (error) {
      console.log(`❌ Direct API call failed:`, error);
    }
    return null;
  }

  /**
   * Try with cache refresh
   */
  private async tryWithCacheRefresh(
    cleanChannelInput: string
  ): Promise<SlackApiResponse<string> | null> {
    console.log(`🔍 Trying to refresh channel cache and search again...`);
    this.channelCache.clear();
    const refreshResponse = await this.getChannels();

    if (refreshResponse.ok) {
      console.log(`✅ Refreshed cache with ${refreshResponse.data?.length || 0} channels`);

      for (const [channelId, channel] of this.channelCache.entries()) {
        if (channel.name && channel.name.toLowerCase() === cleanChannelInput.toLowerCase()) {
          console.log(
            `✅ Found channel by name after refresh: ${cleanChannelInput} -> ${channelId}`
          );
          return { ok: true, data: channelId };
        }
      }
    }
    return null;
  }

  /**
   * Check token scopes and capabilities
   */
  async checkTokenCapabilities(): Promise<SlackApiResponse<SlackAuthTestResponse>> {
    try {
      console.log('🔍 Checking token capabilities...');

      const authResponse = await this.testAuth();
      if (!authResponse.ok || !authResponse.data) {
        return {
          ok: false,
          error: 'Failed to get auth data',
        };
      }

      const authData = authResponse.data;
      console.log('🔍 Token info:', {
        user: authData?.user,
        team: authData?.team,
        scopes: authData?.scopes,
        url: authData?.url,
      });

      return {
        ok: true,
        data: authData,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to check token capabilities',
      };
    }
  }

  /**
   * Simple rate limiting implementation
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Simple rate limiting - wait at least 1 second between requests
    if (timeSinceLastRequest < 1000) {
      const delay = 1000 - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Make a rate-limited request to Slack API
   */
  // biome-ignore lint/suspicious/noExplicitAny: Slack API responses have dynamic structure
  private async makeRequest(endpoint: string, params: SlackApiParams = {}): Promise<any> {
    const url = new URL(`https://slack.com/api/${endpoint}`);

    // Add parameters to URL for GET requests
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined) {
        url.searchParams.append(key, String(params[key]));
      }
    });

    // Apply rate limiting
    await this.applyRateLimit();

    try {
      console.log(`🌐 Making Slack API request to: ${endpoint}`);

      const response = await request({
        url: url.toString(),
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = JSON.parse(response);
      console.log(`✅ Slack API response: ${data.ok ? 'Success' : `Error: ${data.error}`}`);

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Slack API request failed:`, error);
      throw error;
    }
  }
}
