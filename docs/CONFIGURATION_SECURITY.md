# Configuration Security Guide

## 🔒 Secure Configuration Setup

This project uses a secure configuration approach to protect sensitive data like API tokens.

### Quick Setup

1. **Copy the template:**
   ```bash
   cp config.example.yaml config.yaml
   ```

2. **Update your config.yaml:**
   - Set your Obsidian vault path
   - Add your Slack channel IDs
   - Use environment variable references for tokens (recommended)

3. **Set environment variables:**
   ```bash
   # Add to your .env file (also git-ignored)
   SLACK_USER_TOKEN=xoxp-your-user-token-here
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   ```

### Security Features

✅ **config.yaml is git-ignored** - Your real configuration never gets committed
✅ **Environment variable support** - Tokens are referenced, not hardcoded  
✅ **Template-based** - Easy to share safe examples
✅ **Multiple token types** - Support for both user and bot tokens

### Configuration Options

#### Token Reference Methods

**Recommended (Environment Variables):**
```yaml
token: "SLACK_USER_TOKEN"  # References process.env.SLACK_USER_TOKEN
```

**Direct (Not recommended for commits):**
```yaml
token: "xoxp-actual-token-here"  # Only use in local config.yaml
```

### Example Environment Variables

Create a `.env` file in the project root:

```bash
# Slack Tokens
SLACK_USER_TOKEN=xoxp-your-personal-slack-token
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Obsidian Settings
OBSIDIAN_VAULT_PATH=/path/to/your/vault
```

### File Security Status

| File | Git Status | Purpose |
|------|-----------|---------|
| `config.example.yaml` | ✅ Committed | Safe template with placeholders |
| `config.yaml` | ❌ Ignored | Your real config with actual values |
| `.env` | ❌ Ignored | Environment variables with tokens |
| `.env.test` | ✅ Committed | Test environment with safe defaults |

### Getting Your Slack Tokens

Use the built-in auth helper:

```bash
npm run setup-slack
```

This will guide you through the OAuth flow and help you get the right tokens securely.
