/**
 * Template Resolver for Obsidian Plugin
 *
 * Resolves template variables in output paths and filenames.
 * Supports various template variables like {{date}}, {{channel}}, etc.
 */

import type { SlackChannel } from '../../../types/slack';

export interface TemplateVariables {
  date: string;
  channel: string;
  channelId: string;
  year: string;
  month: string;
  day: string;
  timestamp: string;
  messageCount?: number;
  userId?: string;
  userName?: string;
}

export interface TemplateResolverOptions {
  dateFormat: 'iso' | 'locale' | 'simple';
  channelNameFormat: 'name' | 'id' | 'both';
  sanitizeFilenames: boolean;
}

/**
 * Resolves template variables in strings
 */
export class TemplateResolver {
  private options: TemplateResolverOptions;

  constructor(options: Partial<TemplateResolverOptions> = {}) {
    this.options = {
      dateFormat: 'simple',
      channelNameFormat: 'name',
      sanitizeFilenames: true,
      ...options,
    };
  }

  /**
   * Resolve template variables in a string
   */
  resolveTemplate(template: string, variables: TemplateVariables): string {
    let result = template;

    console.log('🔍 Resolving template:', { template, variables });

    // Replace all template variables with safe handling
    result = result.replace(/\{\{date\}\}/g, variables.date || '');
    result = result.replace(/\{\{channel\}\}/g, variables.channel || '');
    result = result.replace(/\{\{channelId\}\}/g, variables.channelId || '');
    result = result.replace(/\{\{year\}\}/g, variables.year || '');
    result = result.replace(/\{\{month\}\}/g, variables.month || '');
    result = result.replace(/\{\{day\}\}/g, variables.day || '');
    result = result.replace(/\{\{timestamp\}\}/g, variables.timestamp || '');

    // Optional variables
    if (variables.messageCount !== undefined) {
      result = result.replace(/\{\{messageCount\}\}/g, variables.messageCount.toString());
    }
    if (variables.userId) {
      result = result.replace(/\{\{userId\}\}/g, variables.userId);
    }
    if (variables.userName) {
      result = result.replace(/\{\{userName\}\}/g, variables.userName);
    }

    // Sanitize path components safely (preserve directory structure)
    if (this.options.sanitizeFilenames) {
      result = this.sanitizePath(result);
    }

    console.log('🔍 Template resolved to:', result);
    return result;
  }

  /**
   * Create template variables from channel and date
   */
  createTemplateVariables(channel: SlackChannel, date: Date = new Date()): TemplateVariables {
    console.log('🔍 Creating template variables for channel:', channel);

    const channelName = this.formatChannelName(channel);
    const dateString = this.formatDate(date);

    console.log('🔍 Formatted channel name:', channelName);
    console.log('🔍 Formatted date:', dateString);

    const variables = {
      date: dateString,
      channel: channelName,
      channelId: channel.id,
      year: date.getFullYear().toString(),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0'),
      timestamp: date.getTime().toString(),
    };

    console.log('🔍 Created template variables:', variables);
    return variables;
  }

  /**
   * Resolve output path template
   */
  resolveOutputPath(template: string, channel: SlackChannel, date: Date = new Date()): string {
    console.log('🔍 Template resolver - resolveOutputPath called with:', {
      template,
      channel,
      date: date.toISOString(),
    });

    if (!template) {
      throw new Error('Template is required');
    }

    if (!channel) {
      throw new Error('Channel is required');
    }

    const variables = this.createTemplateVariables(channel, date);
    console.log('🔍 Template variables created:', variables);

    const resolved = this.resolveTemplate(template, variables);
    console.log('🔍 Template resolved to:', resolved);

    return resolved;
  }

  /**
   * Resolve filename template
   */
  resolveFilename(template: string, channel: SlackChannel, date: Date = new Date()): string {
    const variables = this.createTemplateVariables(channel, date);
    const filename = this.resolveTemplate(template, variables);

    // Ensure filename has extension
    if (!filename.includes('.')) {
      return `${filename}.md`;
    }

    return filename;
  }

