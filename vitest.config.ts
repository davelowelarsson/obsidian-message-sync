import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'obsidian': resolve(__dirname, './tests/mocks/obsidian.ts'),
    },
  },
  test: {
    // Enable TypeScript support
    typecheck: {
      enabled: true,
    },
    // Test environment
    environment: 'node',
    // Global test settings
    globals: true,
    // Setup file
    setupFiles: ['./tests/setup.ts'],
    // Include patterns for test files
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.git',
    ],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      exclude: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        'tests',
        'examples',
        'scripts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/*.config.js',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Test timeout
    testTimeout: 10000,
    // Watch mode configuration
    watch: true,
    // Parallel test execution
    pool: 'threads',
    // Enable debugging
    inspect: false,
    // Reporter configuration
    reporters: ['default', 'json'],
    // Output directory
    outputFile: {
      json: './coverage/test-results.json',
    },
    // Console output configuration
    silent: false,
    printConsoleTrace: false,
    // Reduce noise from child processes and external libraries
    onConsoleLog: (log, type) => {
      // Filter out dotenv debug messages
      if (log.includes('[dotenv@') || log.includes('injecting env')) {
        return false;
      }
      // Filter out npm warnings
      if (log.includes('npm warn Unknown env config')) {
        return false;
      }
      return true;
    },
  },
});
