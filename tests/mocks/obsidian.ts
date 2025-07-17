import { vi } from 'vitest';

/**
 * Mock Obsidian Component class
 */
export class Component {
  register = vi.fn();
  unload = vi.fn();
  load = vi.fn();
  onload = vi.fn();
  onunload = vi.fn();
  addChild = vi.fn();
  removeChild = vi.fn();
}

/**
 * Mock Obsidian App
 */
export class App {
  vault: any;
  workspace: any;

  constructor() {
    this.vault = createMockVault();
    this.workspace = {
      getActiveFile: vi.fn(),
    };
  }
}

/**
 * Mock Obsidian Vault
 */
export class Vault {
  adapter: any;

  constructor() {
    this.adapter = {
      exists: vi.fn(),
      read: vi.fn(),
      write: vi.fn(),
      getName: vi.fn(() => '/test/vault'),
    };
  }

  getAbstractFileByPath = vi.fn();
  create = vi.fn();
  modify = vi.fn();
  read = vi.fn();
  createFolder = vi.fn();
}

/**
 * Mock Obsidian TFile
 */
export class TFile {
  path: string;
  name: string;

  constructor(path?: string) {
    this.path = path || '';
    this.name = path?.split('/').pop() || '';
  }
}

/**
 * Mock Obsidian Notice
 */
export class Notice {}

/**
 * Mock normalizePath function
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Create mock vault for testing
 */
function createMockVault() {
  const files = new Map<string, string>();

  return {
    adapter: {
      exists: vi.fn((path: string) => Promise.resolve(files.has(path))),
      read: vi.fn((path: string) => Promise.resolve(files.get(path) || '')),
      write: vi.fn((path: string, content: string) => {
        files.set(path, content);
        return Promise.resolve();
      }),
      getName: vi.fn(() => '/test/vault'),
    },
    getAbstractFileByPath: vi.fn((path: string) => {
      if (files.has(path)) {
        return new TFile(path);
      }
      return null;
    }),
    create: vi.fn((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve(new TFile(path));
    }),
    modify: vi.fn((file: TFile, content: string) => {
      files.set(file.path, content);
      return Promise.resolve();
    }),
    read: vi.fn((file: TFile) => Promise.resolve(files.get(file.path) || '')),
    createFolder: vi.fn((_path: string) => Promise.resolve()),
  };
}

/**
 * Mock Obsidian Plugin class
 */
export class Plugin extends Component {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  loadData = vi.fn();
  saveData = vi.fn();
  addRibbonIcon = vi.fn();
  addCommand = vi.fn();
  addSettingTab = vi.fn();
  registerView = vi.fn();
  registerEvent = vi.fn();
  addStatusBarItem = vi.fn();
}

/**
 * Mock Obsidian PluginSettingTab class
 */
export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: vi.fn(),
      createEl: vi.fn(),
      createDiv: vi.fn(),
      addClass: vi.fn(),
    };
  }

  display = vi.fn();
  hide = vi.fn();
}

/**
 * Mock Obsidian ItemView class
 */
export class ItemView extends Component {
  containerEl: any;
  leaf: any;

  constructor(leaf: any) {
    super();
    this.leaf = leaf;
    this.containerEl = {
      empty: vi.fn(),
      createEl: vi.fn(),
      createDiv: vi.fn(),
      addClass: vi.fn(),
    };
  }

  getViewType = vi.fn();
  getDisplayText = vi.fn();
  onOpen = vi.fn();
  onClose = vi.fn();
}
