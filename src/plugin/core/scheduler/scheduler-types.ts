/**
 * Configuration for the plugin scheduler
 */
export interface PluginSchedulerConfig {
  /** Enable automatic synchronization (default: false) */
  enableAutoSync?: boolean;
  /** Default interval for tasks in milliseconds (default: 300000 = 5 minutes) */
  defaultInterval?: number;
  /** Maximum number of concurrent tasks (default: 5) */
  maxConcurrentTasks?: number;
  /** Error handling configuration */
  errorHandling?: {
    /** Number of retry attempts for failed tasks (default: 3) */
    retryAttempts?: number;
    /** Delay between retry attempts in milliseconds (default: 5000) */
    retryDelay?: number;
    /** Whether to continue scheduling after errors (default: true) */
    continueOnError?: boolean;
  };
}

/**
 * Task runner function type
 */
export type TaskRunner = () => Promise<void> | void;

/**
 * Information about a scheduled task
 */
export interface ScheduledTask {
  /** Task name */
  name: string;
  /** Task runner function */
  runner: TaskRunner;
  /** Interval in milliseconds */
  interval: number;
  /** Whether the task is enabled */
  enabled: boolean;
  /** Whether to run immediately on schedule */
  immediate: boolean;
  /** Custom error handler for this task */
  onError?: (error: Error) => void;
  /** Last run time */
  lastRun: Date | null;
  /** Next scheduled run time */
  nextRun: Date | null;
  /** Whether the task is currently running */
  isRunning: boolean;
  /** Total number of runs */
  runCount: number;
  /** Number of errors encountered */
  errorCount: number;
}

/**
 * Scheduler service events
 */
export interface SchedulerEvents {
  'task-started': (taskName: string) => void;
  'task-completed': (taskName: string, duration: number) => void;
  'task-failed': (taskName: string, error: Error) => void;
  'task-scheduled': (taskName: string) => void;
  'task-removed': (taskName: string) => void;
  'scheduler-started': () => void;
  'scheduler-stopped': () => void;
}

/**
 * Auto-sync configuration
 */
export interface AutoSyncConfig {
  /** Enable auto-sync */
  enabled: boolean;
  /** Sync interval in milliseconds */
  interval: number;
  /** Services to sync */
  services: string[];
  /** Only sync when app is active */
  onlyWhenActive?: boolean;
  /** Sync on startup */
  syncOnStartup?: boolean;
}

/**
 * Predefined task intervals
 */
export const TaskIntervals = {
  /** Every minute */
  MINUTE: 60 * 1000,
  /** Every 5 minutes */
  FIVE_MINUTES: 5 * 60 * 1000,
  /** Every 15 minutes */
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  /** Every 30 minutes */
  THIRTY_MINUTES: 30 * 60 * 1000,
  /** Every hour */
  HOUR: 60 * 60 * 1000,
  /** Every 6 hours */
  SIX_HOURS: 6 * 60 * 60 * 1000,
  /** Every 12 hours */
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  /** Every day */
  DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISABLED = 'disabled',
}
