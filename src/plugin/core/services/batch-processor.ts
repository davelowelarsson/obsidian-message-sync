import type { MessageBatch, ProcessingProgress } from '../../../types/markdown';
import type { SlackChannel, SlackMessage } from '../../../types/slack';
import type { ChannelHistoryOptions, SlackService } from './slack-service';

export interface BatchProcessorOptions {
  /** Number of messages to process in each batch */
  batchSize: number;
  /** Delay between batches in milliseconds */
  delayBetweenBatches: number;
  /** Maximum number of API requests per minute */
  rateLimitPerMinute: number;
  /** Whether to process from newest to oldest */
  processReverse: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: ProcessingProgress) => void;
  /** Callback for batch completion */
  onBatchComplete?: (batch: MessageBatch) => void;
  /** Callback for errors */
  onError?: (error: Error, context: { channelId: string; cursor?: string | undefined }) => void;
}

export interface BatchProcessingState {
  cursor?: string | undefined;
  totalMessages: number;
  processedMessages: number;
  batchNumber: number;
}

export interface BatchResult {
  success: boolean;
  messages: SlackMessage[];
  hasMore: boolean;
  nextCursor?: string | undefined;
}

/**
 * Browser-compatible batch processor for Slack messages
 *
 * This service handles:
 * - Batch processing with pagination
 * - Rate limiting and delays
 * - Progress tracking and callbacks
 * - Error handling and recovery
 * - Integration with plugin services
 */
export class BatchProcessor {
  private slackService: SlackService;
  private options: BatchProcessorOptions;
  private isProcessing = false;
  private shouldStop = false;

  constructor(slackService: SlackService, options: BatchProcessorOptions) {
    this.slackService = slackService;
    this.options = this.validateOptions(options);
  }

  /**
   * Validate batch processor options
   */
  private validateOptions(options: BatchProcessorOptions): BatchProcessorOptions {
    if (options.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }
    if (options.delayBetweenBatches < 0) {
      throw new Error('Delay between batches cannot be negative');
    }
    if (options.rateLimitPerMinute <= 0) {
      throw new Error('Rate limit per minute must be positive');
    }
    return options;
  }

