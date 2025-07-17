/**
 * Universal Message Converter for Obsidian Plugin
 *
 * Converts messages from different services into a unified format for consistent
 * markdown generation. This enables service-agnostic processing and easy extension
 * to new messaging platforms.
 */

import type {
  SlackAttachment,
  SlackChannel,
  SlackFile,
  SlackMessage,
  SlackReaction,
  SlackUser,
} from '../../../types/slack';

// Universal message format for service-agnostic processing
export interface UniversalMessage {
  id: string;
  timestamp: Date;
  author: {
    id: string;
    name: string;
    displayName?: string;
    avatar?: string;
  };
  content: {
    text: string;
    formatted: string;
    mentions: string[];
    channels: string[];
    links: Array<{ url: string; text?: string }>;
  };
  attachments: UniversalAttachment[];
  files: UniversalFile[];
  reactions: Array<{ emoji: string; count: number; users: string[] }>;
  thread?: {
    parentId: string;
    replyCount: number;
    isReply: boolean;
  };
  metadata: {
    service: 'slack' | 'teams' | 'signal' | 'discord';
    channelId: string;
    channelName: string;
    isEdited: boolean;
    editedAt?: Date;
    isDeleted: boolean;
    permalink?: string;
  };
}

export interface UniversalAttachment {
  type: 'image' | 'file' | 'link' | 'quote' | 'card';
  title?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  color?: string;
  footer?: string;
  timestamp?: Date;
}

export interface UniversalFile {
  id: string;
  name: string;
  title?: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  localPath?: string;
  isImage: boolean;
  isDownloaded: boolean;
}

export interface ConversionOptions {
  includeAttachments: boolean;
  includeFiles: boolean;
  includeReactions: boolean;
  includeThreads: boolean;
  resolveUserNames: boolean;
  downloadFiles: boolean;
}

/**
 * Universal message converter supporting multiple services
 */
export class UniversalMessageConverter {
  private userCache = new Map<string, SlackUser>();
  private channelCache = new Map<string, SlackChannel>();

  /**
   * Convert Slack message to universal format
   */
  convertSlackMessage(
    message: SlackMessage,
    options: ConversionOptions,
    context: {
      channelId: string;
      channelName: string;
      userCache?: Map<string, SlackUser>;
    }
  ): UniversalMessage {
    // Update user cache if provided
    if (context.userCache) {
      this.userCache = context.userCache;
    }

    // Get user information
    const user = this.getUserInfo(message.user);

    // Process message components
    const processedText = this.processSlackText(message.text || '');
    const messageComponents = this.convertMessageComponents(message, options);
    const thread = this.processThreadInfo(message, options);

    // Build universal message
    const universalMessage = this.buildUniversalMessage(
      message,
      user,
      processedText,
      messageComponents,
      context
    );

    // Add thread information if present
    if (thread) {
      universalMessage.thread = thread;
    }

    return universalMessage;
  }

  /**
   * Get user display name
   */
  private getUserDisplayName(
    user: SlackUser | { id: string; name: string; displayName: string }
  ): string {
    if ('profile' in user) {
      return user.profile?.display_name || user.profile?.real_name || user.name || 'unknown';
    }
    // Handle the case where user has displayName property (camelCase)
    return (user as { displayName?: string }).displayName || user.name || 'unknown';
  }

  /**
   * Get user avatar
   */
  private getUserAvatar(
    user: SlackUser | { id: string; name: string; displayName: string }
  ): string | undefined {
    if ('profile' in user) {
      return user.profile?.image_72;
    }
    return undefined;
  }

  /**
   * Get user information
   */
  private getUserInfo(
    userId?: string
  ): SlackUser | { id: string; name: string; displayName: string } {
    return (
      this.userCache.get(userId || '') || {
        id: userId || 'unknown',
        name: userId || 'unknown',
        displayName: userId || 'unknown',
      }
    );
  }

  /**
   * Convert message components (attachments, files, reactions)
   */
  private convertMessageComponents(
    message: SlackMessage,
    options: ConversionOptions
  ): {
    attachments: UniversalAttachment[];
    files: UniversalFile[];
    reactions: Array<{ emoji: string; count: number; users: string[] }>;
  } {
    return {
      attachments: options.includeAttachments
        ? this.convertSlackAttachments(message.attachments || [])
        : [],
      files: options.includeFiles ? this.convertSlackFiles(message.files || []) : [],
      reactions: options.includeReactions
        ? this.convertSlackReactions(message.reactions || [])
        : [],
    };
  }

