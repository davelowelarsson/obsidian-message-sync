/**
 * Browser-compatible Rate Limiting Service for Obsidian Plugin
 *
 * Provides rate limiting functionality optimized for browser environments.
 * Uses setTimeout instead of Node.js timers and provides a simpler API.
 */

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerSecond: number;
  burstLimit: number;
  queueTimeout: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  baseDelay: number;
  maxDelay: number;
  maxRetries: number;
}

export interface RateLimitRequestMetadata {
  requestId: string;
  endpoint: string;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  queuePosition?: number;
  estimatedDelay?: number;
}

export interface RateLimitStats {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  averageDelay: number;
  queueSize: number;
  burstCount: number;
}

interface RequestWindow {
  timestamp: number;
  count: number;
}

interface QueuedRequest {
  metadata: RateLimitRequestMetadata;
  resolve: (result: RateLimitResult) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Browser-compatible rate limiting service
 */
export class RateLimitService {
  private config: RateLimitConfig;
  private stats: RateLimitStats;
  private requestHistory: RequestWindow[] = [];
  private burstHistory: RequestWindow[] = [];
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      requestsPerMinute: 50,
      requestsPerSecond: 1,
      burstLimit: 10,
      queueTimeout: 30000,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 30000,
      maxRetries: 3,
      ...config,
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      averageDelay: 0,
      queueSize: 0,
      burstCount: 0,
    };
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkRateLimit(metadata: RateLimitRequestMetadata): Promise<RateLimitResult> {
    const now = Date.now();

    // Clean up old request history
    this.cleanupHistory(now);

    // Check if we're within limits
    if (this.isWithinLimits(now)) {
      this.recordRequest(now);
      this.stats.totalRequests++;
      this.stats.successfulRequests++;

      return {
        allowed: true,
      };
    }

    // If not within limits, queue the request
    this.stats.totalRequests++;
    this.stats.rateLimitedRequests++;

    return this.queueRequest(metadata);
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): RateLimitStats {
    return {
      ...this.stats,
      queueSize: this.requestQueue.length,
    };
  }

  /**
   * Reset rate limit counters and statistics
   */
  reset(): void {
    this.requestHistory = [];
    this.burstHistory = [];
    this.requestQueue = [];
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      averageDelay: 0,
      queueSize: 0,
      burstCount: 0,
    };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  private isWithinLimits(now: number): boolean {
    // Check per-second limit
    const recentRequests = this.requestHistory.filter((req) => now - req.timestamp < 1000);
    const currentSecondCount = recentRequests.reduce((sum, req) => sum + req.count, 0);

    if (currentSecondCount >= this.config.requestsPerSecond) {
      return false;
    }

    // Check per-minute limit
    const minuteRequests = this.requestHistory.filter((req) => now - req.timestamp < 60000);
    const currentMinuteCount = minuteRequests.reduce((sum, req) => sum + req.count, 0);

    if (currentMinuteCount >= this.config.requestsPerMinute) {
      return false;
    }

    // Check burst limit
    const burstRequests = this.burstHistory.filter(
      (req) => now - req.timestamp < 5000 // 5 second burst window
    );
    const currentBurstCount = burstRequests.reduce((sum, req) => sum + req.count, 0);

    if (currentBurstCount >= this.config.burstLimit) {
      return false;
    }

    return true;
  }

  private recordRequest(now: number): void {
    // Record in main history
    const existingWindow = this.requestHistory.find((req) => now - req.timestamp < 1000);

    if (existingWindow) {
      existingWindow.count++;
    } else {
      this.requestHistory.push({
        timestamp: now,
        count: 1,
      });
    }

    // Record in burst history
    const existingBurst = this.burstHistory.find((req) => now - req.timestamp < 1000);

    if (existingBurst) {
      existingBurst.count++;
    } else {
      this.burstHistory.push({
        timestamp: now,
        count: 1,
      });
    }

    this.stats.burstCount++;
  }

  private cleanupHistory(now: number): void {
    // Clean up request history older than 1 minute
    this.requestHistory = this.requestHistory.filter((req) => now - req.timestamp < 60000);

    // Clean up burst history older than 10 seconds
    this.burstHistory = this.burstHistory.filter((req) => now - req.timestamp < 10000);
  }

  private async queueRequest(metadata: RateLimitRequestMetadata): Promise<RateLimitResult> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        metadata,
        resolve,
        reject,
      };

      // Set timeout for queued request
      queuedRequest.timeoutId = setTimeout(() => {
        this.removeFromQueue(queuedRequest);
        reject(new Error('Request timed out in queue'));
      }, this.config.queueTimeout);

      // Add to queue based on priority
      if (metadata.priority === 'high') {
        this.requestQueue.unshift(queuedRequest);
      } else {
        this.requestQueue.push(queuedRequest);
      }

      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }

      // Calculate estimated delay based on queue position
      const queuePosition = this.requestQueue.indexOf(queuedRequest);
      const estimatedDelay = this.calculateDelay(queuePosition);

      resolve({
        allowed: false,
        retryAfter: estimatedDelay,
        queuePosition,
        estimatedDelay,
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      this.cleanupHistory(now);

      if (this.isWithinLimits(now)) {
        const queuedRequest = this.requestQueue.shift();
        if (queuedRequest) {
          this.recordRequest(now);
          this.stats.successfulRequests++;

          // Clear timeout
          if (queuedRequest.timeoutId) {
            clearTimeout(queuedRequest.timeoutId);
          }

          queuedRequest.resolve({
            allowed: true,
          });
        }
      } else {
        // Wait before checking again
        const delay = this.calculateDelay(0);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.isProcessingQueue = false;
  }

  private calculateDelay(queuePosition: number): number {
    const baseDelay = this.config.baseDelay;

    switch (this.config.backoffStrategy) {
      case 'exponential':
        return Math.min(baseDelay * 2 ** queuePosition, this.config.maxDelay);

      case 'linear':
        return Math.min(baseDelay + queuePosition * baseDelay, this.config.maxDelay);
      default:
        return baseDelay;
    }
  }

  private removeFromQueue(queuedRequest: QueuedRequest): void {
    const index = this.requestQueue.indexOf(queuedRequest);
    if (index > -1) {
      this.requestQueue.splice(index, 1);
    }

    if (queuedRequest.timeoutId) {
      clearTimeout(queuedRequest.timeoutId);
    }
  }
}
