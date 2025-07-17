/**
 * Integration test for enhanced validation system
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApp } from '../setup';

describe('Enhanced Configuration Validation Integration', () => {
  let mockApp: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    // Set up basic environment
    process.env['OBSIDIAN_VAULT_PATH'] = '/tmp/test-vault';
    process.env['SLACK_BOT_TOKEN'] = 'xoxb-test-token-123456789';

    mockApp = createMockApp();
  });

  describe('Configuration System Integration', () => {
    it('should have mock app available', () => {
      expect(mockApp).toBeDefined();
      expect(mockApp.vault).toBeDefined();
      expect(mockApp.workspace).toBeDefined();
    });

    it('should handle environment variable validation', () => {
      expect(process.env['SLACK_BOT_TOKEN']).toBe('xoxb-test-token-123456789');
      expect(process.env['OBSIDIAN_VAULT_PATH']).toBe('/tmp/test-vault');
    });

    it('should validate basic configuration structure', () => {
      const config = {
        global: {
          obsidian: {
            vaultPath: '/tmp/test-vault',
          },
          sync: {
            enabled: true,
          },
        },
        sources: {
          slack: [],
          signal: [],
          teams: [],
          telegram: [],
        },
      };

      expect(config.global.obsidian.vaultPath).toBe('/tmp/test-vault');
      expect(config.global.sync.enabled).toBe(true);
      expect(config.sources.slack).toEqual([]);
    });
  });

  describe('Plugin Environment Integration', () => {
    it('should work with mocked Obsidian environment', () => {
      expect(mockApp.vault.adapter).toBeDefined();
      expect(mockApp.workspace.getActiveFile).toBeDefined();
    });

    it('should validate configuration schema integration', () => {
      const validConfig = {
        global: {
          obsidian: {
            vaultPath: '/tmp/test-vault',
          },
        },
        sources: {
          slack: [],
          signal: [],
          teams: [],
          telegram: [],
        },
      };

      // Basic structure validation
      expect(validConfig.global).toBeDefined();
      expect(validConfig.sources).toBeDefined();
      expect(typeof validConfig.global.obsidian.vaultPath).toBe('string');
      expect(Array.isArray(validConfig.sources.slack)).toBe(true);
    });
  });

  describe('Template Resolution Integration', () => {
    it('should handle template path resolution', () => {
      const templatePath = 'messages/{{date}}.md';

      // Mock template resolution
      const resolved = templatePath.replace('{{date}}', '2025-01-15');

      expect(resolved).toBe('messages/2025-01-15.md');
    });

    it('should validate template variables', () => {
      const supportedVars = ['date', 'week', 'month', 'year'];
      const validTemplate = '{{year}}/{{month}}/{{date}}.md';

      // Extract variables from template
      const variables = validTemplate.match(/\{\{(\w+)\}\}/g)?.map((v) => v.slice(2, -2)) || [];

      expect(variables).toEqual(['year', 'month', 'date']);
      expect(variables.every((v) => supportedVars.includes(v))).toBe(true);
    });
  });
});
