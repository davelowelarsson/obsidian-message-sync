---
description: Configuration and secrets management standards using .env files and Zod validation
applyTo: "src/config/**/*.ts, **/*config*.ts, **/*env*.ts"
alwaysApply: true
---

# Configuration & Secrets Management

## **Environment Variables (.env) Standards**

- **Use .env files** for all sensitive configuration including API tokens
- **Never commit .env files** to version control (use .env.example instead)
- **Use dotenv package** for loading environment variables
- **Prefix environment variables** with project-specific prefix

```bash
# ✅ DO: .env file structure
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here

# Application Configuration
LOG_LEVEL=info
MAX_RETRIES=3
DEFAULT_TIMEOUT=5000

# Development Configuration
NODE_ENV=development
DEBUG=obsidian-sync:*
```

```typescript
// ✅ DO: Proper environment variable loading
import { config } from 'dotenv';

// Load environment variables at application startup
config();

export const env = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    userToken: process.env.SLACK_USER_TOKEN || '',
  },
  app: {
    logLevel: process.env.LOG_LEVEL || 'info',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '5000', 10),
  },
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
```

## **Zod Schema Validation**

- **Use Zod for all configuration validation** including environment variables
- **Create comprehensive schemas** for all configuration objects
- **Validate early** at application startup to fail fast
- **Provide clear error messages** for invalid configurations

```typescript
// ✅ DO: Comprehensive Zod schemas for configuration
import { z } from 'zod';

const SlackChannelConfigSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  channelId: z.string().regex(/^C[A-Z0-9]{8,}$/, 'Invalid Slack channel ID format'),
  schedule: z.string().min(1, 'Schedule is required'),
  outputPath: z.string().min(1, 'Output path is required'),
  token: z.string().min(1, 'Token reference is required'),
});

const EnvironmentSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1, 'Slack bot token is required'),
  SLACK_USER_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  DEFAULT_TIMEOUT: z.coerce.number().min(1000).max(30000).default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const ConfigSchema = z.object({
  slack: z.array(SlackChannelConfigSchema).min(1, 'At least one Slack channel is required'),
  schedule: z.object({
    defaultInterval: z.string().default('0 */1 * * *'),
    maxRetries: z.number().min(0).max(10).default(3),
  }),
  output: z.object({
    baseDir: z.string().default('./vault'),
    dateFormat: z.string().default('YYYY-MM-DD'),
  }),
});

export type SlackChannelConfig = z.infer<typeof SlackChannelConfigSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;
export type AppConfig = z.infer<typeof ConfigSchema>;
```

## **Configuration Loading & Validation**

- **Validate environment variables** at startup using Zod
- **Fail fast** with clear error messages for invalid configuration
- **Use type-safe configuration objects** throughout the application
- **Support configuration overrides** for testing

```typescript
// ✅ DO: Type-safe configuration loader with validation
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { config } from 'dotenv';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private _config?: AppConfig;
  private _env?: EnvironmentConfig;

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  loadEnvironment(): EnvironmentConfig {
    if (this._env) {
      return this._env;
    }

    // Load .env file
    config();

    // Validate environment variables
    const result = EnvironmentSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      throw new Error(`Environment validation failed:\n${errors}`);
    }

    this._env = result.data;
    return this._env;
  }

  loadConfig(configPath: string = 'config.yaml'): AppConfig {
    if (this._config) {
      return this._config;
    }

    try {
      const configFile = readFileSync(configPath, 'utf8');
      const rawConfig = parse(configFile);
      
      // Validate configuration
      const result = ConfigSchema.safeParse(rawConfig);
      if (!result.success) {
        const errors = result.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join('\n');
        throw new Error(`Configuration validation failed:\n${errors}`);
      }

      this._config = result.data;
      return this._config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
      throw error;
    }
  }
}
```

## **Secret Management Best Practices**

- **Never log or expose** API tokens in any form
- **Use environment variables** for all sensitive data
- **Implement token validation** without exposing token values
- **Create secure token references** in configuration files

```typescript
// ✅ DO: Secure token management
export class TokenManager {
  private readonly tokens: Map<string, string> = new Map();

  constructor(env: EnvironmentConfig) {
    // Store tokens securely without logging
    this.tokens.set('SLACK_BOT_TOKEN', env.SLACK_BOT_TOKEN);
    if (env.SLACK_USER_TOKEN) {
      this.tokens.set('SLACK_USER_TOKEN', env.SLACK_USER_TOKEN);
    }
  }

  getToken(tokenName: string): string {
    const token = this.tokens.get(tokenName);
    if (!token) {
      throw new Error(`Token '${tokenName}' not found`);
    }
    return token;
  }

  validateToken(tokenName: string): boolean {
    const token = this.tokens.get(tokenName);
    if (!token) {
      return false;
    }
    
    // Validate token format without exposing the token
    if (tokenName === 'SLACK_BOT_TOKEN') {
      return token.startsWith('xoxb-') && token.length > 50;
    }
    
    if (tokenName === 'SLACK_USER_TOKEN') {
      return token.startsWith('xoxp-') && token.length > 50;
    }
    
    return false;
  }

  // ❌ DON'T: Never expose actual token values
  // logTokens(): void {
  //   console.log('Tokens:', this.tokens);
  // }
}
```

