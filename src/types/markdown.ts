/**
 * Types for markdown writing and content organization
 */

import { z } from 'zod';
import type { SlackMessage } from './slack';

// Zod schemas for runtime validation
export const WriterOptionsSchema = z.object({
  /** Output directory for markdown files */
  outputDir: z.string(),
  /** Organization mode for files */
  organization: z.enum(['daily', 'monthly', 'yearly']),
  /** Maximum number of messages per file */
  messagesPerFile: z.number().positive().optional(),
  /** Whether to include attachments */
  includeAttachments: z.boolean().optional(),
  /** Whether to download and embed images */
  downloadImages: z.boolean().optional(),
  /** Whether to download all file attachments */
  downloadFiles: z.boolean().optional(),
  /** Directory for downloaded assets relative to output dir */
  assetsDir: z.string().optional(),
  /** Custom filename template */
  filenameTemplate: z.string().optional(),
  /** Maximum batch size for API requests */
  batchSize: z.number().positive().optional(),
  /** Rate limit delay between requests (ms) */
  rateLimitDelay: z.number().nonnegative().optional(),
});

export type WriterOptions = z.infer<typeof WriterOptionsSchema>;

export interface MessageBatch {
  /** Channel ID */
  channelId: string;
  /** Channel name */
  channelName: string;
  /** Messages in this batch */
  messages: SlackMessage[];
  /** Batch number */
  batchNumber: number;
  /** Timestamp when batch was created */
  timestamp: string;
  /** Whether there are more messages to fetch */
  hasMore: boolean;
  /** Cursor for next batch */
  cursor?: string;
}

export interface MarkdownContent {
  /** File path where content should be written */
  filePath: string;
  /** Markdown content */
  content: string;
  /** File metadata */
  metadata: {
    channel: string;
    dateRange: {
      start: Date;
      end: Date;
    };
    messageCount: number;
    generatedAt: Date;
  };
}

// Removed unused RichContentItem interface - not currently used in codebase

export interface ProcessingProgress {
  /** Current channel being processed */
  channelId: string;
  /** Channel name */
  channelName: string;
  /** Messages processed so far */
  processedMessages: number;
  /** Total messages to process (if known) */
  totalMessages: number;
  /** Current batch number */
  currentBatch: number;
  /** Processing status */
  status: 'starting' | 'processing' | 'completed' | 'stopped' | 'error';
}

// Re-export types from slack.ts for convenience
export type { SlackChannel, SlackMessage, SlackUser } from './slack';
