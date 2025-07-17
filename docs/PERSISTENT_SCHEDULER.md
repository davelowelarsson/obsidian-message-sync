# PersistentScheduler

The `PersistentScheduler` extends the basic scheduling functionality with persistence capabilities, allowing jobs to "catch up" on missed runs when the Node.js process restarts.

## Key Features

- **Persistence**: Job state is saved to disk and restored on restart
- **Missed Run Catch-up**: Automatically detects and executes missed scheduled runs
- **Configurable Catch-up**: Control whether jobs should catch up and how many missed runs to execute
- **Process Restart Resilience**: Handles intermittent Node.js process operation

## Use Cases

- **Intermittent Process Operation**: Your Node.js process doesn't run 24/7
- **Reliable Job Execution**: Critical jobs that must run even if the process was down
- **Development/Testing**: Process restarts shouldn't skip important scheduled tasks

## Basic Usage

```typescript
import { PersistentScheduler } from './scheduler/persistent-scheduler.js';

// Create scheduler with persistence
const scheduler = new PersistentScheduler({
  stateFile: './scheduler-state.json',
  defaultCatchUp: true,
  defaultMaxMissedRuns: 5,
});

// Initialize (loads previous state)
await scheduler.initialize();

// Schedule a job with catch-up enabled
await scheduler.schedule({
  name: 'daily-report',
  schedule: '0 8 * * *', // 8 AM daily
  task: async () => {
    console.log('Generating daily report...');
  },
  catchUp: true,
  maxMissedRuns: 3,
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await scheduler.shutdown();
  process.exit(0);
});
```

## Configuration Options

### PersistentSchedulerConfig

```typescript
interface PersistentSchedulerConfig extends SchedulerConfig {
  stateFile?: string;              // Path to state file (default: .scheduler-state.json)
  defaultCatchUp?: boolean;        // Default catch-up behavior (default: true)
  defaultMaxMissedRuns?: number;   // Default max missed runs (default: 5)
  saveInterval?: number;           // Auto-save interval in ms (default: 30000)
}
```

### PersistentScheduleJobConfig

```typescript
interface PersistentScheduleJobConfig extends ScheduleJobConfig {
  catchUp?: boolean;          // Enable catch-up for this job
  maxMissedRuns?: number;     // Maximum missed runs to catch up
  timezone?: string;          // Job timezone
  protect?: boolean;          // Prevent overlapping executions
}
```

## Catch-up Behavior

### How It Works

1. **State Persistence**: Job execution times are saved to disk
2. **Startup Processing**: On initialization, checks for missed runs
3. **Missed Run Detection**: Calculates what should have run between last execution and now
4. **Catch-up Execution**: Executes missed runs up to the `maxMissedRuns` limit

### Example Scenario

```typescript
// Job scheduled to run daily at 8 AM
await scheduler.schedule({
  name: 'daily-backup',
  schedule: '0 8 * * *',
  task: async () => {
    console.log('Running daily backup...');
  },
  catchUp: true,
  maxMissedRuns: 2,
});

// Timeline:
// Day 1: 8 AM - Job runs normally
// Day 2: Process was down
// Day 3: Process was down  
// Day 4: 10 AM - Process starts
// Result: Catches up and runs 2 missed executions (Day 2 & 3)
```

### Configuration Examples

```typescript
// Always catch up on missed runs
await scheduler.schedule({
  name: 'critical-job',
  schedule: '0 */6 * * *', // Every 6 hours
  catchUp: true,
  maxMissedRuns: 10,
  task: criticalTask,
});

// Never catch up (skip missed runs)
await scheduler.schedule({
  name: 'optional-job',
  schedule: '0 12 * * *', // Daily at noon
  catchUp: false,
  task: optionalTask,
});

// Limited catch-up
await scheduler.schedule({
  name: 'moderate-job',
  schedule: '0 */2 * * *', // Every 2 hours
  catchUp: true,
  maxMissedRuns: 3, // Only catch up last 3 missed runs
  task: moderateTask,
});
```

## State Management

### State File Format

The scheduler saves state in JSON format:

```json
{
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "jobs": [
    {
      "name": "daily-backup",
      "schedule": "0 8 * * *",
      "enabled": true,
      "catchUp": true,
      "maxMissedRuns": 2,
      "currentRunCount": 5,
      "lastRun": "2024-01-14T08:00:00.000Z",
      "nextRun": "2024-01-15T08:00:00.000Z"
    }
  ]
}
```

### State Operations

