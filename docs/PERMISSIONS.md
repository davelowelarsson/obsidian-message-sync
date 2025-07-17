# Slack Permissions Guide

This document explains exactly what permissions the Obsidian Message Sync plugin needs and why each one is required for the plugin to function properly.

## 🔐 Why Permissions Matter

Slack uses OAuth 2.0 scopes to control what your application can access. We request only the minimum permissions needed for the plugin to sync your messages to Obsidian. **We never request permissions we don't actually use.**

## 👤 Personal Access Permissions

When you choose to sync your personal messages (DMs, private channels you're in), the app requests these permissions:

### Core Message Access
- **`channels:history`** - Read message history from public channels you're a member of
  - *Why needed*: To fetch messages from public channels for your Obsidian notes
  - *What it accesses*: Only channels where you're already a member
  
- **`groups:history`** - Read message history from private channels you're in
  - *Why needed*: To fetch messages from private channels you're invited to
  - *What it accesses*: Only private channels where you're already a member

- **`im:history`** - Read your direct message conversations
  - *Why needed*: To sync your 1-on-1 direct messages to Obsidian
  - *What it accesses*: Your personal DM conversations only

- **`mpim:history`** - Read group direct message conversations you're in
  - *Why needed*: To sync multi-person DM groups to Obsidian
  - *What it accesses*: Only group DMs you're already part of

### Channel Information
- **`channels:read`** - View basic information about public channels
  - *Why needed*: To get channel names, topics, and metadata for organizing your notes
  - *What it accesses*: Channel names, descriptions, member counts (not member lists)

- **`groups:read`** - View basic information about private channels you're in
  - *Why needed*: To get private channel names and topics for note organization
  - *What it accesses*: Names and topics of private channels you're in

- **`im:read`** - View your direct message channels
  - *Why needed*: To list and organize your DM conversations
  - *What it accesses*: List of your DM channels (not the messages themselves)

- **`mpim:read`** - View group direct message channels you're in
  - *Why needed*: To list and organize your group DM conversations
  - *What it accesses*: List of group DMs you're in (not the messages themselves)

### User Information
- **`users:read`** - View user information in your workspace
  - *Why needed*: To convert user IDs to readable names in your synced messages
  - *What it accesses*: Display names, usernames, and profile info of workspace members

### File Access
- **`files:read`** - **Required for downloading files and attachments**
  - *Why needed*: To download images, PDFs, and other files attached to messages
  - *What it accesses*: Files shared in channels/conversations you already have access to
  - *Important*: Only User tokens can download files - Bot tokens will receive HTML login pages instead

## 🤖 Team/Bot Access Permissions

When you install the app to your workspace for team-wide syncing, it requests these permissions:

### Message Access
- **`channels:history`** - Read message history from public channels
  - *Why needed*: To sync public channel messages that the bot is invited to
  - *What it accesses*: Only public channels where the bot is explicitly added

- **`groups:history`** - Read message history from private channels (if invited)
  - *Why needed*: To sync private channel messages when the bot is specifically invited
  - *What it accesses*: Only private channels where admins explicitly invite the bot

### Channel Information
- **`channels:read`** - View basic information about public channels
  - *Why needed*: To organize and categorize synced messages by channel
  - *What it accesses*: Public channel names, topics, and basic metadata

- **`groups:read`** - View basic information about private channels (if invited)
  - *Why needed*: To organize private channel messages the bot has access to
  - *What it accesses*: Names and topics of private channels the bot is invited to

### User & Communication
- **`users:read`** - View user information in the workspace
  - *Why needed*: To show readable names instead of user IDs in synced messages
  - *What it accesses*: Display names and usernames of workspace members

- **`chat:write`** - Send messages to channels the bot is in
  - *Why needed*: Optional feature for sending sync confirmations or status updates
  - *What it can do*: Send messages only to channels where the bot is explicitly added
  - *Note*: This permission is for future features and is not used in the initial version

## 🛡️ What We DON'T Access

### Your app will NEVER:
- ❌ Access channels you're not already a member of
- ❌ Access private channels unless explicitly invited
- ❌ Access other users' private messages
- ❌ Modify or delete any existing messages
- ❌ Access files or attachments (messages only)
- ❌ Access admin functions or workspace settings
- ❌ Access billing or payment information
- ❌ Send messages on your behalf (unless you use bot mode and explicitly enable it)

## 🔒 Security & Privacy

### Data Handling
- **Local Storage**: All synced messages are stored locally in your Obsidian vault
- **No Cloud Storage**: We don't store your messages on external servers
- **No Analytics**: We don't track or analyze your message content
- **No Sharing**: Your messages are never shared with third parties

### Token Security
- **Encryption**: OAuth tokens are stored securely using your system's credential storage
- **Expiration**: Tokens automatically expire and can be revoked at any time
- **Scope Limited**: Tokens only work for the specific permissions you granted

## 🚫 Revoking Access

You can revoke the app's access at any time:

1. **Via Slack**: Go to [Your Apps](https://slack.com/apps/manage) → Find "Obsidian Message Sync" → Remove
2. **Via Workspace**: Admin Settings → Manage Apps → Remove "Obsidian Message Sync"
3. **Via Plugin**: Use the built-in token revocation feature in the plugin settings

## ❓ Frequently Asked Questions

### Q: Why do you need so many permissions?
A: Each permission serves a specific purpose. We separate them so you understand exactly what we access. We could request broader permissions, but we believe in transparency.

### Q: Can you access messages from before I installed the app?
A: Yes, if you grant history permissions. This is necessary to sync your existing important conversations. You can limit the sync to recent messages if preferred.

### Q: What happens if I only grant some permissions?
A: The plugin will work with reduced functionality. For example, without `im:history`, it can't sync your DMs, but it can still sync channels.

### Q: Do permissions differ between personal and bot modes?
A: Yes. Personal mode accesses your personal conversations. Bot mode requires workspace installation and only accesses channels where the bot is explicitly invited.

### Q: Can I audit what the app actually accesses?
A: Yes! Check your Slack workspace's audit logs, and the plugin provides detailed logs of what it syncs.

---

**Need help?** Check our documentation or create an issue on GitHub. We're committed to transparency and will answer any questions about permissions or data handling.
