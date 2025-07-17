---
description: TypeScript development standards for Obsidian Message Sync project using Node.js 24 native TypeScript support
applyTo: "src/**/*.ts, tests/**/*.ts, **/*.ts"
alwaysApply: true
---

# TypeScript Development Standards

## **Node.js 24 Native TypeScript Support - PREFERRED**

- **Use Node.js 24's native TypeScript execution** with `--experimental-strip-types` flag (preferred)
- **Development execution**: Use `node --experimental-strip-types` for direct TypeScript execution
- **Package.json scripts**: Configure scripts to use native Node.js 24 TypeScript support
- **Fallback only**: Use `tsx` package only when native support has limitations
- **Production builds**: Use ESBuild for optimized production builds when needed
- **No compilation step** required during development - work directly with TypeScript files

```typescript
// ✅ DO: Use native TypeScript features with Node.js 24
// Run with: node --experimental-strip-types app.ts
import type { SlackMessage, MessageService } from './types.js';

export class SlackService implements MessageService {
  async fetchMessages(): Promise<SlackMessage[]> {
    // Implementation
  }
}

// ✅ DO: Configure package.json scripts for native TypeScript
// "scripts": {
//   "dev": "node --experimental-strip-types src/index.ts",
//   "start": "node --experimental-strip-types src/index.ts",
//   "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js"
// }

// ❌ DON'T: Use tsx unless native Node.js 24 support is insufficient
// "scripts": {
//   "dev": "tsx src/index.ts"
// }
```

## **Type Safety & Best Practices**

- **Use strict TypeScript configuration** with `"strict": true` in tsconfig.json
- **Prefer `type` over `interface`** for type definitions unless extension is needed
- **Use generic constraints** for better type inference
- **Export types explicitly** with `export type` for better tree-shaking

```typescript
// ✅ DO: Explicit type definitions with proper exports
export type SlackChannelConfig = {
  readonly channelId: string;
  readonly name: string;
  readonly schedule: string;
  readonly outputPath: string;
};

export type MessageService<T = unknown> = {
  fetchMessages(since?: Date): Promise<T[]>;
  validateConfig(): boolean;
};

// ❌ DON'T: Loose typing or any usage
// const config: any = loadConfig();
```

## **Module System**
- **Use ESM imports/exports** consistently throughout the project
- **Include file extensions** in imports for better compatibility
- **Use barrel exports** for clean public APIs
- **Organize imports** alphabetically within groups

```typescript
// ✅ DO: Clean ESM imports with extensions
import type { Config } from './config.js';
import { SlackService } from './services/slack.js';
import { FileWriter } from './writers/file.js';

// ✅ DO: Barrel exports for clean APIs
export { SlackService } from './services/slack.js';
export { FileWriter } from './writers/file.js';
export type { Config, SlackChannelConfig } from './types.js';
```

## **Error Handling**
- **Use custom error classes** for different error types
- **Implement proper error boundaries** in async operations
- **Never expose sensitive information** in error messages
- **Log errors appropriately** without exposing tokens

```typescript
// ✅ DO: Custom error classes with proper context
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

// ✅ DO: Safe error handling without token exposure
try {
  await slackClient.conversations.history({ channel: channelId });
} catch (error) {
  throw new SlackApiError(
    'Failed to fetch channel history',
    error.statusCode,
    channelId
  );
}
```

## **Async/Await Best Practices**
- **Use async/await** consistently over Promises
- **Handle concurrent operations** with Promise.all/Promise.allSettled
- **Implement proper timeout handling** for external API calls
- **Use AbortController** for cancellable operations

```typescript
// ✅ DO: Proper async handling with timeout
export async function fetchWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await operation();
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
```

## **File Organization**
- **Use consistent file naming** with kebab-case for files
- **Organize by feature/domain** rather than by type
- **Keep related types** in the same file as their implementation
- **Use index files** for clean imports

```
src/
├── services/
│   ├── slack/
│   │   ├── slack-service.ts
│   │   ├── slack-types.ts
│   │   └── index.ts
│   └── base-service.ts
├── writers/
│   ├── file-writer.ts
│   └── index.ts
├── config/
│   ├── config-loader.ts
│   └── config-types.ts
└── types.ts
```