```typescript
// Get job state
const state = scheduler.getJobState('daily-backup');
console.log(state.lastRun);
console.log(state.currentRunCount);

// Get all states
const allStates = scheduler.getAllJobStates();
for (const [name, state] of allStates) {
  console.log(`${name}: ${state.currentRunCount} runs`);
}

// Toggle catch-up behavior
await scheduler.setCatchUp('daily-backup', false);
```

## Job Management

### Standard Operations

```typescript
// Pause job (stops scheduling, saves state)
scheduler.pauseJob('daily-backup');

// Resume job (resumes scheduling)
scheduler.resumeJob('daily-backup');

// Stop job (removes from scheduler and state)
scheduler.stopJob('daily-backup');

// Get job instance
const job = scheduler.getJob('daily-backup');
if (job) {
  console.log(`Next run: ${job.nextRun()}`);
  console.log(`Is running: ${job.isRunning()}`);
}
```

### Listing Jobs

```typescript
// List all active jobs
const jobs = scheduler.listJobs();
for (const job of jobs) {
  console.log(`${job.name}: ${job.nextRun()}`);
}
```

## Error Handling

The scheduler handles various error conditions gracefully:

```typescript
// Corrupted state file
// → Logs warning, continues with empty state

// Task execution errors
// → Logs error, continues scheduling (configurable)

// State save errors
// → Logs error, continues operation

// Invalid cron expressions
// → Throws error during scheduling
```

## Best Practices

### 1. Proper Shutdown

Always shut down the scheduler gracefully to ensure state is saved:

```typescript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await scheduler.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await scheduler.shutdown();
  process.exit(0);
});
```

### 2. State File Location

Use a persistent location for the state file:

```typescript
import path from 'path';

const scheduler = new PersistentScheduler({
  stateFile: path.join(process.cwd(), 'data', 'scheduler-state.json'),
});
```

### 3. Reasonable Catch-up Limits

Set appropriate `maxMissedRuns` values:

```typescript
// High-frequency jobs: Lower limit
await scheduler.schedule({
  name: 'frequent-job',
  schedule: '*/5 * * * *', // Every 5 minutes
  maxMissedRuns: 2, // Only catch up last 10 minutes
  task: frequentTask,
});

// Low-frequency jobs: Higher limit
await scheduler.schedule({
  name: 'daily-job',
  schedule: '0 2 * * *', // Daily at 2 AM
  maxMissedRuns: 7, // Catch up last week
  task: dailyTask,
});
```

### 4. Monitoring

Monitor job execution and state:

```typescript
// Log job execution
await scheduler.schedule({
  name: 'monitored-job',
  schedule: '0 * * * *',
  task: async () => {
    console.log('Job starting...');
    await doWork();
    console.log('Job completed');
  },
  onError: (error) => {
    console.error('Job failed:', error);
  },
});

// Periodic status check
setInterval(() => {
  const states = scheduler.getAllJobStates();
  console.log(`Active jobs: ${states.size}`);
}, 60000);
```

## Integration with Existing Code

The PersistentScheduler is designed to be a drop-in replacement for the basic Scheduler:

```typescript
// Before
import { Scheduler } from './scheduler.js';
const scheduler = new Scheduler();

// After
import { PersistentScheduler } from './scheduler/persistent-scheduler.js';
const scheduler = new PersistentScheduler({
  defaultCatchUp: true,
});
```

The API is mostly compatible, with additional persistence features available when needed.

## Debugging

Enable debug logging to troubleshoot issues:

```typescript
const scheduler = new PersistentScheduler({
  stateFile: './debug-state.json',
  saveInterval: 5000, // Save more frequently for debugging
});

// The scheduler will log missed run detection and catch-up execution
// Check the console output for detailed information
```

## Limitations

1. **State File Size**: Large numbers of jobs may create large state files
2. **Catch-up Performance**: Many missed runs may cause startup delays
3. **Timezone Changes**: Changing system timezone may affect catch-up calculations
4. **Concurrent Processes**: Multiple processes should not share the same state file

## Advanced Configuration

### Custom State File Format

```typescript
// Custom state file location based on environment
const stateFile = process.env.NODE_ENV === 'production' 
  ? '/var/lib/myapp/scheduler-state.json'
  : './dev-scheduler-state.json';

const scheduler = new PersistentScheduler({
  stateFile,
  defaultCatchUp: process.env.NODE_ENV === 'production',
});
```

### Timezone-Aware Scheduling

```typescript
await scheduler.schedule({
  name: 'business-hours-job',
  schedule: '0 9 * * 1-5', // 9 AM weekdays
  timezone: 'America/New_York',
  catchUp: true,
  task: businessHoursTask,
});
```