## **Configuration File Structure**

- **Use YAML format** for human-readable configuration
- **Reference tokens by name** rather than including them directly
- **Support template variables** for dynamic paths
- **Provide clear examples** and documentation

```yaml
# ✅ DO: config.yaml with token references
slack:
  - name: "general"
    channelId: "C1234567890"
    schedule: "0 */1 * * *"  # Every hour
    outputPath: "daily-notes/{{date}}.md"
    token: "SLACK_BOT_TOKEN"
    
  - name: "development"
    channelId: "C0987654321"
    schedule: "0 9 * * 1-5"  # Weekdays at 9 AM
    outputPath: "work-logs/{{date}}.md"
    token: "SLACK_BOT_TOKEN"

schedule:
  defaultInterval: "0 */1 * * *"
  maxRetries: 3

output:
  baseDir: "./vault"
  dateFormat: "YYYY-MM-DD"
```

## **Configuration Testing**

- **Test configuration loading** with valid and invalid inputs
- **Test environment variable validation** with missing/invalid values
- **Test token validation** without exposing actual tokens
- **Use test fixtures** for consistent test configurations

```typescript
// ✅ DO: Comprehensive configuration testing
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../src/config/config-loader.js';

describe('Configuration Management', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    it('should validate required environment variables', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-valid-token-here';
      process.env.LOG_LEVEL = 'info';

      const loader = ConfigLoader.getInstance();
      expect(() => loader.loadEnvironment()).not.toThrow();
    });

    it('should fail with invalid Slack token format', () => {
      process.env.SLACK_BOT_TOKEN = 'invalid-token';

      const loader = ConfigLoader.getInstance();
      expect(() => loader.loadEnvironment()).toThrow('Invalid Slack bot token format');
    });

    it('should use default values for optional environment variables', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-valid-token-here';
      // Don't set LOG_LEVEL

      const loader = ConfigLoader.getInstance();
      const env = loader.loadEnvironment();
      
      expect(env.LOG_LEVEL).toBe('info');
    });
  });

  describe('Configuration File Loading', () => {
    it('should load and validate YAML configuration', () => {
      const testConfig = `
slack:
  - name: "test-channel"
    channelId: "C1234567890"
    schedule: "0 */1 * * *"
    outputPath: "test/{{date}}.md"
    token: "SLACK_BOT_TOKEN"
`;

      const loader = ConfigLoader.getInstance();
      expect(() => loader.loadConfig(testConfig)).not.toThrow();
    });

    it('should fail with invalid channel ID format', () => {
      const testConfig = `
slack:
  - name: "test-channel"
    channelId: "invalid-id"
    schedule: "0 */1 * * *"
    outputPath: "test/{{date}}.md"
    token: "SLACK_BOT_TOKEN"
`;

      const loader = ConfigLoader.getInstance();
      expect(() => loader.loadConfig(testConfig)).toThrow('Invalid Slack channel ID format');
    });
  });
});
```

## **Development vs Production Configuration**

- **Use different .env files** for different environments
- **Override configuration** based on NODE_ENV
- **Provide secure defaults** for production
- **Document environment-specific requirements**

```typescript
// ✅ DO: Environment-specific configuration
export function getConfigPath(): string {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'test':
      return 'config.test.yaml';
    case 'production':
      return 'config.production.yaml';
    default:
      return 'config.yaml';
  }
}

export function getLogLevel(): string {
  if (process.env.NODE_ENV === 'test') {
    return 'error'; // Reduce noise in tests
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'warn'; // Reduce log volume in production
  }
  
  return 'info'; // Development default
}
```

## **Migration to Obsidian Plugin Settings**

- **Design configuration schema** to be plugin-compatible
- **Plan migration strategy** for settings transfer
- **Maintain backward compatibility** during transition
- **Document migration process** for users

```typescript
// ✅ DO: Plugin-compatible configuration structure
export interface PluginSettings {
  slackChannels: SlackChannelConfig[];
  scheduleSettings: {
    defaultInterval: string;
    maxRetries: number;
  };
  outputSettings: {
    baseDir: string;
    dateFormat: string;
  };
  // Plugin-specific settings
  enableNotifications: boolean;
  autoStart: boolean;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  slackChannels: [],
  scheduleSettings: {
    defaultInterval: '0 */1 * * *',
    maxRetries: 3,
  },
  outputSettings: {
    baseDir: '',
    dateFormat: 'YYYY-MM-DD',
  },
  enableNotifications: true,
  autoStart: false,
};
```