  /**
   * Get available template variables
   */
  getAvailableVariables(): string[] {
    return [
      '{{date}}',
      '{{channel}}',
      '{{channelId}}',
      '{{year}}',
      '{{month}}',
      '{{day}}',
      '{{timestamp}}',
      '{{messageCount}}',
      '{{userId}}',
      '{{userName}}',
    ];
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unclosed template variables
    const unclosedMatches = template.match(/\{\{[^}]*$/g);
    if (unclosedMatches) {
      errors.push('Unclosed template variable found');
    }

    // Check for unopened template variables
    const unopenedMatches = template.match(/^[^{]*\}\}/g);
    if (unopenedMatches) {
      errors.push('Unopened template variable found');
    }

    // Check for unknown template variables
    const variableMatches = template.match(/\{\{([^}]+)\}\}/g);
    if (variableMatches) {
      const availableVars = this.getAvailableVariables();
      const unknownVars = variableMatches.filter((match) => !availableVars.includes(match));

      if (unknownVars.length > 0) {
        warnings.push(`Unknown template variables: ${unknownVars.join(', ')}`);
      }
    }

    // Check for potentially problematic characters
    const problematicChars = /[<>:"/\\|?*]/;
    if (problematicChars.test(template)) {
      warnings.push('Template contains characters that may cause issues in file paths');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format channel name according to options
   */
  private formatChannelName(channel: SlackChannel): string {
    let channelName = channel.name || channel.id;

    // Special handling for DM channels
    if (channelName.startsWith('DM with ')) {
      // Convert "DM with David Lowe Larsson" to "dm-davidlowelarsson"
      const userName = channelName.replace('DM with ', '').toLowerCase();
      channelName = `dm-${userName.replace(/\s+/g, '')}`;
    } else if (channelName.startsWith('Group DM')) {
      // Handle group DMs
      channelName = `group-dm-${channel.id}`;
    } else if (channel.id.startsWith('D') && channelName === channel.id) {
      // Handle raw DM channel IDs - fallback when name resolution didn't work
      // Check if this is an IM channel
      if (channel.is_im) {
        channelName = `dm-${channel.id.toLowerCase()}`;
      } else {
        // Assume it's a DM if ID starts with D and no name was resolved
        channelName = `dm-${channel.id.toLowerCase()}`;
      }
    }

    switch (this.options.channelNameFormat) {
      case 'name':
        return channelName;
      case 'id':
        return channel.id;
      case 'both':
        return channelName !== channel.id ? `${channelName}-${channel.id}` : channel.id;
      default:
        return channelName;
    }
  }

  /**
   * Format date according to options
   */
  private formatDate(date: Date): string {
    switch (this.options.dateFormat) {
      case 'iso':
        return date.toISOString().split('T')[0] || date.toISOString().substring(0, 10);
      case 'locale':
        return date.toLocaleDateString();
      case 'simple':
        return date.toISOString().split('T')[0] || date.toISOString().substring(0, 10);
      default:
        return date.toISOString().split('T')[0] || date.toISOString().substring(0, 10);
    }
  }

  /**
   * Sanitize path by preserving directory structure but cleaning individual components
   */
  private sanitizePath(path: string): string {
    // Split path into components, sanitize each component separately, then rejoin
    const parts = path.split('/');
    const sanitizedParts = parts.map((part) => {
      if (part === '') return part; // Preserve empty parts (leading/trailing slashes)
      return this.sanitizeFilename(part);
    });
    return sanitizedParts.join('/');
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFilename(filename: string): string {
    return (
      filename
        // Replace dangerous characters (but NOT forward slashes - those are handled by sanitizePath)
        .replace(/[<>:"\\|?*]/g, '_')
        // Replace whitespace with underscores
        .replace(/\\s+/g, '_')
        // Remove multiple consecutive underscores
        .replace(/_{2,}/g, '_')
        // Remove leading/trailing underscores
        .replace(/^_|_$/g, '')
        // Limit length
        .substring(0, 200)
    );
  }

  /**
   * Update resolver options
   */
  updateOptions(newOptions: Partial<TemplateResolverOptions>): void {
    this.options = {
      ...this.options,
      ...newOptions,
    };
  }

  /**
   * Get current resolver options
   */
  getOptions(): TemplateResolverOptions {
    return { ...this.options };
  }

  /**
   * Public method to format channel name for external use
   */
  public getFormattedChannelName(channel: SlackChannel): string {
    return this.formatChannelName(channel);
  }
}
