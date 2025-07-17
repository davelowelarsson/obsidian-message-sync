# Obsidian Message Sync Plugin Usage Guide

## 🚀 After Onboarding

After completing the onboarding wizard, you'll see the advanced interface with several options:

### ⚡ Quick Actions

1. **🔄 Sync Now**: Tests your configuration and shows mock sync results
   - Validates your Slack token is configured
   - Shows available channels (mock data)
   - Provides guidance for actual CLI sync

2. **📄 Generate CLI Config**: Creates a `config.yaml` file for CLI usage
   - Generates a proper YAML configuration
   - Includes your Slack token and settings
   - Enables real message syncing via CLI

3. **🔍 Validate Config**: Checks if your configuration is valid
4. **📊 View Status**: Shows current configuration status
5. **🔧 Reconfigure**: Restarts the onboarding process

### 💻 Using the CLI for Real Sync

The plugin UI provides a mock experience. For actual message syncing:

1. **Generate CLI Config**: Click the "📄 Generate CLI Config" button
2. **Update Vault Path**: Edit the `config.yaml` file to set your correct vault path
3. **Run CLI Commands**:

   ```bash
   # Sync from a specific channel
   npx obsidian-sync sync --channel general
   
   # List available channels
   npx obsidian-sync channels list
   
   # Validate configuration
   npx obsidian-sync config validate
   ```

### 📁 Output Structure

Messages will be saved to your configured output folder:

```text
sync/
├── slack/
│   ├── 2025/
│   │   ├── 01-general.md
│   │   ├── 01-random.md
│   │   └── ...
│   └── assets/
└── ...
```

### 🔧 Configuration

The plugin creates and manages:

- **Plugin Settings**: Stored in Obsidian's settings
- **CLI Config**: Generated `config.yaml` file for CLI usage
- **Tokens**: Your Slack bot/user tokens are saved securely

### 📝 Token Types

- **Bot Token** (`xoxb-`): Recommended for automated operations
- **User Token** (`xoxp-`): Required for certain advanced features
- **Either or Both**: The plugin accepts either token type

### 🔄 Workflow

1. **Onboarding**: Complete the 5-step wizard
2. **Generate Config**: Create CLI configuration file
3. **CLI Sync**: Use CLI commands for actual message syncing
4. **Review**: Check synced messages in your vault

### 🛠️ Troubleshooting

- **No Sync Button**: Complete onboarding first
- **Config Errors**: Use "🔍 Validate Config" to check issues
- **No Channels**: Verify your Slack token has proper permissions
- **Sync Fails**: The plugin shows mock data - use CLI for real sync

### 📋 Required Slack Permissions

For your Slack app, ensure these scopes are enabled:

- `channels:read`
- `channels:history`
- `users:read`
- `groups:read` (for private channels)
- `im:read` (for direct messages)