  /**
   * Process thread information
   */
  private processThreadInfo(
    message: SlackMessage,
    options: ConversionOptions
  ):
    | {
        parentId: string;
        replyCount: number;
        isReply: boolean;
      }
    | undefined {
    return options.includeThreads && message.thread_ts
      ? {
          parentId: message.thread_ts,
          replyCount: message.reply_count || 0,
          isReply: message.thread_ts !== message.ts,
        }
      : undefined;
  }

  /**
   * Build universal message object
   */
  private buildUniversalMessage(
    message: SlackMessage,
    user: SlackUser | { id: string; name: string; displayName: string },
    processedText: {
      formatted: string;
      mentions: string[];
      channels: string[];
      links: Array<{ url: string; text?: string }>;
    },
    components: {
      attachments: UniversalAttachment[];
      files: UniversalFile[];
      reactions: Array<{ emoji: string; count: number; users: string[] }>;
    },
    context: { channelId: string; channelName: string }
  ): UniversalMessage {
    const avatar = this.getUserAvatar(user);

    return {
      id: message.ts,
      timestamp: new Date(parseFloat(message.ts) * 1000),
      author: {
        id: user.id,
        name: user.name || 'unknown',
        displayName: this.getUserDisplayName(user),
        ...(avatar && { avatar }),
      },
      content: {
        text: message.text || '',
        formatted: processedText.formatted,
        mentions: processedText.mentions,
        channels: processedText.channels,
        links: processedText.links,
      },
      attachments: components.attachments,
      files: components.files,
      reactions: components.reactions,
      metadata: {
        service: 'slack',
        channelId: context.channelId,
        channelName: context.channelName,
        isEdited: !!message.edited,
        ...(message.edited && { editedAt: new Date(parseFloat(message.edited.ts) * 1000) }),
        isDeleted: false,
        permalink: `https://slack.com/archives/${context.channelId}/p${message.ts.replace('.', '')}`,
      },
    };
  }

  /**
   * Process Slack text formatting
   */
  private processSlackText(text: string): {
    formatted: string;
    mentions: string[];
    channels: string[];
    links: Array<{ url: string; text?: string }>;
  } {
    let formatted = text;
    const mentions: string[] = [];
    const channels: string[] = [];
    const links: Array<{ url: string; text?: string }> = [];

    // Process user mentions
    formatted = formatted.replace(/<@([UW][A-Z0-9]+)(?:\|([^>]+))?>/g, (_match, userId, name) => {
      mentions.push(userId);
      const displayName = name || this.userCache.get(userId)?.name || userId;
      return `@${displayName}`;
    });

    // Process channel mentions
    formatted = formatted.replace(/<#([C][A-Z0-9]+)(?:\|([^>]+))?>/g, (_match, channelId, name) => {
      channels.push(channelId);
      const displayName = name || this.channelCache.get(channelId)?.name || channelId;
      return `#${displayName}`;
    });

    // Process links
    formatted = formatted.replace(/<(https?:\/\/[^|>]+)(?:\|([^>]+))?>/g, (_match, url, text) => {
      links.push({ url, text });
      return text ? `[${text}](${url})` : url;
    });

