# UI Design Document: Obsidian Message Sync Plugin

## Overview
This document defines the UI architecture and components for the Obsidian Message Sync plugin settings interface, ensuring consistency and preventing the loss of important features during iterations.

## Core Design Principles

### 1. Progressive Disclosure
- **Onboarding**: Simple, guided setup for new users
- **Advanced**: Full feature access for power users
- **Danger Zone**: Clearly separated destructive actions

### 2. Real-time Synchronization
- All UI changes immediately reflect in both plugin settings and YAML config
- Bidirectional sync: UI ↔ Plugin Settings ↔ YAML Config
- Visual feedback for sync status

### 3. Contextual Actions
- Actions are available where they make sense
- Critical actions (sync, validate) are easily accessible
- Destructive actions are clearly marked and confirmed

## UI Architecture

### Main Settings Tab Structure
```
┌─ Message Sync Settings ─────────────────────────────────────┐
│                                                              │
│  [Configuration Status Section]                             │
│  [Quick Actions Section]                                    │
│  [General Settings Section]                                 │
│  [Slack Configurations Section]                             │
│  [Advanced Settings Section]                                │
│  [Danger Zone Section]                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Configuration Status Section
**Purpose**: Show current sync status and configuration health
**Components**:
- Configuration file path indicator
- Last sync timestamp
- Configuration validation status
- Sync health indicators

### 2. Quick Actions Section
**Purpose**: Provide immediate access to common actions
**Components**:
- **Sync Now** button (prominent, always visible)
- **Validate Config** button
- **Load from YAML** button
- **Export to YAML** button
- Progress indicators for actions

### 3. General Settings Section
**Purpose**: Core plugin configuration
**Components**:
- Output folder setting
- Organization method (daily/weekly/monthly/yearly)
- Auto-sync toggle and interval
- Notification preferences
- Debug mode toggle

### 4. Slack Configurations Section
**Purpose**: Manage multiple Slack workspaces
**Components**:
- **Add Workspace** button
- Dynamic workspace sections:
  - Workspace name
  - Bot token (password field)
  - Channel list (textarea)
  - Enabled toggle
  - Test connection button
  - Remove workspace button
- Last sync status per workspace

### 5. Advanced Settings Section
**Purpose**: Power user features and detailed configuration
**Components**:
- Template customization
- Rate limiting settings
- File download preferences
- Custom output templates
- Batch processing options
- Debug logging level

### 6. Danger Zone Section
**Purpose**: Destructive actions that require confirmation
**Components**:
- **Reset All Settings** (with confirmation)
- **Clear All Data** (with confirmation)
- **Delete Configuration File** (with confirmation)
- **Force Resync** (with confirmation)
- Warning styling and confirmation dialogs

**Visual Design**:
- Red border around the entire danger zone area
- Light red background for visibility
- Warning styling for all buttons
- Clear separation from other sections

## Data Flow Architecture

### Settings Synchronization Flow
```
UI Change → Plugin Settings → YAML Config → File System
    ↑                                              ↓
    └── File Watcher ← Configuration Manager ←─────┘
```

### Component Communication
1. **UI Components** → **SettingsTab** → **ConfigurationManager**
2. **ConfigurationManager** → **Plugin Settings** → **Service Updates**
3. **File Watcher** → **ConfigurationManager** → **UI Refresh**

## Action Specifications

### Critical Actions (Always Available)
- **Sync Now**: Immediate manual sync
- **Validate Config**: Check configuration integrity
- **Emergency Stop**: Cancel running sync operations

### Configuration Actions
- **Load from YAML**: Import settings from config file
- **Export to YAML**: Save current settings to config file
- **Reset Section**: Reset specific sections to defaults
- **Test Connection**: Verify Slack workspace connectivity

### Destructive Actions (Danger Zone)
- **Reset All Settings**: Clear all plugin settings
- **Clear Sync Data**: Remove all synchronized files
- **Delete Config File**: Remove YAML configuration
- **Force Resync**: Delete and re-download all messages

## UI State Management

### Settings State
```typescript
interface UIState {
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  configValid: boolean;
  lastSync: Date | null;
  pendingChanges: boolean;
  activeWorkspace: string | null;
}
```

### Action States
```typescript
interface ActionState {
  syncNow: 'idle' | 'running' | 'success' | 'error';
  validateConfig: 'idle' | 'running' | 'success' | 'error';
  loadFromYaml: 'idle' | 'running' | 'success' | 'error';
  exportToYaml: 'idle' | 'running' | 'success' | 'error';
}
```

## Component Implementation Guidelines

### 1. Settings Tab Base Class
```typescript
abstract class BaseSettingsTab extends PluginSettingTab {
  protected configManager: ConfigurationManager;
  protected uiState: UIState;
  protected actionState: ActionState;

  abstract renderQuickActions(): void;
  abstract renderMainContent(): void;
  abstract renderDangerZone(): void;
}
```

### 2. Configuration Manager Integration
```typescript
class ConfigurationManager {
  // Bidirectional sync methods
  loadFromYaml(): Promise<void>;
  saveToYaml(): Promise<void>;
  validateConfiguration(): Promise<ValidationResult>;

  // Event handlers
  onSettingsChanged(callback: (settings: Settings) => void): void;
  onYamlChanged(callback: (yaml: YamlConfig) => void): void;
}
```

### 3. Component Lifecycle
1. **Initialize**: Load current settings and establish file watchers
2. **Render**: Display current state with real-time updates
3. **Handle Changes**: Immediately sync changes across all systems
4. **Validate**: Continuously validate configuration integrity
5. **Cleanup**: Properly dispose of watchers and handlers

## Error Handling Strategy

### User-Facing Errors
- **Validation Errors**: Inline field validation with clear messages
- **Sync Errors**: Prominent error display with retry options
- **Configuration Errors**: Detailed error messages with fix suggestions

### Error Recovery
- **Auto-retry**: Automatic retry for transient errors
- **Rollback**: Ability to revert to last known good configuration
- **Manual Override**: Options to bypass validation when necessary

## Testing Strategy

### UI Testing
- Component rendering tests
- User interaction simulation
- State change verification
- Error condition handling

### Integration Testing
- Settings synchronization flow
- File system integration
- Configuration validation
- Action execution

## Implementation Phases

### Phase 1: Core Structure
- [ ] Base settings tab implementation
- [ ] Configuration manager integration
- [ ] Quick actions section
- [ ] Basic synchronization flow

### Phase 2: Enhanced Features
- [ ] Advanced settings section
- [ ] Multiple workspace management
- [ ] Real-time validation
- [ ] Progress indicators

### Phase 3: Polish & Safety
- [ ] Danger zone implementation
- [ ] Comprehensive error handling
- [ ] User experience improvements
- [ ] Performance optimization

## Maintenance Guidelines

### Adding New Features
1. Update this design document first
2. Ensure proper integration with ConfigurationManager
3. Add appropriate error handling
4. Update tests and documentation

### Removing Features
1. Check dependencies in this document
2. Ensure no critical functionality is lost
3. Provide migration path if necessary
4. Update all related documentation

### UI Changes
1. Follow established patterns from this document
2. Maintain consistency with existing components
3. Test synchronization flow thoroughly
4. Update component specifications

---

This design document serves as the authoritative reference for UI implementation and iteration, ensuring consistency and preventing the loss of important features.
