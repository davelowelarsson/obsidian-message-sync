# Quick Start Guide for Obsidian Message Sync

This guide will help you get started with Obsidian Message Sync in just a few minutes.

## Prerequisites

1. **Node.js 24+** installed on your system
2. **Obsidian** with a vault set up
3. **Slack workspace** with appropriate permissions

## Step 1: Installation

```bash
# Clone the repository
git clone https://github.com/your-org/obsidian-message-sync.git
cd obsidian-message-sync

# Install dependencies
pnpm install

# Build the CLI
pnpm build
```

## Step 2: Initial Setup

```bash
# Initialize the project
./dist/cli.js init

# Generate a configuration file
./dist/cli.js config --generate
```

## Step 3: Configure Your Vault

```bash
# Set your Obsidian vault path
./dist/cli.js config --set global.obsidian.vaultPath --value "/path/to/your/vault"

# Set the notes folder (optional)
./dist/cli.js config --set global.obsidian.notesFolder --value "Daily Notes"
```

## Step 4: Set Up Slack Authentication

### Option A: Using Environment Variables

Create a `.env` file in the project root:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here
```

### Option B: Using CLI Commands

```bash
# Set tokens directly
./dist/cli.js auth --token xoxb-your-bot-token-here
```

## Step 5: Configure Your First Channel

```bash
# Add a Slack channel to sync
./dist/cli.js config --set sources.slack.0.channelId --value "C1234567890"
./dist/cli.js config --set sources.slack.0.name --value "general"
./dist/cli.js config --set sources.slack.0.enabled --value true
```

## Step 6: Test Your Setup

```bash
# Test authentication
./dist/cli.js auth --test

# Validate configuration
./dist/cli.js config --validate

# Check status
./dist/cli.js status --detailed
```

## Step 7: First Sync

```bash
# Do a dry run first to see what would happen
./dist/cli.js sync --dry-run --verbose

# If everything looks good, do the actual sync
./dist/cli.js sync --channel "general" --since "yesterday"
```

## Step 8: Set Up Automation (Optional)

```bash
# Add a daily sync schedule
./dist/cli.js schedule --add "0 8 * * *"

# Start the background service
./dist/cli.js service --start
```

## Verification

After completing these steps, you should have:

1. ✅ A working configuration file
2. ✅ Slack authentication configured
3. ✅ At least one channel configured for sync
4. ✅ Successfully synced some messages to your Obsidian vault

## Common Issues and Solutions

### Issue: "Authentication failed"
**Solution**: Check your Slack tokens and ensure they have the correct permissions:
- Bot token needs: `channels:read`, `chat:read`, `users:read`
- User token needs: `files:read` (for file downloads)

### Issue: "Channel not found"
**Solution**: Get the correct channel ID from Slack:
1. Right-click on channel name in Slack
2. Select "Copy link"
3. Extract the channel ID from the URL (the part after `/archives/`)

### Issue: "Permission denied" when writing files
**Solution**: Check that the Obsidian vault path is correct and writable:
```bash
# Verify the path exists and is writable
ls -la "$(./dist/cli.js config --get global.obsidian.vaultPath)"
```

## Next Steps

Once you have the basic setup working:

1. **Configure additional channels** using the config command
2. **Set up schedules** for automated syncing
3. **Customize output templates** using template variables
4. **Explore advanced features** like file downloads and custom organization

## Getting Help

- Use `./dist/cli.js --help` for general help
- Use `./dist/cli.js <command> --help` for command-specific help
- Check the full documentation in `docs/CLI_REFERENCE.md`
- Look at examples in the `examples/` directory

## Example Configuration

Here's a complete example configuration for reference:

```yaml
global:
  version: "1.0.0"
  obsidian:
    vaultPath: "/Users/you/Documents/Obsidian/MyVault"
    notesFolder: "Daily Notes"
    assetFolder: "assets"

sources:
  slack:
    - service: slack
      name: "Team General"
      channelId: "C1234567890"
      token: "SLACK_BOT_TOKEN"
      output: "{{date}}.md"
      schedule: "0 8 * * *"
      enabled: true
```

This configuration will:
- Sync messages from the "Team General" channel
- Save them as daily notes (e.g., `2024-01-15.md`)
- Run automatically every day at 8 AM
- Store files in your Obsidian vault's "Daily Notes" folder