  /**
   * Process all messages from a channel in batches
   */
  async processChannel(channelId: string, channel?: SlackChannel): Promise<SlackMessage[]> {
    if (this.isProcessing) {
      throw new Error('Batch processor is already running');
    }

    this.isProcessing = true;
    this.shouldStop = false;

    try {
      const channelInfo = await this.getChannelInfo(channelId, channel);
      const allMessages: SlackMessage[] = [];

      await this.processBatches(channelId, channelInfo, allMessages);

      return allMessages;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get channel information, either from parameter or by fetching
   */
  private async getChannelInfo(channelId: string, channel?: SlackChannel): Promise<SlackChannel> {
    if (channel) {
      return channel;
    }

    // If no channel info provided, create a basic one
    return {
      id: channelId,
      name: `channel-${channelId}`,
    };
  }

  /**
   * Process message batches for a channel
   */
  private async processBatches(
    channelId: string,
    channel: SlackChannel,
    allMessages: SlackMessage[]
  ): Promise<void> {
    const state = this.initializeBatchState(channelId, channel);

    do {
      if (this.shouldStop) {
        break;
      }

      await this.checkRateLimit();

      const batchResult = await this.processNextBatch(channelId, channel, state);

      if (!batchResult.success) {
        break;
      }

      // Add messages to collection
      allMessages.push(...batchResult.messages);

      this.updateBatchState(state, batchResult);

      if (!batchResult.hasMore) {
        break;
      }

      await this.delayBetweenBatches();
    } while (state.cursor && !this.shouldStop);

    this.reportFinalProgress(channelId, channel, state);
  }

  /**
   * Initialize batch processing state
   */
  private initializeBatchState(channelId: string, channel: SlackChannel): BatchProcessingState {
    const state: BatchProcessingState = {
      cursor: undefined,
      totalMessages: 0,
      processedMessages: 0,
      batchNumber: 1,
    };

    this.reportProgress({
      channelId,
      channelName: channel.name || 'unknown',
      totalMessages: 0,
      processedMessages: 0,
      currentBatch: state.batchNumber,
      status: 'starting',
    });

    return state;
  }

  /**
   * Process the next batch and handle errors
   */
  private async processNextBatch(
    channelId: string,
    channel: SlackChannel,
    state: BatchProcessingState
  ): Promise<BatchResult> {
    try {
      const batchResult = await this.processSingleBatch(
        channelId,
        channel,
        state.cursor,
        state.batchNumber
      );

      if (!batchResult.messages.length) {
        return { success: false, hasMore: false, messages: [], nextCursor: undefined };
      }

      return { success: true, ...batchResult };
    } catch (error) {
      const shouldStop = this.handleBatchError(error, channelId, state.cursor);
      if (shouldStop) {
        throw error;
      }
      state.batchNumber++;
      return { success: false, hasMore: false, messages: [], nextCursor: undefined };
    }
  }

  /**
   * Update batch processing state after successful batch
   */
  private updateBatchState(state: BatchProcessingState, batchResult: BatchResult): void {
    // Update totals and progress
    if (state.totalMessages === 0) {
      state.totalMessages = batchResult.hasMore
        ? batchResult.messages.length * 10
        : batchResult.messages.length;
    }

    state.processedMessages += batchResult.messages.length;
    state.cursor = batchResult.nextCursor;
    state.batchNumber++;
  }

  /**
   * Report final processing progress
   */
  private reportFinalProgress(
    channelId: string,
    channel: SlackChannel,
    state: BatchProcessingState
  ): void {
    this.reportProgress({
      channelId,
      channelName: channel.name || 'unknown',
      totalMessages: state.processedMessages,
      processedMessages: state.processedMessages,
      currentBatch: state.batchNumber - 1,
      status: this.shouldStop ? 'stopped' : 'completed',
    });
  }

  /**
   * Handle delay between batches
   */
  private async delayBetweenBatches(): Promise<void> {
    if (this.options.delayBetweenBatches > 0) {
      await this.delay(this.options.delayBetweenBatches);
    }
  }

  /**
   * Process a single batch of messages
   */
  private async processSingleBatch(
    channelId: string,
    channel: SlackChannel,
    cursor: string | undefined,
    batchNumber: number
  ): Promise<{ messages: SlackMessage[]; hasMore: boolean; nextCursor?: string | undefined }> {
    const options: ChannelHistoryOptions = {
      channel: channelId,
      limit: this.options.batchSize,
    };

    if (cursor) {
      options.oldest = cursor;
    }

    const response = await this.slackService.getChannelMessages(options);

    if (!response.ok || !response.data) {
      throw new Error(response.error || 'Failed to get channel messages');
    }

    const { messages, hasMore, cursor: nextCursor } = response.data;

    if (messages.length === 0) {
      return { messages: [], hasMore: false };
    }

    // Create batch for callback
    const batch: MessageBatch = {
      channelId,
      channelName: channel.name || 'unknown',
      messages,
      batchNumber,
      timestamp: new Date().toISOString(),
      hasMore,
      ...(nextCursor && { cursor: nextCursor }),
    };

    this.options.onBatchComplete?.(batch);

    return {
      messages,
      hasMore,
      nextCursor: nextCursor || undefined,
    };
  }

  /**
   * Handle batch processing errors
   */
  private handleBatchError(error: unknown, channelId: string, cursor?: string): boolean {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    this.options.onError?.(errorObj, {
      channelId,
      cursor,
    });

    // For certain errors, we should stop processing
    if (errorObj.message.includes('rate limited') || errorObj.message.includes('forbidden')) {
      return true;
    }

    return false;
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    // Simple rate limiting - just add a delay
    await this.delay(Math.max(0, (1000 / this.options.rateLimitPerMinute) * 60));
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ProcessingProgress): void {
    this.options.onProgress?.(progress);
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stop the batch processing
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if the processor is currently running
   */
  isRunning(): boolean {
    return this.isProcessing;
  }
}
