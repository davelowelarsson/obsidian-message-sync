/**
 * Markdown Processor for Obsidian Plugin
 *
 * Handles creating and formatting markdown content from Slack messages.
 * This processor is optimized for the Obsidian plugin environment and
 * includes features like user resolution, file attachment handling, and
 * template-based output formatting.
 */

import type { SlackChannel, SlackFile, SlackMessage, SlackUser } from '../../../types/slack';
import type { FileDownloadResult } from '../services/file-download-service';

export interface MarkdownProcessorOptions {
  includeMetadata: boolean;
  includeAttachments: boolean;
  includeThreads: boolean;
  dateFormat: 'iso' | 'locale' | 'relative';
  userDisplayFormat: 'username' | 'displayname' | 'realname';
}

export interface MessageContext {
  channel: SlackChannel;
  messages: SlackMessage[];
  userCache: Map<string, SlackUser>;
  fileDownloadResults?: Map<string, FileDownloadResult[]>;
}

export interface MarkdownOutput {
  content: string;
  metadata: {
    channelId: string;
    channelName: string;
    messageCount: number;
    syncedAt: string;
    fileCount: number;
  };
}

/**
 * Processes Slack messages into markdown format
 */
export class MarkdownProcessor {
  private options: MarkdownProcessorOptions;

  constructor(options: Partial<MarkdownProcessorOptions> = {}) {
    this.options = {
      includeMetadata: true,
      includeAttachments: true,
      includeThreads: true,
      dateFormat: 'locale',
      userDisplayFormat: 'displayname',
      ...options,
    };
  }

