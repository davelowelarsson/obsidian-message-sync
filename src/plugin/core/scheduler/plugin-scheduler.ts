import { Component } from 'obsidian';
import type { PluginSchedulerConfig, ScheduledTask, TaskRunner } from './scheduler-types';

/**
 * Plugin-compatible scheduler using Obsidian's interval system
 * This replaces the CLI croner-based scheduler for the plugin environment
 */
export class PluginScheduler extends Component {
  private readonly config: Required<PluginSchedulerConfig>;
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly intervals = new Map<string, ReturnType<typeof setInterval>>();
  private isActive = false;

  constructor(config: PluginSchedulerConfig = {}) {
    super();
    this.config = {
      enableAutoSync: config.enableAutoSync ?? false,
      defaultInterval: config.defaultInterval ?? 300000, // 5 minutes
      maxConcurrentTasks: config.maxConcurrentTasks ?? 5,
      errorHandling: {
        retryAttempts: config.errorHandling?.retryAttempts ?? 3,
        retryDelay: config.errorHandling?.retryDelay ?? 5000,
        continueOnError: config.errorHandling?.continueOnError ?? true,
        ...config.errorHandling,
      },
    };
  }

  /**
   * Start the scheduler
   */
  override onload(): void {
    this.isActive = true;

    // Resume any previously scheduled tasks
    for (const [name, task] of this.tasks) {
      if (task.enabled) {
        this.startTask(name);
      }
    }
  }

  /**
   * Stop the scheduler and clear all tasks
   */
  override onunload(): void {
    this.isActive = false;
    this.stopAllTasks();
  }

  /**
   * Schedule a new task
   */
  scheduleTask(
    name: string,
    runner: TaskRunner,
    options: {
      interval?: number;
      enabled?: boolean;
      immediate?: boolean;
      onError?: (error: Error) => void;
    } = {}
  ): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task '${name}' already exists`);
    }

    if (this.tasks.size >= this.config.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks limit reached: ${this.config.maxConcurrentTasks}`);
    }

    const task: ScheduledTask = {
      name,
      runner,
      interval: options.interval ?? this.config.defaultInterval,
      enabled: options.enabled ?? true,
      immediate: options.immediate ?? false,
      ...(options.onError && { onError: options.onError }),
      lastRun: null,
      nextRun: null,
      isRunning: false,
      runCount: 0,
      errorCount: 0,
    };

    this.tasks.set(name, task);

    if (task.enabled && this.isActive) {
      this.startTask(name);
    }
  }

  /**
   * Get information about a scheduled task
   */
  getTask(name: string): ScheduledTask | undefined {
    return this.tasks.get(name);
  }

  /**
   * List all scheduled tasks
   */
  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Enable a task
   */
  enableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.enabled = true;
    if (this.isActive) {
      this.startTask(name);
    }
    return true;
  }

  /**
   * Disable a task
   */
  disableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.enabled = false;
    this.stopTask(name);
    return true;
  }

  /**
   * Remove a task
   */
  removeTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    this.stopTask(name);
    this.tasks.delete(name);
    return true;
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(name: string): Promise<void> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task '${name}' not found`);
    }

    if (task.isRunning) {
      throw new Error(`Task '${name}' is already running`);
    }

    await this.executeTask(task);
  }

  /**
   * Update task interval
   */
  updateTaskInterval(name: string, interval: number): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.interval = interval;

    // Restart task with new interval if it's currently running
    if (task.enabled && this.isActive) {
      this.stopTask(name);
      this.startTask(name);
    }

    return true;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isActive: boolean;
    taskCount: number;
    runningTasks: string[];
    config: Required<PluginSchedulerConfig>;
  } {
    return {
      isActive: this.isActive,
      taskCount: this.tasks.size,
      runningTasks: Array.from(this.tasks.values())
        .filter((task) => task.isRunning)
        .map((task) => task.name),
      config: this.config,
    };
  }

  /**
   * Start a specific task
   */
  private startTask(name: string): void {
    const task = this.tasks.get(name);
    if (!task || !task.enabled) {
      return;
    }

    // Clear any existing interval
    this.stopTask(name);

    // Execute immediately if requested
    if (task.immediate && task.runCount === 0) {
      // Don't await here as it would block the function
      this.executeTask(task).catch((error) => {
        // Handle any errors from immediate execution
        if (task.onError) {
          task.onError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }

    // Set up recurring interval
    const intervalId = setInterval(() => {
      this.executeTask(task).catch((error) => {
        // Handle any errors from scheduled execution
        if (task.onError) {
          task.onError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }, task.interval);

    this.intervals.set(name, intervalId);

    // Update next run time
    task.nextRun = new Date(Date.now() + task.interval);
  }

  /**
   * Stop a specific task
   */
  private stopTask(name: string): void {
    const intervalId = this.intervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(name);
    }

    const task = this.tasks.get(name);
    if (task) {
      task.nextRun = null;
    }
  }

  /**
   * Stop all tasks
   */
  private stopAllTasks(): void {
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId);
    }
    this.intervals.clear();

    for (const task of this.tasks.values()) {
      task.nextRun = null;
    }
  }

  /**
   * Execute a task with error handling and retry logic
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    if (task.isRunning) {
      return; // Prevent overlapping executions
    }

    this.initializeTaskExecution(task);

    const maxAttempts = (this.config.errorHandling.retryAttempts ?? 3) + 1;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await task.runner();
        this.handleTaskSuccess(task);
        return; // Success, exit retry loop
      } catch (error) {
        attempts++;
        task.errorCount++;

        if (attempts >= maxAttempts) {
          this.handleTaskFailure(task, error);
          return;
        }

        // Wait before retry
        await this.delayRetry();
      }
    }
  }

  /**
   * Initialize task execution state
   */
  private initializeTaskExecution(task: ScheduledTask): void {
    task.isRunning = true;
    task.lastRun = new Date();
    task.runCount++;
  }

  /**
   * Handle successful task execution
   */
  private handleTaskSuccess(task: ScheduledTask): void {
    task.isRunning = false;

    // Update next run time
    if (task.enabled && this.intervals.has(task.name)) {
      task.nextRun = new Date(Date.now() + task.interval);
    }
  }

  /**
   * Handle task failure after all retries
   */
  private handleTaskFailure(task: ScheduledTask, error: unknown): void {
    task.isRunning = false;

    const errorObj = error instanceof Error ? error : new Error(String(error));

    if (task.onError) {
      task.onError(errorObj);
    }

    if (!this.config.errorHandling.continueOnError) {
      // Disable task on error if configured to do so
      this.disableTask(task.name);
    }
  }

  /**
   * Delay before retry
   */
  private async delayRetry(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.config.errorHandling.retryDelay));
  }
}
