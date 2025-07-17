---
description: Testing standards and TDD workflow for Obsidian Message Sync project using Vitest
applyTo: "tests/**/*.ts, **/*.test.ts, **/*.spec.ts"
alwaysApply: true
---

# Testing Standards & TDD Workflow

## **Test-Driven Development (TDD) Process - MANDATORY**

- **Red-Green-Refactor cycle** is **MANDATORY** for all new features and bug fixes
- **Write tests first** before implementing ANY functionality - no exceptions
- **Use Vitest watch mode** in dedicated terminal for continuous testing during development
- **Run only affected tests** to maintain fast feedback loops
- **Discuss features through test cases** before implementation to clarify requirements

```bash
# ✅ DO: Start every development session with watch mode in dedicated terminal
pnpm test:watch

# ✅ DO: Run specific test files during development
pnpm test:watch -- slack-service.test.ts

# ✅ DO: Run all tests before commits
pnpm test:coverage
```

## **TDD Workflow Steps**

1. **Red**: Write a failing test that describes the desired behavior
2. **Green**: Write the minimal code to make the test pass
3. **Refactor**: Improve the code while keeping tests passing
4. **Repeat**: Continue with the next piece of functionality

This approach helps us:

- **Clarify requirements** through test discussions
- **Prevent regressions** by having comprehensive test coverage
- **Design better APIs** by writing tests first
- **Maintain confidence** when refactoring

## **Vitest Configuration Standards**

- **Use Vitest's native TypeScript support** without additional configuration
- **Enable coverage reporting** with c8 or built-in coverage
- **Configure test environment** for Node.js with appropriate globals
- **Use proper test isolation** with beforeEach/afterEach hooks

```typescript
// ✅ DO: Comprehensive test setup with proper isolation
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SlackService } from '../src/services/slack-service.js';

describe('SlackService', () => {
  let slackGetter: SlackService;
  let mockSlackClient: any;

  beforeEach(() => {
    mockSlackClient = {
      conversations: {
        history: vi.fn(),
      },
    };
    slackGetter = new SlackService(mockSlackClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages from specified channel', async () => {
    // Test implementation
  });
});
```

## **Unit Testing Standards**

- **Test individual functions/methods** in isolation
- **Mock external dependencies** using Vitest's vi.mock()
- **Use descriptive test names** that explain the expected behavior
- **Follow AAA pattern** (Arrange, Act, Assert)

```typescript
// ✅ DO: Comprehensive unit test with proper mocking
import { describe, it, expect, vi } from 'vitest';
import { SlackService } from '../src/services/slack-service.js';

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: {
      history: vi.fn(),
    },
  })),
}));

describe('SlackService', () => {
  describe('fetchMessages', () => {
    it('should return formatted messages when API call succeeds', async () => {
      // Arrange
      const mockMessages = [
        { ts: '1234567890', text: 'Test message', user: 'U123' },
      ];
      const mockResponse = { messages: mockMessages };
      const mockClient = { conversations: { history: vi.fn().mockResolvedValue(mockResponse) } };
      const getter = new SlackService(mockClient);

      // Act
      const result = await getter.fetchMessages('C123456789');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: new Date(1234567890000),
        text: 'Test message',
        userId: 'U123',
        channelId: 'C123456789',
      });
    });

    it('should throw SlackApiError when API call fails', async () => {
      // Arrange
      const mockClient = { 
        conversations: { 
          history: vi.fn().mockRejectedValue(new Error('API Error'))
        } 
      };
      const getter = new SlackService(mockClient);

      // Act & Assert
      await expect(getter.fetchMessages('C123456789')).rejects.toThrow('SlackApiError');
    });
  });
});
```

## **Integration Testing Standards**

- **Test component interactions** without external dependencies
- **Use test containers** for database/external service testing
- **Mock network requests** using MSW or similar tools
- **Test configuration loading** and validation

```typescript
// ✅ DO: Integration test with proper test environment
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigLoader } from '../src/config/config-loader.js';
import { SlackService } from '../src/services/slack-service.js';

describe('Configuration Integration', () => {
  let configLoader: ConfigLoader;
  let testConfig: string;

  beforeEach(() => {
    testConfig = `
slack:
  - name: "test-channel"
    channelId: "C123456789"
    schedule: "0 */1 * * *"
    outputPath: "daily-notes/{{date}}.md"
