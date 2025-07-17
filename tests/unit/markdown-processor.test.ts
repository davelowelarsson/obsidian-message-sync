/**
 * Unit tests for Markdown Processor
 *
 * Tests the markdown generation functionality that ensures:
 * - Links are only created for URLs, not all text in angle brackets
 * - Images use proper markdown image syntax with ! prefix
 * - Markdown follows best practices as specified in CommonMark
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { MessageContext } from '../../src/plugin/core/utils/markdown-processor';
import { MarkdownProcessor } from '../../src/plugin/core/utils/markdown-processor';
import type { SlackChannel, SlackMessage, SlackUser } from '../../src/types/slack';

describe('MarkdownProcessor', () => {
  let processor: MarkdownProcessor;
  let mockChannel: SlackChannel;
  let mockUserCache: Map<string, SlackUser>;

  beforeEach(() => {
    processor = new MarkdownProcessor();
    mockChannel = {
      id: 'C123456',
      name: 'test-channel',
      is_channel: true,
      is_group: false,
      is_im: false,
      is_mpim: false,
      is_private: false,
      is_archived: false,
      is_general: false,
      is_shared: false,
      is_ext_shared: false,
      is_org_shared: false,
      is_pending_ext_shared: false,
      is_member: true,
      num_members: 10,
      topic: { value: 'Test topic', creator: 'U123456', last_set: 1234567890 },
      purpose: { value: 'Test purpose', creator: 'U123456', last_set: 1234567890 },
      creator: 'U123456',
      created: 1234567890,
    };

    mockUserCache = new Map([
      [
        'U123456',
        {
          id: 'U123456',
          name: 'john.doe',
          profile: {
            display_name: 'John Doe',
            real_name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ],
    ]);
  });

  describe('link processing', () => {
    it('should only create links for URLs, not all text in angle brackets', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Check out <https://example.com|this link> and <not-a-url>',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      // Should convert URL to markdown link but leave non-URL text as is
      expect(result.content).toContain('[this link](https://example.com)');
      expect(result.content).toContain('<not-a-url>');
      expect(result.content).not.toContain('[not-a-url](not-a-url)');
    });

    it('should handle URLs without display text correctly', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Visit <https://example.com> for more info',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      // Should show URL as plain text, not wrapped in brackets
      expect(result.content).toContain('Visit https://example.com for more info');
      expect(result.content).not.toContain('[https://example.com](https://example.com)');
    });

    it('should handle multiple URLs in the same message', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Check <https://example.com|Example> and <https://test.com|Test Site>',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      expect(result.content).toContain('[Example](https://example.com)');
      expect(result.content).toContain('[Test Site](https://test.com)');
    });
  });

  describe('image processing', () => {
    it('should use ! prefix for images in attachments', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Here is an image:',
        files: [
          {
            id: 'F123456',
            name: 'test.png',
            title: 'Test Image',
            mimetype: 'image/png',
            size: 1024,
            url_private: 'https://files.slack.com/files-pri/T123-F123/test.png',
          },
        ],
      };

      const fileDownloadResults = new Map([
        [
          '1234567890.123456',
          [
            {
              localPath: 'slack/test-channel/assets/F123456_test.png',
              relativePath: 'slack/test-channel/assets/F123456_test.png',
              downloadedSize: 1024,
              wasDownloaded: true,
            },
          ],
        ],
      ]);

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
        fileDownloadResults,
      });

      // Should use ! prefix for images
      expect(result.content).toContain('![test.png](slack/test-channel/assets/F123456_test.png)');
      expect(result.content).not.toContain(
        '- [test.png](slack/test-channel/assets/F123456_test.png)'
      );
    });

    it('should use regular link syntax for non-images', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Here is a document:',
        files: [
          {
            id: 'F123456',
            name: 'document.pdf',
            title: 'Test Document',
            mimetype: 'application/pdf',
            size: 2048,
            url_private: 'https://files.slack.com/files-pri/T123-F123/document.pdf',
          },
        ],
      };

      const fileDownloadResults = new Map([
        [
          '1234567890.123456',
          [
            {
              localPath: 'slack/test-channel/assets/F123456_document.pdf',
              relativePath: 'slack/test-channel/assets/F123456_document.pdf',
              downloadedSize: 2048,
              wasDownloaded: true,
            },
          ],
        ],
      ]);

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
        fileDownloadResults,
      });

      // Should use regular link syntax for non-images
      expect(result.content).toContain(
        '[document.pdf](slack/test-channel/assets/F123456_document.pdf)'
      );
      expect(result.content).not.toContain(
        '![document.pdf](slack/test-channel/assets/F123456_document.pdf)'
      );
    });
  });

  describe('message formatting', () => {
    it('should properly format message headers', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Test message',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      // Should have proper header format with ## prefix
      expect(result.content).toMatch(
        /## \d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M - John Doe/
      );
    });

    it('should handle messages with only links correctly', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: '<https://example.com|Example Link>',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      // Should not wrap entire message in link brackets
      expect(result.content).toContain('[Example Link](https://example.com)');
      expect(result.content).not.toContain('**[Example Link](https://example.com)**');
    });
  });

  describe('markdown best practices', () => {
    it('should follow CommonMark link syntax', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Check out <https://example.com/path?param=value|Example Site>',
      };

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
      });

      // Should follow proper markdown link syntax: [text](url)
      expect(result.content).toContain('[Example Site](https://example.com/path?param=value)');
    });

    it('should follow CommonMark image syntax', () => {
      const message: SlackMessage = {
        type: 'message',
        ts: '1234567890.123456',
        user: 'U123456',
        text: 'Screenshot attached',
        files: [
          {
            id: 'F123456',
            name: 'screenshot.png',
            mimetype: 'image/png',
            size: 1024,
            url_private: 'https://files.slack.com/files-pri/T123-F123/screenshot.png',
          },
        ],
      };

      const fileDownloadResults = new Map([
        [
          '1234567890.123456',
          [
            {
              localPath: 'slack/test-channel/assets/F123456_screenshot.png',
              relativePath: 'slack/test-channel/assets/F123456_screenshot.png',
              downloadedSize: 1024,
              wasDownloaded: true,
            },
          ],
        ],
      ]);

      const result = processor.processMessages({
        channel: mockChannel,
        messages: [message],
        userCache: mockUserCache,
        fileDownloadResults,
      });

      // Should follow proper markdown image syntax: ![alt](url)
      expect(result.content).toContain(
        '![screenshot.png](slack/test-channel/assets/F123456_screenshot.png)'
      );
    });
  });

  describe('Emoji handling', () => {
    it('should preserve emoji codes without converting to italics', () => {
      const processor = new MarkdownProcessor();

      const mockMessage: SlackMessage = {
        ts: '1721124000.000000',
        user: 'U123456',
        text: 'Using :hammer_and_wrench: to fix the :bug: in the code!',
        type: 'message',
      };

      const context: MessageContext = {
        channel: mockChannel,
        messages: [mockMessage],
        userCache: mockUserCache,
      };

      const result = processor.processMessages(context);

      // Should preserve emoji codes exactly as they are
      expect(result.content).toContain(':hammer_and_wrench:');
      expect(result.content).toContain(':bug:');

      // Should NOT convert underscores in emoji codes to italics
      expect(result.content).not.toContain(':hammer*and*wrench:');
      expect(result.content).not.toContain('*bug*');
    });

    it('should handle emoji codes with various characters', () => {
      const processor = new MarkdownProcessor();

      const mockMessage: SlackMessage = {
        ts: '1721124000.000000',
        user: 'U123456',
        text: 'Testing :+1: and :heavy_check_mark: and :100: and :point_right: emojis!',
        type: 'message',
      };

      const context: MessageContext = {
        channel: mockChannel,
        messages: [mockMessage],
        userCache: mockUserCache,
      };

      const result = processor.processMessages(context);

      // Should preserve all emoji codes correctly
      expect(result.content).toContain(':+1:');
      expect(result.content).toContain(':heavy_check_mark:');
      expect(result.content).toContain(':100:');
      expect(result.content).toContain(':point_right:');

      // Should NOT convert any underscores in emoji codes to italics
      expect(result.content).not.toContain(':heavy*check*mark:');
      expect(result.content).not.toContain(':point*right:');
    });

    it('should handle mixed emoji codes and regular italic formatting', () => {
      const processor = new MarkdownProcessor();

      const mockMessage: SlackMessage = {
        ts: '1721124000.000000',
        user: 'U123456',
        text: 'This is _italic text_ with :hammer_and_wrench: emoji and more _italic_ text!',
        type: 'message',
      };

      const context: MessageContext = {
        channel: mockChannel,
        messages: [mockMessage],
        userCache: mockUserCache,
      };

      const result = processor.processMessages(context);

      // Should preserve emoji codes
      expect(result.content).toContain(':hammer_and_wrench:');
      expect(result.content).not.toContain(':hammer*and*wrench:');

      // Should convert regular underscores to italics
      expect(result.content).toContain('*italic text*');
      expect(result.content).toContain('*italic*');

      // Should not have any remaining underscore formatting
      expect(result.content).not.toContain('_italic text_');
      expect(result.content).not.toContain('_italic_');
    });

    it('should handle edge cases with emoji codes', () => {
      const processor = new MarkdownProcessor();

      const mockMessage: SlackMessage = {
        ts: '1721124000.000000',
        user: 'U123456',
        text: 'Edge cases: :a: :_underscore_test: :123: and :emoji_with_multiple_underscores:',
        type: 'message',
      };

      const context: MessageContext = {
        channel: mockChannel,
        messages: [mockMessage],
        userCache: mockUserCache,
      };

      const result = processor.processMessages(context);

      // Should preserve all emoji codes
      expect(result.content).toContain(':a:');
      expect(result.content).toContain(':_underscore_test:');
      expect(result.content).toContain(':123:');
      expect(result.content).toContain(':emoji_with_multiple_underscores:');

      // Should NOT convert any underscores in emoji codes to italics
      expect(result.content).not.toContain(':*underscore*test:');
      expect(result.content).not.toContain(':emoji*with*multiple*underscores:');
    });

    it('should handle emoji codes at the start and end of messages', () => {
      const processor = new MarkdownProcessor();

      const mockMessage: SlackMessage = {
        ts: '1721124000.000000',
        user: 'U123456',
        text: ':wave: Hello world! :hammer_and_wrench:',
        type: 'message',
      };

      const context: MessageContext = {
        channel: mockChannel,
        messages: [mockMessage],
        userCache: mockUserCache,
      };

      const result = processor.processMessages(context);

      // Should preserve emoji codes at start and end
      expect(result.content).toContain(':wave:');
      expect(result.content).toContain(':hammer_and_wrench:');

      // Should NOT convert underscores to italics
      expect(result.content).not.toContain(':hammer*and*wrench:');
    });
  });
});
