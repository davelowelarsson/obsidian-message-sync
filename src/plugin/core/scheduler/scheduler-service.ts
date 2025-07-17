import type { Plugin } from 'obsidian';
import { PluginScheduler } from './plugin-scheduler';
import { type AutoSyncConfig, TaskIntervals, type TaskPriority } from './scheduler-types';

/**
 * Scheduler service that manages auto-sync and scheduled tasks for the plugin
 */
export class SchedulerService {
  private scheduler: PluginScheduler;
  private autoSyncConfig: AutoSyncConfig;
  private isInitialized = false;

  constructor(
    private plugin: Plugin,
    private syncCallback: () => Promise<void>,
    autoSyncConfig: AutoSyncConfig = {
      enabled: false,
      interval: TaskIntervals.FIFTEEN_MINUTES,
      services: ['slack'],
      onlyWhenActive: true,
      syncOnStartup: false,
    }
  ) {
    this.autoSyncConfig = autoSyncConfig;
    this.scheduler = new PluginScheduler({
      enableAutoSync: autoSyncConfig.enabled,
      defaultInterval: autoSyncConfig.interval,
      maxConcurrentTasks: 3,
      errorHandling: {
        retryAttempts: 2,
        retryDelay: 10000, // 10 seconds
        continueOnError: true,
      },
    });
  }

  /**
   * Initialize the scheduler service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Register the scheduler as a child component
    this.plugin.addChild(this.scheduler);

    // Set up auto-sync if enabled
    if (this.autoSyncConfig.enabled) {
      this.scheduleAutoSync();
    }

    // Perform initial sync if configured
    if (this.autoSyncConfig.syncOnStartup) {
      this.scheduleTask(
        'startup-sync',
        async () => {
          await this.syncCallback();
        },
        {
          immediate: true,
          interval: 0, // One-time task
        }
      );
    }

    this.isInitialized = true;
  }

  /**
   * Schedule auto-sync task
   */
  private scheduleAutoSync(): void {
    const taskName = 'auto-sync';

    // Remove existing auto-sync task if it exists
    this.scheduler.removeTask(taskName);

    // Schedule new auto-sync task
    this.scheduler.scheduleTask(
      taskName,
      async () => {
        // Check if we should sync (only when active if configured)
        if (this.autoSyncConfig.onlyWhenActive && !this.isAppActive()) {
          return;
        }

        await this.syncCallback();
      },
      {
        interval: this.autoSyncConfig.interval,
        enabled: this.autoSyncConfig.enabled,
        immediate: false,
        onError: (error) => {
          console.error('Auto-sync failed:', error);
          // Could emit an event here for UI notification
        },
      }
    );
  }

  /**
   * Schedule a one-time or recurring task
   */
  scheduleTask(
    name: string,
    task: () => Promise<void>,
    options: {
      interval?: number;
      enabled?: boolean;
      immediate?: boolean;
      priority?: TaskPriority;
      onError?: (error: Error) => void;
    } = {}
  ): void {
    this.scheduler.scheduleTask(name, task, {
      interval: options.interval ?? TaskIntervals.FIFTEEN_MINUTES,
      enabled: options.enabled ?? true,
      immediate: options.immediate ?? false,
      onError:
        options.onError ??
        ((error) => {
          console.error(`Task '${name}' failed:`, error);
        }),
    });
  }

  /**
   * Update auto-sync configuration
   */
  updateAutoSyncConfig(config: Partial<AutoSyncConfig>): void {
    this.autoSyncConfig = { ...this.autoSyncConfig, ...config };

    // Reschedule auto-sync if it's enabled
    if (this.autoSyncConfig.enabled) {
      this.scheduleAutoSync();
    } else {
      this.scheduler.removeTask('auto-sync');
    }
  }

  /**
   * Enable auto-sync
   */
  enableAutoSync(): void {
    this.updateAutoSyncConfig({ enabled: true });
  }

  /**
   * Disable auto-sync
   */
  disableAutoSync(): void {
    this.updateAutoSyncConfig({ enabled: false });
  }

  /**
   * Trigger immediate sync
   */
  async triggerSync(): Promise<void> {
    try {
      await this.syncCallback();
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isInitialized: boolean;
    autoSyncEnabled: boolean;
    autoSyncInterval: number;
    scheduledTasks: string[];
    runningTasks: string[];
    nextSyncTime: Date | null;
  } {
    const schedulerStatus = this.scheduler.getStatus();
    const autoSyncTask = this.scheduler.getTask('auto-sync');

    return {
      isInitialized: this.isInitialized,
      autoSyncEnabled: this.autoSyncConfig.enabled,
      autoSyncInterval: this.autoSyncConfig.interval,
      scheduledTasks: this.scheduler.listTasks().map((task) => task.name),
      runningTasks: schedulerStatus.runningTasks,
      nextSyncTime: autoSyncTask?.nextRun || null,
    };
  }

  /**
   * Get task information
   */
  getTaskInfo(name: string): {
    exists: boolean;
    enabled: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
    runCount: number;
    errorCount: number;
  } {
    const task = this.scheduler.getTask(name);

    if (!task) {
      return {
        exists: false,
        enabled: false,
        lastRun: null,
        nextRun: null,
        runCount: 0,
        errorCount: 0,
      };
    }

    return {
      exists: true,
      enabled: task.enabled,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      runCount: task.runCount,
      errorCount: task.errorCount,
    };
  }

  /**
   * Pause a task
   */
  pauseTask(name: string): boolean {
    return this.scheduler.disableTask(name);
  }

  /**
   * Resume a task
   */
  resumeTask(name: string): boolean {
    return this.scheduler.enableTask(name);
  }

  /**
   * Remove a task
   */
  removeTask(name: string): boolean {
    return this.scheduler.removeTask(name);
  }

  /**
   * Update task interval
   */
  updateTaskInterval(name: string, interval: number): boolean {
    return this.scheduler.updateTaskInterval(name, interval);
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      // The scheduler will be automatically unloaded when the plugin unloads
      // since it's registered as a child component
      this.isInitialized = false;
    }
  }

  /**
   * Check if the app is currently active
   */
  private isAppActive(): boolean {
    // In Obsidian, we can check if the app is active
    // This is a simplified check - in a real implementation,
    // you might want to check window focus, etc.
    return (
      (globalThis as { document?: { hasFocus?: () => boolean } }).document?.hasFocus?.() ?? true
    );
  }

  /**
   * Get predefined intervals for UI configuration
   */
  static getPresetIntervals(): { label: string; value: number }[] {
    return [
      { label: '1 minute', value: TaskIntervals.MINUTE },
      { label: '5 minutes', value: TaskIntervals.FIVE_MINUTES },
      { label: '15 minutes', value: TaskIntervals.FIFTEEN_MINUTES },
      { label: '30 minutes', value: TaskIntervals.THIRTY_MINUTES },
      { label: '1 hour', value: TaskIntervals.HOUR },
      { label: '6 hours', value: TaskIntervals.SIX_HOURS },
      { label: '12 hours', value: TaskIntervals.TWELVE_HOURS },
      { label: '1 day', value: TaskIntervals.DAY },
    ];
  }

  /**
   * Format interval for display
   */
  static formatInterval(interval: number): string {
    const hours = Math.floor(interval / (60 * 60 * 1000));
    const minutes = Math.floor((interval % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((interval % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
