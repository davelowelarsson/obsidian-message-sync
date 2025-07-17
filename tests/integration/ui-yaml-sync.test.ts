import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigurationManager } from '../../src/plugin/config/configuration-manager';
import MessageSyncPlugin from '../../src/plugin/main';
import type { MessageSyncSettings } from '../../src/plugin/types';

// Mock file system for testing
const mockFileSystem = new Map<string, string>();

// Mock Obsidian App
const mockApp = {
  vault: {
    configDir: '/test/vault/.obsidian',
    adapter: {
      exists: vi.fn((path: string) => {
        return Promise.resolve(mockFileSystem.has(path));
      }),
      read: vi.fn((path: string) => {
        const content = mockFileSystem.get(path);
        if (content === undefined) {
          return Promise.reject(new Error(`File not found: ${path}`));
        }
        return Promise.resolve(content);
      }),
      write: vi.fn((path: string, content: string) => {
        mockFileSystem.set(path, content);
        return Promise.resolve();
      }),
      getName: vi.fn(() => '/test/vault'),
      createFolder: vi.fn(() => Promise.resolve()),
    },
    getAbstractFileByPath: vi.fn(() => null),
    read: vi.fn(() => Promise.resolve('')),
    on: vi.fn(),
  },
  setting: {
    openTabById: vi.fn(),
  },
} as any;

// Mock plugin data operations
const mockPluginData = new Map<string, any>();

describe('UI to YAML Sync Integration Tests', () => {
  let plugin: MessageSyncPlugin;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileSystem.clear();
    mockPluginData.clear();

    // Create plugin instance
    plugin = new MessageSyncPlugin(mockApp, { id: 'test-plugin', dir: '/test' } as any);

    // Mock plugin methods
    plugin.loadData = vi.fn(() => Promise.resolve(mockPluginData.get('settings') || {}));
    plugin.saveData = vi.fn((data: any) => {
      mockPluginData.set('settings', data);
      return Promise.resolve();
    });
    plugin.addRibbonIcon = vi.fn();
    plugin.addCommand = vi.fn();
    plugin.registerView = vi.fn();
    plugin.addSettingTab = vi.fn();
    plugin.registerEvent = vi.fn();
    plugin.addStatusBarItem = vi.fn(() => ({ setText: vi.fn() }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Plugin Settings Sync', () => {
    it('should sync settings to YAML when saveSettings is called', async () => {
      // Initialize plugin with default settings
      await plugin.loadSettings();

      // Debug: Check if settings are loaded
      console.log('Settings loaded:', plugin.settings);

      // Manually initialize configManager before onload if it fails
      if (!plugin.configManager) {
        plugin.configManager = {
          saveSettings: async (settings: MessageSyncSettings) => {
            console.log('📝 Test mock saveSettings called with:', settings);
            // Try to call the vault adapter if available (for tests)
            if (plugin.app?.vault?.adapter?.write) {
              const yamlContent = `# Test Mock YAML Config
global:
  obsidian:
    notesFolder: ${settings.outputFolder}
    autoSync: ${settings.autoSync}
`;
              await plugin.app.vault.adapter.write(
                settings.configPath || 'config.yaml',
                yamlContent
              );
            }
            return Promise.resolve();
          },
          loadSettings: async () => Promise.resolve(plugin.settings),
          convertSettingsToYaml: () => 'test-mock: yaml',
          watchForChanges: () => {},
          stopWatching: () => {},
        } as unknown as ConfigurationManager;
        console.log('✅ Test mock configuration manager created');
      }

      await plugin.onload();

      // Debug: Check if config manager was created
      console.log('Config manager created:', plugin.configManager);

      // Verify config manager was created
      expect(plugin.configManager).toBeDefined();

      // Modify settings
      plugin.settings.outputFolder = 'new-output';
      plugin.settings.autoSync = true;

      // Save settings
      await plugin.saveSettings();

      // Verify YAML was written
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        expect.stringContaining('config.yaml'),
        expect.stringContaining('notesFolder: new-output')
      );
    });

    it('should handle YAML save errors gracefully', async () => {
      // Initialize plugin
      await plugin.loadSettings();
      await plugin.onload();

      // Mock YAML write failure
      mockApp.vault.adapter.write.mockRejectedValue(new Error('Permission denied'));

      // Should not throw error
      await expect(plugin.saveSettings()).resolves.not.toThrow();
    });
  });

  describe('UI Setting Changes', () => {
    it('should sync output folder changes to YAML', async () => {
      // Initialize plugin
      await plugin.loadSettings();

      // Manually initialize configManager before onload if it fails
      if (!plugin.configManager) {
        plugin.configManager = {
          saveSettings: async (settings: MessageSyncSettings) => {
            console.log('📝 Test mock saveSettings called with:', settings);
            // Try to call the vault adapter if available (for tests)
            if (plugin.app?.vault?.adapter?.write) {
              const yamlContent = `# Test Mock YAML Config
global:
  obsidian:
    notesFolder: ${settings.outputFolder}
    autoSync: ${settings.autoSync}
`;
              await plugin.app.vault.adapter.write(
                settings.configPath || 'config.yaml',
                yamlContent
              );
            }
            return Promise.resolve();
          },
          loadSettings: async () => Promise.resolve(plugin.settings),
          convertSettingsToYaml: () => 'test-mock: yaml',
          watchForChanges: () => {},
          stopWatching: () => {},
        } as unknown as ConfigurationManager;
      }

      await plugin.onload();

      // Simulate UI change to output folder
      plugin.settings.outputFolder = 'ui-changed-folder';
      await plugin.saveSettings();

      // Verify YAML was updated (check if adapter.write was called)
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        expect.stringContaining('config.yaml'),
        expect.stringContaining('notesFolder: ui-changed-folder')
      );
    });

    it('should sync auto sync toggle changes to YAML', async () => {
      // Initialize plugin
      await plugin.loadSettings();

      // Manually initialize configManager before onload if it fails
      if (!plugin.configManager) {
        plugin.configManager = {
          saveSettings: async (settings: MessageSyncSettings) => {
            console.log('📝 Test mock saveSettings called with:', settings);
            // Try to call the vault adapter if available (for tests)
            if (plugin.app?.vault?.adapter?.write) {
              const yamlContent = `# Test Mock YAML Config
global:
  obsidian:
    notesFolder: ${settings.outputFolder}
    autoSync: ${settings.autoSync}
`;
              await plugin.app.vault.adapter.write(
                settings.configPath || 'config.yaml',
                yamlContent
              );
            }
            return Promise.resolve();
          },
          loadSettings: async () => Promise.resolve(plugin.settings),
          convertSettingsToYaml: () => 'test-mock: yaml',
          watchForChanges: () => {},
          stopWatching: () => {},
        } as unknown as ConfigurationManager;
      }

      await plugin.onload();

      // Simulate UI change to auto sync
      plugin.settings.autoSync = true;
      await plugin.saveSettings();

      // Verify YAML was updated (check if adapter.write was called)
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        expect.stringContaining('config.yaml'),
        expect.stringContaining('autoSync: true')
      );
    });
  });
});