`;
    configLoader = new ConfigLoader();
  });

  it('should load configuration and create getter instances', () => {
    // Arrange
    const config = configLoader.loadFromString(testConfig);
    
    // Act
    const getter = new SlackService(config.slack[0]);
    
    // Assert
    expect(getter.channelId).toBe('C123456789');
    expect(getter.schedule).toBe('0 */1 * * *');
  });
});
```

## **End-to-End Testing Preparation**

- **Plan E2E tests** for when Slack integration is ready
- **Use test Slack workspace** with dedicated test channels
- **Implement test data cleanup** after E2E test runs
- **Test actual file system operations** in isolated directories

```typescript
// ✅ DO: E2E test structure (implement when ready)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('End-to-End: Slack to Obsidian Sync', () => {
  const testVaultPath = join(__dirname, 'test-vault');
  
  beforeAll(async () => {
    await fs.mkdir(testVaultPath, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testVaultPath, { recursive: true });
  });

  it('should fetch messages from Slack and write to Obsidian note', async () => {
    // Implementation when Slack integration is ready
  });
});
```

## **Test Data Management**

- **Use test fixtures** for consistent test data
- **Create test builders** for complex objects
- **Mock time-sensitive operations** using vi.useFakeTimers()
- **Use factory functions** for generating test data

```typescript
// ✅ DO: Test data factories and fixtures
import { vi } from 'vitest';

export const createMockSlackMessage = (overrides = {}) => ({
  ts: '1234567890',
  text: 'Test message',
  user: 'U123456789',
  channel: 'C123456789',
  ...overrides,
});

export const createMockConfig = (overrides = {}) => ({
  slack: [
    {
      name: 'test-channel',
      channelId: 'C123456789',
      schedule: '0 */1 * * *',
      outputPath: 'daily-notes/{{date}}.md',
    },
  ],
  ...overrides,
});

// ✅ DO: Time-sensitive test with fake timers
it('should schedule message fetching at specified intervals', () => {
  vi.useFakeTimers();
  const mockDate = new Date('2023-01-01T00:00:00Z');
  vi.setSystemTime(mockDate);

  // Test implementation
  
  vi.useRealTimers();
});
```

## **Test Organization & Naming**

- **Mirror source code structure** in test directories
- **Use descriptive test file names** with .test.ts or .spec.ts suffix
- **Group related tests** using nested describe blocks
- **Use clear, behavior-driven test names**

```text
tests/
├── unit/
│   ├── services/
│   │   ├── slack-service.test.ts
│   │   └── base-getter.test.ts
│   ├── writers/
│   │   └── file-writer.test.ts
│   └── config/
│       └── config-loader.test.ts
├── integration/
│   ├── slack-integration.test.ts
│   └── config-integration.test.ts
├── e2e/
│   └── full-sync.test.ts
└── fixtures/
    ├── slack-messages.json
    └── test-config.yaml
```

## **Continuous Testing Workflow**

- **Run tests in watch mode** during development
- **Use test-specific terminal** dedicated to Vitest
- **Monitor test coverage** and maintain high coverage
- **Run full test suite** before commits and PRs

```bash
# ✅ DO: Development workflow commands
pnpm test:watch          # Continuous testing during development
pnpm test:coverage       # Full test run with coverage
pnpm test:unit          # Run only unit tests
pnpm test:integration   # Run only integration tests
pnpm test:e2e          # Run E2E tests (when ready)
```

## **Error Testing Standards**

- **Test all error conditions** explicitly
- **Use proper error matching** with expect().toThrow()
- **Test error messages** and error types
- **Mock error scenarios** comprehensively

```typescript
// ✅ DO: Comprehensive error testing
it('should handle rate limiting gracefully', async () => {
  const rateLimitError = new Error('Rate limit exceeded');
  rateLimitError.statusCode = 429;
  
  mockSlackClient.conversations.history.mockRejectedValue(rateLimitError);
  
  await expect(getter.fetchMessages('C123')).rejects.toThrow(
    expect.objectContaining({
      name: 'SlackApiError',
      statusCode: 429,
      message: expect.stringContaining('Rate limit'),
    })
  );
});
```

## **Performance Testing**

- **Test async operations** with proper timeout handling
- **Mock slow operations** to test timeout behavior
- **Test concurrent operations** with Promise.all scenarios
- **Validate memory usage** in long-running operations

```typescript
// ✅ DO: Performance and timeout testing
it('should handle slow API responses with timeout', async () => {
  mockSlackClient.conversations.history.mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, 10000))
  );
  
  await expect(getter.fetchMessages('C123', { timeout: 5000 }))
    .rejects.toThrow('Operation timed out');
});
```
