---
description: Biome linting and formatting standards for consistent code quality
applyTo: "**/*.ts, **/*.js, **/*.json"
alwaysApply: true
---

# Biome Linting & Formatting Standards

## **Biome Configuration**

- **Use Biome for both linting and formatting** instead of ESLint + Prettier
- **Configure strict rules** for TypeScript and JavaScript
- **Enable automatic formatting** on save and pre-commit
- **Use consistent configuration** across development and CI

```json
// ✅ DO: biome.json configuration
{
  "$schema": "https://biomejs.dev/schemas/1.4.1/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "error",
        "useConsistentArrayType": "error",
        "useForOf": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn",
        "noStaticOnlyClass": "error",
        "useFlatMap": "error"
      },
      "performance": {
        "noAccumulatingSpread": "error",
        "noDelete": "error"
      },
      "security": {
        "noDangerouslySetInnerHtml": "error",
        "noGlobalEval": "error"
      },
      "suspicious": {
        "noArrayIndexKey": "error",
        "noAsyncPromiseExecutor": "error",
        "noConsoleLog": "warn",
        "noDebugger": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "quote": "single",
    "trailingComma": "es5",
    "semicolons": "always"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingComma": "es5",
      "semicolons": "always"
    }
  },
  "typescript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingComma": "es5",
      "semicolons": "always"
    }
  },
  "json": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 100
    }
  }
}
```

## **Code Style Standards**

- **Use single quotes** for strings consistently
- **Prefer const over let** when variables are not reassigned
- **Use trailing commas** in multi-line objects and arrays
- **Maintain consistent indentation** (2 spaces)

```typescript
// ✅ DO: Consistent code style following Biome rules
export const slackConfig = {
  channels: [
    {
      name: 'general',
      id: 'C1234567890',
      schedule: '0 */1 * * *',
    },
    {
      name: 'development',
      id: 'C0987654321',
      schedule: '0 9 * * 1-5',
    },
  ],
  retryAttempts: 3,
  timeout: 5000,
} as const;

// ✅ DO: Proper array formatting
const messageTypes = [
  'text',
  'image',
  'file',
  'reaction',
] as const;

// ❌ DON'T: Inconsistent formatting
const badConfig = {
  channels: [{
    name: "general",
    id: "C1234567890",
    schedule: "0 */1 * * *"
  }],
  retryAttempts: 3,
  timeout: 5000
}
```

## **Import Organization**

- **Use Biome's import sorting** for consistent organization
- **Group imports logically** (external packages, internal modules, types)
- **Remove unused imports** automatically
- **Use explicit file extensions** for local imports

```typescript
// ✅ DO: Well-organized imports (Biome will sort these)
import { readFileSync } from 'fs';
import { join } from 'path';

import { WebClient } from '@slack/web-api';
import { z } from 'zod';

import { ConfigLoader } from './config/config-loader.js';
import { TokenManager } from './config/token-manager.js';

import type { SlackMessage, MessageGetter } from './types.js';

// ❌ DON'T: Disorganized imports
import type { SlackMessage } from './types.js';
import { z } from 'zod';
import { ConfigLoader } from './config/config-loader.js';
import { readFileSync } from 'fs';
```

## **TypeScript-Specific Rules**

- **Avoid non-null assertions** (!) unless absolutely necessary
- **Use consistent array types** (T[] over Array<T>)
- **Prefer for-of loops** over traditional for loops
- **Use proper type annotations** for function parameters and return types

```typescript
// ✅ DO: TypeScript best practices
export class SlackGetter implements MessageGetter {
  private readonly channelId: string;
  private readonly client: WebClient;

  constructor(channelId: string, client: WebClient) {
    this.channelId = channelId;
    this.client = client;
  }

  async fetchMessages(since?: Date): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    
    for (const rawMessage of await this.getRawMessages(since)) {
      const processedMessage = this.processMessage(rawMessage);
      messages.push(processedMessage);
    }
    
    return messages;
  }

  private async getRawMessages(since?: Date): Promise<unknown[]> {
    // Implementation
    return [];
  }

  private processMessage(raw: unknown): SlackMessage {
    // Implementation with proper type guarding
    return raw as SlackMessage;
  }
}

// ❌ DON'T: Poor TypeScript practices
export class BadSlackGetter {
  private channelId: any;
  private client: any;

  constructor(channelId: any, client: any) {
    this.channelId = channelId;
    this.client = client;
  }

  async fetchMessages(since?: Date): Promise<any> {
    let messages = [];
    
    for (let i = 0; i < rawMessages.length; i++) {
      messages.push(rawMessages[i]!);
    }
    
    return messages;
  }
}
```

## **Error Handling Standards**

- **Use specific error types** instead of generic Error
- **Avoid console.log** in production code (use proper logging)
- **Remove debugger statements** before committing
- **Handle async errors** properly

