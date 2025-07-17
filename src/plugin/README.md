# Obsidian Message Sync Plugin

## Overview

This plugin integrates the Obsidian Message Sync CLI functionality directly into Obsidian, providing a seamless way to synchronize messages from Slack into your Obsidian vault.

## Features

- **Direct CLI Integration**: Full access to all CLI commands from within Obsidian
- **Channel Management**: Browse and sync individual channels with one-click
- **Configuration Management**: Manage sync settings through the plugin interface
- **Custom View**: Dedicated view with sync controls and status information
- **Settings Integration**: Comprehensive settings tab with all configuration options

## Components

### Plugin Service (`service.ts`)

Core service layer that bridges the CLI functionality with Obsidian:

- Authentication management
- Channel discovery and synchronization
- Configuration validation
- Progress tracking and error handling

### Settings Tab (`settings-tab.ts`)

Provides a comprehensive settings interface:

- Configuration file management
- Available channels display with click-to-sync
- Sync options and preferences
- Authentication status

### Plugin View (`view.ts`)

Dedicated view for sync operations:

- Real-time sync status
- CLI command reference
- Integration information
- Quick access to common operations

### Types (`types.ts`)

TypeScript definitions for:

- Plugin settings and configuration
- Sync options and results
- Channel information
- Service interfaces

## Installation

1. Copy the plugin files to your Obsidian vault's `.obsidian/plugins/obsidian-message-sync/` directory
2. Enable the plugin in Obsidian's settings
3. Configure your Slack credentials in the plugin settings

## Usage

### Initial Setup

1. Open the plugin settings tab
2. Configure your Slack authentication credentials
3. Set your preferred output directory and sync options

### Syncing Messages

1. Use the "View Available Channels" button to browse channels
2. Click on any channel to sync its messages
3. Use the dedicated plugin view for advanced sync operations

### Configuration

All CLI configuration options are available through the plugin settings:

- Output directory and filename patterns
- Message filtering and formatting options
- Schedule configuration for automated syncing
- Multi-source configuration support

## CLI Integration

The plugin provides full access to CLI functionality:

```bash
# These CLI commands are available through the plugin interface:
obsidian-message-sync sync --channel general
obsidian-message-sync auth --test
obsidian-message-sync config --get output.directory
obsidian-message-sync status --detailed
```

## Architecture

The plugin follows a clean architecture pattern:

- **Service Layer**: Handles all business logic and CLI integration
- **UI Layer**: Provides user interface components
- **Configuration Layer**: Manages settings and validation
- **Type Layer**: Ensures type safety throughout the application

## Error Handling

The plugin includes comprehensive error handling:

- Authentication failures
- Network connectivity issues
- Configuration validation errors
- File system permissions

## Development

To extend the plugin:

1. All CLI functionality is available through the service layer
2. New UI components can be added to the settings tab or view
3. Configuration options can be extended through the types system
4. Error handling follows the established patterns

## Support

For issues or questions:

- Check the CLI documentation in the parent project
- Review the plugin's error messages and logs
- Consult the integration guide for troubleshooting
