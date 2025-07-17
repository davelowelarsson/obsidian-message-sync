export interface MessageSyncSettings {
  configPath: string;
  autoSync: boolean;
  syncInterval: number; // minutes
  outputFolder: string;
  showNotifications: boolean;
  debugMode: boolean;
  organization: 'daily' | 'monthly' | 'yearly' | 'weekly';

  // Slack configurations - stored in plugin settings and synced to YAML
  slackConfigs: SlackConfig[];
}

export interface SlackConfig {
  id: string; // Unique identifier for this config
  name: string; // Display name (e.g., "primary-slack", "secondary-slack")
  token: string;
  channels: string[];
  output: string; // Template string like "sync/slack/{{channel}}/{{month}}.md"
  schedule: 'manual' | 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
  lastSync?: Date | null; // When this config was last synced
}

// YAML Configuration structure (maps to config.yaml)
export interface YamlConfig {
  global: {
    obsidian: {
      vaultPath: string;
      notesFolder: string;
      organization?: string;
      showNotifications?: boolean;
    };
    sync: {
      enabled: boolean;
      defaultSchedule: string;
      syncInterval?: number;
    };
    logging: {
      level: string;
    };
    environment: {
      nodeEnv: string;
    };
  };
  sources: {
    slack: SlackSourceConfig[];
    signal: never[]; // Placeholder for future Signal support
    teams: never[]; // Placeholder for future Teams support
    telegram: never[]; // Placeholder for future Telegram support
  };
}

export interface SlackSourceConfig {
  service: 'slack';
  name: string;
  token: string;
  channels: string[];
  output: string;
  schedule: string;
  enabled: boolean;
}

export interface SyncResult {
  messageCount: number;
  filesCreated: number;
  filesUpdated: number;
  errors: string[];
}

export interface MessageSyncViewState {
  isLoading: boolean;
  lastSync: Date | null;
  totalMessages: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  timestamp: Date;
  type: 'sync' | 'error' | 'config';
  message: string;
  details?: string;
}

export interface SyncOptions {
  channels?: string[];
  since?: Date;
  until?: Date;
  limit?: number;
  includeAttachments?: boolean;
  organization?: 'daily' | 'monthly' | 'yearly';
}

export interface ChannelInfo {
  id: string;
  name: string;
  memberCount?: number;
  lastActivity?: Date;
  isPrivate?: boolean;
  isArchived?: boolean;
}

// Enhanced configuration interfaces based on CLI system
export interface SlackSourceConfig {
  service: 'slack';
  name: string;
  channels: string[]; // Array of channel IDs to support multiple channels
  token: string;
  output: string;
  enabled: boolean;

  // Optional metadata
  description?: string;
  tags?: string[];

  // Performance settings
  maxMessages?: number;
  batchSize?: number;

  // Retry configuration
  retryAttempts?: number;
  retryDelay?: number;

  // Slack-specific settings
  includeThreads?: boolean;
  includeFiles?: boolean;
  userMentionFormat?: '@username' | '<@userid>' | 'username';
}

export interface EnhancedPluginConfig {
  version: string;

  // Global settings
  global: {
    obsidian: {
      vaultPath: string;
      notesFolder: string;
      createFoldersIfMissing: boolean;
      templateEngine: 'simple' | 'advanced';
    };
    sync: {
      enabled: boolean;
      defaultSchedule?: string;
      maxConcurrentSources: number;
      retryAttempts: number;
      retryDelay: number;
    };
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
      enableColors: boolean;
      timestampFormat: string;
    };
  };

  // Sources configuration
  sources: {
    slack: SlackSourceConfig[];
    // Future: signal, teams, telegram
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  config?: EnhancedPluginConfig;
  error?: string;
  warnings?: string[];
}

export interface TemplateContext {
  date: string;
  week: string;
  month: string;
  year: string;
  channelName?: string;
  sourceName?: string;
}
