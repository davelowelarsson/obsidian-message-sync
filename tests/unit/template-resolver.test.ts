/**
 * Unit tests for Template Resolver
 *
 * Tests the critical path resolution functionality that ensures:
 * - Directory structure is preserved (not flattened)
 * - Template variables are resolved correctly
 * - Path sanitization works without breaking paths
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TemplateResolver } from '../../src/plugin/core/utils/template-resolver';
import type { SlackChannel } from '../../src/types/slack';

describe('TemplateResolver', () => {
  let templateResolver: TemplateResolver;

  beforeEach(() => {
    templateResolver = new TemplateResolver({
      dateFormat: 'simple',
      channelNameFormat: 'name',
      sanitizeFilenames: true,
    });
  });

  describe('resolveTemplate', () => {
    it('should preserve directory structure with forward slashes', () => {
      const template = 'sync/slack/{{channel}}/{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'dm-davidlowelarsson',
        channelId: 'D19HLGAFL',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('sync/slack/dm-davidlowelarsson/2025-07-16.md');
      expect(result).toContain('/'); // Ensure slashes are preserved
      expect(result).not.toContain('_slack_'); // Ensure not flattened
    });

    it('should handle asset paths correctly', () => {
      const template = 'sync/slack/{{channel}}/assets/{{date}}/{{filename}}';
      const variables = {
        date: '2025-07-13',
        channel: 'dm-davidlowelarsson',
        channelId: 'D19HLGAFL',
        year: '2025',
        month: '07',
        day: '13',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('sync/slack/dm-davidlowelarsson/assets/2025-07-13/{{filename}}');
      expect(result.split('/').length).toBe(6); // Correct depth: sync/slack/dm-davidlowelarsson/assets/2025-07-13/{{filename}}
    });

    it('should sanitize individual path components without breaking structure', () => {
      const template = 'sync/slack/{{channel}}/{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'dm-david<lowe>larsson', // Contains dangerous characters
        channelId: 'D19HLGAFL',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('sync/slack/dm-david_lowe_larsson/2025-07-16.md');
      expect(result).toContain('sync/slack/'); // Structure preserved
      expect(result).not.toContain('<'); // Dangerous chars removed
      expect(result).not.toContain('>'); // Dangerous chars removed
    });

    it('should handle root-level files without path structure', () => {
      const template = '{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'dm-davidlowelarsson',
        channelId: 'D19HLGAFL',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('2025-07-16.md');
    });

    it('should handle multiple template variables correctly', () => {
      const template = 'sync/{{year}}/{{month}}/{{channel}}/{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'general',
        channelId: 'C123456',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('sync/2025/07/general/2025-07-16.md');
      expect(result.split('/').length).toBe(5); // Correct depth
    });
  });

  describe('formatChannelName', () => {
    it('should format DM channels correctly', () => {
      const channel: SlackChannel = {
        id: 'D19HLGAFL',
        name: 'DM with David Lowe Larsson',
        is_channel: false,
        is_group: false,
        is_im: true,
        is_archived: false,
        is_general: false,
        is_member: true,
        is_private: false,
        is_mpim: false,
        created: 1463497827,
        creator: 'U123456',
        is_shared: false,
        is_org_shared: false,
        locale: 'en-US',
      };

      const variables = templateResolver.createTemplateVariables(channel, new Date('2025-07-16'));

      expect(variables.channel).toBe('dm-davidlowelarsson');
    });

    it('should handle regular channels', () => {
      const channel: SlackChannel = {
        id: 'C123456',
        name: 'general',
        is_channel: true,
        is_group: false,
        is_im: false,
        is_archived: false,
        is_general: true,
        is_member: true,
        is_private: false,
        is_mpim: false,
        created: 1463497827,
        creator: 'U123456',
        is_shared: false,
        is_org_shared: false,
        locale: 'en-US',
      };

      const variables = templateResolver.createTemplateVariables(channel, new Date('2025-07-16'));

      expect(variables.channel).toBe('general');
    });

    it('should handle group DMs', () => {
      const channel: SlackChannel = {
        id: 'G123456',
        name: 'Group DM',
        is_channel: false,
        is_group: true,
        is_im: false,
        is_archived: false,
        is_general: false,
        is_member: true,
        is_private: false,
        is_mpim: true,
        created: 1463497827,
        creator: 'U123456',
        is_shared: false,
        is_org_shared: false,
        locale: 'en-US',
      };

      const variables = templateResolver.createTemplateVariables(channel, new Date('2025-07-16'));

      expect(variables.channel).toBe('group-dm-G123456');
    });
  });

  describe('resolveOutputPath', () => {
    it('should create correct nested structure for DM channels', () => {
      const template = 'sync/slack/{{channel}}/{{date}}.md';
      const channel: SlackChannel = {
        id: 'D19HLGAFL',
        name: 'DM with David Lowe Larsson',
        is_channel: false,
        is_group: false,
        is_im: true,
        is_archived: false,
        is_general: false,
        is_member: true,
        is_private: false,
        is_mpim: false,
        created: 1463497827,
        creator: 'U123456',
        is_shared: false,
        is_org_shared: false,
        locale: 'en-US',
      };

      const result = templateResolver.resolveOutputPath(template, channel, new Date('2025-07-16'));

      expect(result).toBe('sync/slack/dm-davidlowelarsson/2025-07-16.md');

      // Verify the path structure matches our expected tree
      const parts = result.split('/');
      expect(parts[0]).toBe('sync');
      expect(parts[1]).toBe('slack');
      expect(parts[2]).toBe('dm-davidlowelarsson');
      expect(parts[3]).toBe('2025-07-16.md');
    });

    it('should create correct asset paths', () => {
      const template = 'slack/{{channel}}/assets/{{filename}}';
      const channel: SlackChannel = {
        id: 'D19HLGAFL',
        name: 'DM with David Lowe Larsson',
        is_channel: false,
        is_group: false,
        is_im: true,
        is_archived: false,
        is_general: false,
        is_member: true,
        is_private: false,
        is_mpim: false,
        created: 1463497827,
        creator: 'U123456',
        is_shared: false,
        is_org_shared: false,
        locale: 'en-US',
      };

      const result = templateResolver.resolveOutputPath(template, channel, new Date('2025-07-13'));

      expect(result).toBe('slack/dm-davidlowelarsson/assets/{{filename}}');

      // Verify the path structure for assets
      const parts = result.split('/');
      expect(parts[0]).toBe('slack');
      expect(parts[1]).toBe('dm-davidlowelarsson');
      expect(parts[2]).toBe('assets');
    });
  });

  describe('sanitization', () => {
    it('should preserve forward slashes in paths', () => {
      const template = 'sync/slack/{{channel}}/{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'test-channel',
        channelId: 'C123456',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toContain('/');
      expect(result).not.toContain('_slack_'); // Should not flatten
    });

    it('should sanitize dangerous characters in channel names', () => {
      const template = 'sync/slack/{{channel}}/{{date}}.md';
      const variables = {
        date: '2025-07-16',
        channel: 'test<>:"\\|?*channel',
        channelId: 'C123456',
        year: '2025',
        month: '07',
        day: '16',
        timestamp: '1642322400',
      };

      const result = templateResolver.resolveTemplate(template, variables);

      expect(result).toBe('sync/slack/test_channel/2025-07-16.md');
      expect(result).toContain('sync/slack/'); // Structure preserved
      expect(result).not.toContain('<'); // Dangerous chars removed
      expect(result).not.toContain('>'); // Dangerous chars removed
      expect(result).not.toContain(':'); // Dangerous chars removed
      expect(result).not.toContain('"'); // Dangerous chars removed
      expect(result).not.toContain('\\'); // Dangerous chars removed
      expect(result).not.toContain('|'); // Dangerous chars removed
      expect(result).not.toContain('?'); // Dangerous chars removed
      expect(result).not.toContain('*'); // Dangerous chars removed
    });
  });
});