## **Documentation Standards**
- **Use TSDoc comments** for all public APIs
- **Include usage examples** in documentation
- **Document complex type definitions** with examples
- **Keep README updated** with TypeScript-specific information

```typescript
// ✅ DO: Comprehensive TSDoc documentation
/**
 * Fetches messages from a Slack channel since the specified timestamp.
 *
 * @param channelId - The Slack channel ID (e.g., "C1234567890")
 * @param since - Optional timestamp to fetch messages from
 * @returns Promise resolving to array of SlackMessage objects
 *
 * @throws {SlackApiError} When API request fails
 * @throws {ConfigError} When channel configuration is invalid
 *
 * @example
 * ```typescript
 * const messages = await service.fetchMessages('C1234567890', new Date());
 * ```
 */
async fetchMessages(channelId: string, since?: Date): Promise<SlackMessage[]>
```

## **Performance Considerations**
- **Use `readonly` modifiers** for immutable data
- **Implement proper caching** for frequently accessed data
- **Use lazy loading** for expensive operations
- **Minimize object creation** in hot paths

```typescript
// ✅ DO: Immutable data structures
export type ReadonlyConfig = {
  readonly slack: readonly SlackChannelConfig[];
  readonly schedule: {
    readonly defaultInterval: string;
    readonly maxRetries: number;
  };
};

// ✅ DO: Lazy loading for expensive operations
class ConfigLoader {
  private _config?: Config;

  get config(): Config {
    if (!this._config) {
      this._config = this.loadConfig();
    }
    return this._config;
  }
}
```

## **Package Management & Development Commands**

- **Use pnpm** as the package manager for all dependency management
- **Run common checks frequently** to maintain project quality and keep it lean
- **Focus on simplicity** and avoid unnecessary complexity

```bash
# ✅ DO: Essential development commands to run frequently
pnpm test          # Run all tests
pnpm lint          # Check code quality with Biome
pnpm type-check    # Verify TypeScript compilation
pnpm dead-code     # Find unused code with Knip

# ✅ DO: Install dependencies with pnpm
pnpm install
pnpm add @slack/web-api
pnpm add -D vitest @types/node

# ✅ DO: Test subsets (use file patterns instead of directory filtering)
# Directory filtering doesn't work as expected, use specific file patterns:
pnpm test -- --run enhanced-validation-integration.test.ts  # Single integration test
pnpm test -- --run service-configuration-integration.test.ts  # Single integration test
pnpm test -- --run slack-service.test.ts  # Single unit test

# ❌ AVOID: These approaches don't work as expected
# pnpm test -- tests/unit          # Still runs all tests
# pnpm test -- tests/integration   # Still runs all tests
# pnpm test:unit                   # Glob pattern issues
# pnpm test:integration            # Glob pattern issues
# pnpm test:e2e                   # No e2e directory exists
```

**Note about test subsets**: The package.json subset scripts have issues with Vitest glob patterns and directory filtering. For focused testing, use specific file patterns (`pnpm test -- --run filename.test.ts`) instead of directory-based filtering.

## **Test-First Development Standards**

- **All tests must pass** before continuing development or merging code
- **Run tests frequently** during development to catch issues early
- **Fix failing tests immediately** - don't accumulate technical debt
- **Use terminal-based testing** when VS Code integration has birpc issues

```bash
# ✅ DO: Essential test commands (all must pass)
pnpm test -- --run --reporter=verbose  # Run all tests (terminal-based)
pnpm test -- --run filename.test.ts    # Run specific test file

# ✅ DO: Verify test status before continuing
# All tests must show: ✓ PASSED
# No tests should show: ❌ FAILED
# Address any failures immediately

# ❌ DON'T: Continue development with failing tests
# ❌ DON'T: Ignore test failures or skip tests
# ❌ DON'T: Commit code that breaks existing tests
```

## **Project Philosophy: Lean & Simple**

- **Keep dependencies minimal** - regularly audit with `pnpm dead-code`
- **Remove unused code promptly** - don't let it accumulate
- **Focus on core functionality** - avoid feature creep
- **Maintain clear, simple APIs** - complexity is the enemy