```typescript
// ✅ DO: Proper error handling
import { logger } from './utils/logger.js';

export class SlackApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly channelId?: string
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}

export async function fetchChannelHistory(
  client: WebClient,
  channelId: string
): Promise<SlackMessage[]> {
  try {
    const response = await client.conversations.history({
      channel: channelId,
      limit: 100,
    });

    logger.info(`Fetched ${response.messages?.length || 0} messages from ${channelId}`);
    return response.messages || [];
  } catch (error) {
    logger.error('Failed to fetch channel history', { channelId, error });
    
    if (error instanceof Error) {
      throw new SlackApiError(
        `Failed to fetch messages from channel ${channelId}`,
        500,
        channelId
      );
    }
    
    throw error;
  }
}

// ❌ DON'T: Poor error handling
export async function badFetchChannelHistory(client: any, channelId: string) {
  try {
    const response = await client.conversations.history({
      channel: channelId,
      limit: 100,
    });

    console.log('Got response:', response); // Biome will warn about console.log
    return response.messages || [];
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

## **Performance and Complexity Rules**

- **Avoid excessive cognitive complexity** in functions
- **MANDATORY: All functions MUST stay under 15 complexity score** (Biome default)
- **Refactor complex functions into smaller, focused methods**
- **Use flat map** instead of map().flat()
- **Avoid accumulating spread** in loops
- **Don't use delete operator** on objects

### **Complexity Management - CRITICAL PROJECT RULE**

**Every function must have cognitive complexity ≤ 15**. This is a non-negotiable standard that is enforced as an **error** in biome.json. The configuration is set to `"noExcessiveCognitiveComplexity": "error"` to ensure:

- Improves long-term maintainability
- Makes code easier to understand and debug
- Reduces bugs and testing complexity
- Facilitates future refactoring

When a function exceeds 15 complexity:

1. **Extract helper methods** for distinct responsibilities
2. **Use early returns** to reduce nesting
3. **Break down conditional logic** into smaller functions
4. **Consider design patterns** like Strategy or Command

```typescript
// ✅ DO: Low complexity, focused functions
export async function processChannel(channelId: string): Promise<void> {
  const channel = await this.getChannelInfo(channelId);
  const users = await this.fetchUsers();
  const messages = await this.getChannelMessages(channelId);
  
  await this.processMessages(messages, channel, users);
}

private async getChannelInfo(channelId: string): Promise<SlackChannel> {
  const channels = await this.slackService.getChannels();
  const channel = channels.find(ch => ch.id === channelId);
  
  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }
  
  return channel;
}

// ❌ DON'T: High complexity function (43 complexity score)
export async function processChannelBad(channelId: string): Promise<void> {
  // This function does too many things:
  // - Channel validation
  // - User fetching  
  // - Message processing
  // - Progress reporting
  // - Error handling
  // - Batch management
  // Result: 43 complexity score (too high!)
}

```typescript
// ✅ DO: Efficient code patterns
export function processMessages(messages: unknown[]): SlackMessage[] {
  return messages
    .filter(isValidMessage)
    .flatMap(message => normalizeMessage(message))
    .map(message => formatMessage(message));
}

export function updateConfig(config: Config, updates: Partial<Config>): Config {
  return {
    ...config,
    ...updates,
  };
}

// ❌ DON'T: Inefficient patterns
export function badProcessMessages(messages: unknown[]): SlackMessage[] {
  const result: SlackMessage[] = [];
  
  for (const message of messages) {
    if (isValidMessage(message)) {
      const normalized = normalizeMessage(message);
      result.push(...normalized); // Biome will warn about accumulating spread
    }
  }
  
  return result;
}

export function badUpdateConfig(config: Config, updates: Partial<Config>): Config {
  delete config.outdatedProperty; // Biome will warn about delete usage
  return Object.assign(config, updates);
}
```

## **Development Workflow Integration**

- **Run Biome check** before commits
- **Use Biome format** for automatic formatting
- **Integrate with VS Code** for real-time feedback
- **Configure pre-commit hooks** for consistent formatting

```json
// ✅ DO: Package.json scripts for Biome
{
  "scripts": {
    "lint": "biome lint .",
    "lint:fix": "biome lint --apply .",
    "format": "biome format .",
    "format:write": "biome format --write .",
    "check": "biome check .",
    "check:fix": "biome check --apply .",
    "ci": "biome ci ."
  }
}
```

## **VS Code Integration**

- **Install Biome extension** for VS Code
- **Configure format on save** in VS Code settings
- **Enable Biome as default formatter** for TypeScript/JavaScript
- **Use Biome for import organization**

```json
// ✅ DO: VS Code settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": true,
    "quickfix.biome": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

## **Pre-commit Hooks**

- **Use husky** for git hooks
- **Run Biome check** before commits
- **Prevent commits** with linting errors
- **Format code** automatically if possible

```json
// ✅ DO: Pre-commit configuration
{
  "husky": {
    "hooks": {
      "pre-commit": "biome check --apply --changed"
    }
  }
}
```

## **CI/CD Integration**

- **Run Biome check** in CI pipeline
- **Fail builds** on linting errors
- **Use biome ci** command for CI environments
- **Report linting results** in PR comments

```yaml
# ✅ DO: GitHub Actions workflow
name: Code Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run ci
```
