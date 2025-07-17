import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackService } from '@/plugin/core/services/slack-service';
import { createMockSlackChannel, createMockSlackMessage, createMockSlackUser } from '../setup';

// Mock the Obsidian request function
vi.mock('obsidian', () => ({
  request: vi.fn(),
}));

describe('SlackService', () => {
  let slackService: SlackService;
  let mockConfig: any;
  let mockRequest: any;

  beforeEach(async () => {
    // Get the mocked request function
    const { request } = await import('obsidian');
    mockRequest = request as any;

    mockConfig = {
      token: 'xoxb-test-token',
      rateLimitConfig: {
        requestsPerMinute: 60,
        requestsPerSecond: 1,
        burstLimit: 5,
      },
    };

    slackService = new SlackService(mockConfig);
    mockRequest.mockClear();
    mockRequest.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      expect(slackService).toBeDefined();
    });

    it('should validate required token', () => {
      const invalidConfig = {
        token: '',
        rateLimitConfig: {
          requestsPerMinute: 60,
          requestsPerSecond: 1,
          burstLimit: 5,
        },
      };

      expect(() => {
        new SlackService(invalidConfig);
      }).toThrow();
    });
  });

  describe('Authentication', () => {
    it('should test authentication', async () => {
      mockRequest.mockResolvedValue(
        JSON.stringify({
          ok: true,
          user: 'test-user',
          team: 'test-team',
        })
      );

      const result = await slackService.testAuth();

      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Channel Management', () => {
    it('should fetch channels', async () => {
      const mockChannels = [
        createMockSlackChannel({ id: 'C123456789', name: 'general' }),
        createMockSlackChannel({ id: 'C987654321', name: 'random' }),
      ];

      mockRequest.mockResolvedValue(
        JSON.stringify({
          ok: true,
          channels: mockChannels,
        })
      );

      const result = await slackService.getChannels();

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockChannels);
    });
  });

  describe('Message Fetching', () => {
    it('should fetch messages from a channel', async () => {
      const mockMessages = [
        createMockSlackMessage({
          ts: '1234567890.123456',
          user: 'U123456789',
          text: 'Hello world',
        }),
        createMockSlackMessage({
          ts: '1234567890.123457',
          user: 'U987654321',
          text: 'How are you?',
        }),
      ];

      mockRequest.mockResolvedValue(
        JSON.stringify({
          ok: true,
          messages: mockMessages,
        })
      );

      const result = await slackService.getChannelMessages({
        channel: 'C123456789',
        limit: 10,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.messages).toEqual(mockMessages);
    });

    it('should handle pagination when fetching messages', async () => {
      const firstBatch = [
        createMockSlackMessage({
          ts: '1234567890.123456',
          user: 'U123456789',
          text: 'Hello',
        }),
        createMockSlackMessage({
          ts: '1234567890.123457',
          user: 'U987654321',
          text: 'World',
        }),
      ];

      const secondBatch = [
        createMockSlackMessage({
          ts: '1234567890.123458',
          user: 'U123456789',
          text: 'How',
        }),
        createMockSlackMessage({
          ts: '1234567890.123459',
          user: 'U987654321',
          text: 'Are you?',
        }),
      ];

      mockRequest
        .mockResolvedValueOnce(
          JSON.stringify({
            ok: true,
            messages: firstBatch,
            has_more: true,
            response_metadata: {
              next_cursor: 'next_cursor_token',
            },
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            ok: true,
            messages: secondBatch,
            has_more: false,
          })
        );

      const result = await slackService.getChannelMessages({
        channel: 'C123456789',
        limit: 4,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.messages).toEqual(firstBatch);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.cursor).toBe('next_cursor_token');
    });

    it('should handle API errors gracefully', async () => {
      mockRequest.mockRejectedValue(new Error('API Error'));

      const result = await slackService.getChannelMessages({
        channel: 'C123456789',
        limit: 10,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('User Management', () => {
    it('should fetch user information', async () => {
      const mockUser = createMockSlackUser({
        id: 'U123456789',
        name: 'john.doe',
      });

      mockRequest.mockResolvedValue(
        JSON.stringify({
          ok: true,
          user: mockUser,
        })
      );

      const result = await slackService.getUserInfo('U123456789');

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockRequest.mockRejectedValue(new Error('Network error'));

      const result = await slackService.getChannels();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle invalid responses', async () => {
      mockRequest.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      });

      const result = await slackService.testAuth();

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Channel Resolution', () => {
    it('should resolve channel ID as-is', async () => {
      const channelId = 'C033GL7MQ';

      const result = await slackService.resolveChannelId(channelId);

      expect(result.ok).toBe(true);
      expect(result.data).toBe(channelId);
    });

    it('should resolve DM channel ID as-is', async () => {
      const dmChannelId = 'D19HLGAFL';

      const result = await slackService.resolveChannelId(dmChannelId);

      expect(result.ok).toBe(true);
      expect(result.data).toBe(dmChannelId);
    });
    it('should remove # prefix from channel name', async () => {
      const mockChannel = createMockSlackChannel();
      mockChannel.name = 'general';

      // Mock the conversations.list response (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: true,
          channels: [mockChannel],
        })
      );

      const result = await slackService.resolveChannelId('#general');

      expect(result.ok).toBe(true);
      expect(result.data).toBe(mockChannel.id);
    });

    it('should resolve channel name to ID via cache', async () => {
      const mockChannel = createMockSlackChannel();
      mockChannel.name = 'devsecops';

      // Mock the conversations.list response to populate cache (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: true,
          channels: [mockChannel],
        })
      );

      // First call to populate cache
      await slackService.getChannels();

      // Now resolve the channel name
      const result = await slackService.resolveChannelId('devsecops');

      expect(result.ok).toBe(true);
      expect(result.data).toBe(mockChannel.id);
    });

    it('should resolve channel name to ID via direct API call', async () => {
      const mockChannel = createMockSlackChannel();
      mockChannel.name = 'private-channel';

      // Mock empty channels list (private channel not in list) (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: true,
          channels: [],
        })
      );

      // Mock direct conversations.info call (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: true,
          channel: mockChannel,
        })
      );

      const result = await slackService.resolveChannelId('private-channel');

      expect(result.ok).toBe(true);
      expect(result.data).toBe(mockChannel.id);
    });

    it('should handle channel not found error', async () => {
      // Mock empty channels list (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: true,
          channels: [],
        })
      );

      // Mock conversations.info failure (JSON string)
      mockRequest.mockResolvedValueOnce(
        JSON.stringify({
          ok: false,
          error: 'channel_not_found',
        })
      );

      const result = await slackService.resolveChannelId('nonexistent-channel');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Channel not found: nonexistent-channel');
    });

    it('should handle API errors when getting channels list', async () => {
      // Mock channels list failure
      mockRequest.mockRejectedValueOnce(new Error('API error'));

      const result = await slackService.resolveChannelId('some-channel');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Failed to get channels list');
    });
  });
});
