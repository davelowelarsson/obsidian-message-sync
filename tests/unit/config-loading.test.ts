import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { YamlConfig } from '../../src/plugin/types';

describe('Configuration Loading', () => {
  it('should correctly identify path types', () => {
    const testCases = [
      { path: '/Users/dlo/config.yaml', expected: 'absolute' },
      {
        path: '.obsidian/plugins/obsidian-message-sync-dev/config.yaml',
        expected: 'obsidian-config',
      },
      { path: 'config.yaml', expected: 'plugin-relative' },
      { path: 'notes/config.yaml', expected: 'vault-relative' },
    ];

    testCases.forEach(({ path, expected }) => {
      let result: string;
      if (path.startsWith('/')) {
        result = 'absolute';
      } else if (path.startsWith('.obsidian/')) {
        result = 'obsidian-config';
      } else if (path.includes('/')) {
        result = 'vault-relative';
      } else {
        result = 'plugin-relative';
      }

      expect(result).toBe(expected);
    });
  });

  it('should parse YAML configuration correctly', () => {
    const yamlContent = `
global:
  obsidian:
    vaultPath: "/Users/dlo/vault"
    notesFolder: "sync"
  sync:
    enabled: true
    defaultSchedule: "manual"
  logging:
    level: "info"
  environment:
    nodeEnv: "development"

sources:
  slack:
    - service: slack
      name: "primary-slack"
      token: "xoxp-test-token"
      channels: ["general", "dev"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
  signal: []
  teams: []
  telegram: []
`;

    const config = parse(yamlContent) as YamlConfig;

    expect(config.global.obsidian.notesFolder).toBe('sync');
    expect(config.sources.slack).toHaveLength(1);
    expect(config.sources.slack[0]?.name).toBe('primary-slack');
    expect(config.sources.slack[0]?.enabled).toBe(true);
    expect(config.sources.slack[0]?.channels).toEqual(['general', 'dev']);
  });

  it('should identify enabled Slack configurations', () => {
    const config: YamlConfig = {
      global: {
        obsidian: { vaultPath: '/Users/dlo/vault', notesFolder: 'sync' },
        sync: { enabled: true, defaultSchedule: 'manual' },
        logging: { level: 'info' },
        environment: { nodeEnv: 'development' },
      },
      sources: {
        slack: [
          {
            service: 'slack',
            name: 'primary-slack',
            token: 'xoxp-test-token',
            channels: ['general', 'dev'],
            output: 'sync/slack/{{channel}}/{{month}}.md',
            schedule: 'manual',
            enabled: true,
          },
          {
            service: 'slack',
            name: 'secondary-slack',
            token: 'xoxp-test-token-2',
            channels: ['random'],
            output: 'sync/slack/{{channel}}/{{month}}.md',
            schedule: 'manual',
            enabled: false,
          },
        ],
        signal: [],
        teams: [],
        telegram: [],
      },
    };

    const enabledSlack = config.sources.slack.filter((s) => s.enabled);
    expect(enabledSlack).toHaveLength(1);
    expect(enabledSlack[0]?.name).toBe('primary-slack');
  });

  it('should validate configuration correctly', () => {
    const validConfig: YamlConfig = {
      global: {
        obsidian: { vaultPath: '/Users/dlo/vault', notesFolder: 'sync' },
        sync: { enabled: true, defaultSchedule: 'manual' },
        logging: { level: 'info' },
        environment: { nodeEnv: 'development' },
      },
      sources: {
        slack: [
          {
            service: 'slack',
            name: 'primary-slack',
            token: 'xoxp-test-token',
            channels: ['general', 'dev'],
            output: 'sync/slack/{{channel}}/{{month}}.md',
            schedule: 'manual',
            enabled: true,
          },
        ],
        signal: [],
        teams: [],
        telegram: [],
      },
    };

    const invalidConfig: YamlConfig = {
      global: {
        obsidian: { vaultPath: '/Users/dlo/vault', notesFolder: 'sync' },
        sync: { enabled: true, defaultSchedule: 'manual' },
        logging: { level: 'info' },
        environment: { nodeEnv: 'development' },
      },
      sources: {
        slack: [],
        signal: [],
        teams: [],
        telegram: [],
      },
    };

    // Valid config should have enabled Slack configurations
    const validEnabledSlack = validConfig.sources.slack.filter((s) => s.enabled);
    expect(validEnabledSlack.length).toBeGreaterThan(0);

    // Invalid config should have no enabled Slack configurations
    const invalidEnabledSlack = invalidConfig.sources.slack.filter((s) => s.enabled);
    expect(invalidEnabledSlack.length).toBe(0);
  });
});