    // Process formatting
    formatted = formatted
      .replace(/\*([^*]+)\*/g, '**$1**') // Bold
      .replace(/_([^_]+)_/g, '*$1*') // Italic
      .replace(/`([^`]+)`/g, '`$1`') // Code
      .replace(/```([^`]+)```/g, '```\n$1\n```'); // Code blocks

    return { formatted, mentions, channels, links };
  }

  /**
   * Convert Slack attachments to universal format
   */
  private convertSlackAttachments(attachments: SlackAttachment[]): UniversalAttachment[] {
    return attachments.map((attachment) => {
      const universal: UniversalAttachment = {
        type: attachment.image_url ? 'image' : 'card',
        ...(attachment.title && { title: attachment.title }),
        ...(attachment.text && { text: attachment.text }),
        ...(attachment.title_link && { url: attachment.title_link }),
        ...(attachment.image_url && { imageUrl: attachment.image_url }),
        ...(attachment.thumb_url && { thumbnailUrl: attachment.thumb_url }),
        ...(attachment.color && { color: attachment.color }),
        ...(attachment.footer && { footer: attachment.footer }),
        ...(attachment.ts && { timestamp: new Date(parseFloat(attachment.ts) * 1000) }),
      };

      // Convert fields
      if (attachment.fields) {
        universal.fields = attachment.fields.map((field) => ({
          title: field.title,
          value: field.value,
          ...(field.short !== undefined && { short: field.short }),
        }));
      }

      return universal;
    });
  }

  /**
   * Convert Slack files to universal format
   */
  private convertSlackFiles(files: SlackFile[]): UniversalFile[] {
    return files.map((file) => ({
      id: file.id,
      name: file.name || 'unknown',
      ...(file.title && { title: file.title }),
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || 0,
      url: file.url_private || file.permalink || '',
      ...(file.thumb_360 && { thumbnailUrl: file.thumb_360 }),
      ...(file.url_private_download && { downloadUrl: file.url_private_download }),
      isImage: file.mimetype?.startsWith('image/') || false,
      isDownloaded: false,
    }));
  }

  /**
   * Convert Slack reactions to universal format
   */
  private convertSlackReactions(
    reactions: SlackReaction[]
  ): Array<{ emoji: string; count: number; users: string[] }> {
    return reactions.map((reaction) => ({
      emoji: reaction.name,
      count: reaction.count,
      users: reaction.users || [],
    }));
  }

  /**
   * Convert universal message to markdown
   */
  convertToMarkdown(message: UniversalMessage, options: ConversionOptions): string {
    const parts: string[] = [];

    // Add header
    this.addMessageHeader(parts, message);

    // Add content
    this.addMessageContent(parts, message);

    // Add attachments
    this.addMessageAttachments(parts, message, options);

    // Add files
    this.addMessageFiles(parts, message, options);

    // Add reactions
    this.addMessageReactions(parts, message, options);

    return parts.join('\n');
  }

  /**
   * Add message header (timestamp and author)
   */
  private addMessageHeader(parts: string[], message: UniversalMessage): void {
    const timestamp = message.timestamp.toISOString();
    const author = message.author.displayName || message.author.name;
    parts.push(`**${author}** - ${timestamp}`);
  }

  /**
   * Add message content
   */
  private addMessageContent(parts: string[], message: UniversalMessage): void {
    if (message.content.formatted) {
      parts.push('');
      parts.push(message.content.formatted);
    }
  }

  /**
   * Add message attachments
   */
  private addMessageAttachments(
    parts: string[],
    message: UniversalMessage,
    options: ConversionOptions
  ): void {
    if (options.includeAttachments && message.attachments.length > 0) {
      parts.push('');
      parts.push('**Attachments:**');
      for (const attachment of message.attachments) {
        if (attachment.title) {
          parts.push(`- [${attachment.title}](${attachment.url})`);
        }
        if (attachment.text) {
          parts.push(`  ${attachment.text}`);
        }
      }
    }
  }

  /**
   * Add message files
   */
  private addMessageFiles(
    parts: string[],
    message: UniversalMessage,
    options: ConversionOptions
  ): void {
    if (options.includeFiles && message.files.length > 0) {
      parts.push('');
      parts.push('**Files:**');
      for (const file of message.files) {
        const fileLink = this.formatFileLink(file);
        if (fileLink) {
          parts.push(fileLink);
        }
      }
    }
  }

  /**
   * Format a file link
   */
  private formatFileLink(file: UniversalFile): string | null {
    if (file.localPath) {
      // Use proper markdown image syntax for images
      if (file.isImage) {
        return `- ![${file.name}](${file.localPath})`;
      } else {
        return `- [${file.name}](${file.localPath})`;
      }
    } else {
      return `- ${file.name} (${file.size} bytes)`;
    }
  }

  /**
   * Add message reactions
   */
  private addMessageReactions(
    parts: string[],
    message: UniversalMessage,
    options: ConversionOptions
  ): void {
    if (options.includeReactions && message.reactions.length > 0) {
      parts.push('');
      const reactionStr = message.reactions.map((r) => `${r.emoji} ${r.count}`).join(' ');
      parts.push(`**Reactions:** ${reactionStr}`);
    }
  }

  /**
   * Update user cache
   */
  updateUserCache(userCache: Map<string, SlackUser>): void {
    this.userCache = userCache;
  }

  /**
   * Update channel cache
   */
  updateChannelCache(channelCache: Map<string, SlackChannel>): void {
    this.channelCache = channelCache;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.userCache.clear();
    this.channelCache.clear();
  }
}
