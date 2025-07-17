import { Notice } from 'obsidian';

/**
 * Log levels for the plugin
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  error?: Error;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  level: LogLevel;
  /** Show notices in Obsidian for important messages */
  showNotices: boolean;
  /** Maximum number of log entries to keep in memory */
  maxEntries: number;
  /** Enable console logging */
  enableConsole: boolean;
  /** Enable file logging (future feature) */
  enableFile: boolean;
  /** Log file path (future feature) */
  logFilePath?: string;
  /** Include stack traces for errors */
  includeStack: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  showNotices: true,
  maxEntries: 1000,
  enableConsole: true,
  enableFile: false,
  includeStack: true,
};

/**
 * Plugin logger with multiple output channels
 */
export class PluginLogger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private contexts = new Map<string, LogEntry[]>();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: string, error?: Error | unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log(LogLevel.ERROR, message, context, undefined, errorObj);
  }

  /**
   * Log a message with specified level
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown,
    error?: Error
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = this.createLogEntry(level, message, context, data, error);

    // Add to entries and manage storage
    this.storeLogEntry(entry);

    // Handle outputs
    this.handleLogOutput(entry);
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
    };

    if (context) {
      entry.context = context;
    }

    if (data !== undefined) {
      entry.data = data;
    }

    if (error) {
      entry.error = error;
    }

    return entry;
  }

  /**
   * Store log entry in memory
   */
  private storeLogEntry(entry: LogEntry): void {
    // Add to entries
    this.entries.push(entry);

    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Add to context-specific entries
    if (entry.context) {
      this.addToContextEntries(entry);
    }
  }

  /**
   * Add entry to context-specific storage
   */
  private addToContextEntries(entry: LogEntry): void {
    if (!entry.context) return;

    if (!this.contexts.has(entry.context)) {
      this.contexts.set(entry.context, []);
    }
    const contextEntries = this.contexts.get(entry.context);
    if (contextEntries) {
      contextEntries.push(entry);

      // Maintain max entries per context
      if (contextEntries.length > 100) {
        contextEntries.shift();
      }
    }
  }

  /**
   * Handle log output to various destinations
   */
  private handleLogOutput(entry: LogEntry): void {
    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Show notice for important messages
    if (this.config.showNotices && entry.level >= LogLevel.WARN) {
      this.showNotice(entry);
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${this.formatTimestamp(entry.timestamp)}] [${LogLevel[entry.level]}]`;
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const fullMessage = `${prefix}${contextStr} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.info(fullMessage, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage, entry.data);
        if (entry.error && this.config.includeStack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Show Obsidian notice for important messages
   */
  private showNotice(entry: LogEntry): void {
    const contextStr = entry.context ? `[${entry.context}] ` : '';
    const message = `${contextStr}${entry.message}`;

    if (entry.level === LogLevel.ERROR) {
      new Notice(`❌ ${message}`, 8000);
    } else if (entry.level === LogLevel.WARN) {
      new Notice(`⚠️ ${message}`, 5000);
    }
  }

  /**
   * Get all log entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get log entries for specific context
   */
  getEntriesForContext(context: string): LogEntry[] {
    return this.contexts.get(context) || [];
  }

  /**
   * Get log entries by level
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  /**
   * Get recent log entries
   */
  getRecentEntries(count: number = 50): LogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Clear all log entries
   */
  clearEntries(): void {
    this.entries = [];
    this.contexts.clear();
  }

  /**
   * Clear entries for specific context
   */
  clearContext(context: string): void {
    this.contexts.delete(context);
    this.entries = this.entries.filter((entry) => entry.context !== context);
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Format log entry for export
   */
  formatEntry(entry: LogEntry): string {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = LogLevel[entry.level].padEnd(5);
    const context = entry.context ? `[${entry.context}] ` : '';
    let message = `${timestamp} ${level} ${context}${entry.message}`;

    if (entry.data) {
      message += ` | Data: ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      message += ` | Error: ${entry.error.message}`;
      if (this.config.includeStack && entry.error.stack) {
        message += `\\n${entry.error.stack}`;
      }
    }

    return message;
  }

  /**
   * Export logs as text
   */
  exportLogs(context?: string): string {
    const entries = context ? this.getEntriesForContext(context) : this.entries;
    return entries.map((entry) => this.formatEntry(entry)).join('\\n');
  }

  /**
   * Get log statistics
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    contexts: string[];
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entriesByLevel: Record<string, number> = {};

    // Count entries by level
    for (const level of Object.values(LogLevel)) {
      if (typeof level === 'number') {
        entriesByLevel[LogLevel[level]] = this.entries.filter((e) => e.level === level).length;
      }
    }

    const stats = {
      totalEntries: this.entries.length,
      entriesByLevel,
      contexts: Array.from(this.contexts.keys()),
    };

    // Add optional properties only if they exist
    if (this.entries.length > 0) {
      const oldestEntry = this.entries[0];
      const newestEntry = this.entries[this.entries.length - 1];

      if (oldestEntry) {
        (stats as Record<string, unknown>)['oldestEntry'] = oldestEntry.timestamp;
      }
      if (newestEntry) {
        (stats as Record<string, unknown>)['newestEntry'] = newestEntry.timestamp;
      }
    }

    return stats;
  }
}

/**
 * Create a context-specific logger
 */
export function createContextLogger(context: string, baseLogger: PluginLogger): ContextLogger {
  return new ContextLogger(context, baseLogger);
}

/**
 * Context-specific logger that automatically adds context to all log messages
 */
export class ContextLogger {
  constructor(
    private context: string,
    private baseLogger: PluginLogger
  ) {}

  debug(message: string, data?: unknown): void {
    this.baseLogger.debug(message, this.context, data);
  }

  info(message: string, data?: unknown): void {
    this.baseLogger.info(message, this.context, data);
  }

  warn(message: string, data?: unknown): void {
    this.baseLogger.warn(message, this.context, data);
  }

  error(message: string, error?: Error | unknown): void {
    this.baseLogger.error(message, this.context, error);
  }
}

/**
 * Global logger instance
 */
export let logger: PluginLogger;

/**
 * Initialize the global logger
 */
export function initializeLogger(config?: Partial<LoggerConfig>): PluginLogger {
  logger = new PluginLogger(config);
  return logger;
}

/**
 * Get the global logger instance
 */
export function getLogger(): PluginLogger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initializeLogger() first.');
  }
  return logger;
}