  /**
   * Process messages into markdown content
   */
  processMessages(context: MessageContext): MarkdownOutput {
    const { channel, messages, userCache, fileDownloadResults } = context;

    const lines: string[] = [];
    let fileCount = 0;

    // Add header
    const channelName = channel.name || channel.id || 'Unknown Channel';
    lines.push(`# ${channelName}`);
    lines.push('');

    // Add metadata if enabled
    if (this.options.includeMetadata) {
      lines.push(`**Channel ID:** ${channel.id}`);
      lines.push(`**Synced:** ${new Date().toISOString()}`);
      lines.push(`**Messages:** ${messages.length}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Sort messages by timestamp (oldest first)
    const sortedMessages = messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    // Process each message
    for (const message of sortedMessages) {
      const messageContent = this.processMessage(message, userCache, fileDownloadResults);
      if (messageContent) {
        lines.push(messageContent);
        lines.push('');

        // Count files
        if (message.files && message.files.length > 0) {
          fileCount += message.files.length;
        }
      }
    }

    const content = lines.join('\n');

    return {
      content,
      metadata: {
        channelId: channel.id,
        channelName,
        messageCount: messages.length,
        syncedAt: new Date().toISOString(),
        fileCount,
      },
    };
  }

  /**
   * Process a single message
   */
  private processMessage(
    message: SlackMessage,
    userCache: Map<string, SlackUser>,
    fileDownloadResults?: Map<string, FileDownloadResult[]>
  ): string | null {
    if (!message.text && (!message.files || message.files.length === 0)) {
      return null;
    }

    const lines: string[] = [];

    // Format timestamp
    const timestamp = this.formatTimestamp(message.ts);

    // Get user display name
    const userName = this.getUserDisplayName(message.user, userCache);

    // Add message header
    lines.push(`## ${timestamp} - ${userName}`);
    lines.push('');

    // Add message text
    if (message.text) {
      const formattedText = this.formatMessageText(message.text);
      lines.push(formattedText);
      lines.push('');
    }

    // Add file attachments if enabled
    if (this.options.includeAttachments && message.files && message.files.length > 0) {
      const attachmentContent = this.processAttachments(
        message.files,
        fileDownloadResults?.get(message.ts)
      );
      if (attachmentContent) {
        lines.push(attachmentContent);
        lines.push('');
      }
    }

    // Add thread replies if enabled
    if (this.options.includeThreads && message.replies && message.replies.length > 0) {
      lines.push('### Thread Replies');
      lines.push('');

      for (const reply of message.replies) {
        const replyContent = this.processMessage(reply, userCache, fileDownloadResults);
        if (replyContent) {
          // Indent thread replies
          const indentedContent = replyContent
            .split('\n')
            .map((line) => (line.trim() ? `> ${line}` : line))
            .join('\n');
          lines.push(indentedContent);
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format message text (basic Slack formatting to markdown)
   */
  private formatMessageText(text: string): string {
    let formatted = text;

    // Process links with display text first
    formatted = formatted.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');

    // Process links without display text (only for URLs)
    formatted = formatted.replace(/<(https?:\/\/[^>]+)>/g, '$1');

    // Process user mentions
    formatted = formatted.replace(/<@([A-Z0-9]+)>/g, '@$1');

    // Process channel mentions
    formatted = formatted.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2');
    formatted = formatted.replace(/<#([A-Z0-9]+)>/g, '#$1');

    // Process text formatting with emoji protection
    formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**'); // Bold

    // Protect emoji codes from italic formatting: :emoji_name: should not become :emoji*name*:
    // First, temporarily replace emoji codes with placeholders (using a unique string without underscores)
    const emojiMatches: string[] = [];
    const emojiPlaceholder = 'XXEMOJIPLACEHOLDERXX';
    formatted = formatted.replace(/:([a-zA-Z0-9_+-]+):/g, (match) => {
      const placeholder = `${emojiPlaceholder}${emojiMatches.length}XX`;
      emojiMatches.push(match);
      return placeholder;
    });

    // Now apply italic formatting (won't affect emoji codes)
    formatted = formatted.replace(/_([^_]+)_/g, '*$1*'); // Italic

    // Restore emoji codes
    formatted = formatted.replace(new RegExp(`${emojiPlaceholder}(\\d+)XX`, 'g'), (_, index) => {
      return emojiMatches[parseInt(index)] || '';
    });

    formatted = formatted.replace(/`([^`]+)`/g, '`$1`'); // Code
    formatted = formatted.replace(/```([\s\S]+?)```/g, '```\n$1\n```'); // Code blocks

    return formatted;
  }

  /**
   * Process file attachments
   */
  private processAttachments(
    files: SlackFile[],
    downloadResults?: FileDownloadResult[]
  ): string | null {
    if (!files || files.length === 0) {
      return null;
    }

    const lines: string[] = [];
    lines.push('**Attachments:**');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        const attachmentLine = this.formatAttachmentLine(file, downloadResults);
        if (attachmentLine) {
          lines.push(attachmentLine);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single attachment line
   */
  private formatAttachmentLine(
    file: SlackFile,
    downloadResults?: FileDownloadResult[]
  ): string | null {
    const fileName = file.name || file.title || 'Unknown file';
    const isImage = file.mimetype?.startsWith('image/') || false;

    // Check if file was downloaded
    const downloadResult = downloadResults?.find(
      (result) => result.localPath.includes(file.id) || result.relativePath.includes(fileName)
    );

    if (downloadResult?.wasDownloaded) {
      return this.formatLocalFileLink(fileName, downloadResult.relativePath, isImage);
    } else {
      return this.formatSlackFileLink(fileName, file, isImage);
    }
  }

  /**
   * Format a link to a local file
   */
  private formatLocalFileLink(fileName: string, relativePath: string, isImage: boolean): string {
    const prefix = isImage ? '!' : '';
    return `- ${prefix}[${fileName}](${relativePath})`;
  }

  /**
   * Format a link to a Slack file
   */
  private formatSlackFileLink(fileName: string, file: SlackFile, isImage: boolean): string {
    const fileUrl = file.url_private || file.permalink;
    if (fileUrl) {
      const prefix = isImage ? '!' : '';
      return `- ${prefix}[${fileName}](${fileUrl})`;
    } else {
      return `- ${fileName}`;
    }
  }

  /**
   * Format timestamp according to options
   */
  private formatTimestamp(ts: string): string {
    const date = new Date(parseFloat(ts) * 1000);

    switch (this.options.dateFormat) {
      case 'iso':
        return date.toISOString();
      case 'locale':
        return date.toLocaleString();
      case 'relative':
        return this.getRelativeTime(date);
      default:
        return date.toLocaleString();
    }
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Get user display name based on options
   */
  private getUserDisplayName(
    userId: string | undefined,
    userCache: Map<string, SlackUser>
  ): string {
    if (!userId) {
      return 'Unknown User';
    }

    const user = userCache.get(userId);
    if (!user) {
      return userId;
    }

    switch (this.options.userDisplayFormat) {
      case 'username':
        return user.name || userId;
      case 'displayname':
        return user.profile?.display_name || user.profile?.real_name || user.name || userId;
      case 'realname':
        return user.profile?.real_name || user.name || userId;
      default:
        return user.profile?.display_name || user.profile?.real_name || user.name || userId;
    }
  }

  /**
   * Update processing options
   */
  updateOptions(newOptions: Partial<MarkdownProcessorOptions>): void {
    this.options = {
      ...this.options,
      ...newOptions,
    };
  }

  /**
   * Get current processing options
   */
  getOptions(): MarkdownProcessorOptions {
    return { ...this.options };
  }
}
