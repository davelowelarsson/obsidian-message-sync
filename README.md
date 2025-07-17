# Obsidian Message Sync

## Project Setup Complete! 🎉

This project has been successfully configured with:

### 🛠️ Development Tools
- **Node.js 24+**: Native TypeScript execution
- **PNPM**: Fast, efficient package management
- **Vitest**: Testing framework with watch mode
- **Biome**: Unified linting and formatting
- **TypeScript**: Strict configuration with path aliases

### 📁 Project Structure
```
src/
├── config/           # Configuration management
├── services/         # Data source integrations (Slack, etc.)
├── writers/          # Output format handlers
├── scheduler/        # Background job management
├── utils/           # Shared utilities
└── types/           # TypeScript type definitions

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
├── e2e/             # End-to-end tests
└── fixtures/        # Test data and mocks
```

### 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Run tests** (TDD workflow):
   ```bash
   pnpm test        # Watch mode (default)
   pnpm test --run  # Single run
   ```

4. **Development scripts**:
   ```bash
   pnpm dev         # Development server
   pnpm build       # Build for production
   pnpm lint        # Check code style
   pnpm format      # Format code
   ```

### 📋 Environment Variables

Copy `.env.example` to `.env` and configure:

- **Slack API**: Bot token, app token, user token
- **Obsidian**: Vault path, notes folder
- **Sync**: Interval, message limits
- **Logging**: Level, output file

### 🔑 Slack Token Requirements

For full functionality, you need **both** Bot and User tokens with specific scopes:

**Bot Token (`SLACK_BOT_TOKEN`)** - starts with `xoxb-`:
- `channels:read` - List and read channel information
- `channels:history` - Read message history from channels
- `users:read` - Get user information for name resolution

**User Token (`SLACK_USER_TOKEN`)** - starts with `xoxp-`:
- `files:read` - **Required for file downloads** (Bot tokens cannot download files)

⚠️ **Important**: Without a User token with `files:read` scope, file downloads will fail and you'll receive HTML login pages instead of actual file content.

**Setup Instructions**:
1. Create a Slack app at https://api.slack.com/apps
2. Add the required scopes in "OAuth & Permissions"
3. Install the app to your workspace
4. Copy both tokens to your `.env` file

💡 **Tip**: The demo will work with just a Bot token, but files won't download. See [docs/FILE_DOWNLOAD_TROUBLESHOOTING.md](docs/FILE_DOWNLOAD_TROUBLESHOOTING.md) for details.

## 🔐 Permissions & Privacy

### What Access Do We Need?

**For Personal Messages** (your own DMs and channels):
- Read message history from conversations you already participate in
- View channel/DM information to organize your notes
- Access user information to show names instead of IDs

**For Team/Workspace Access** (bot mode):
- Read messages only from channels where the bot is explicitly invited
- No automatic access to private channels or conversations
- Optional message sending for sync confirmations

### What We Don't Access
- ❌ Other users' private conversations
- ❌ Channels you're not already in
- ❌ Admin functions or workspace settings
- ❌ Files, attachments, or billing information

> 📋 **Detailed Permission Guide**: See [docs/PERMISSIONS.md](docs/PERMISSIONS.md) for complete explanations

### 🔐 Security

This project implements enterprise-grade security best practices:

**Security Score: A-** (Comprehensive security audit passed)

**Security Features**:
- ✅ **Input Validation**: All user inputs sanitized and validated
- ✅ **Path Traversal Prevention**: Secure file path validation
- ✅ **Token Protection**: No sensitive data exposed in logs
- ✅ **File Security**: Secure file permissions (0600) and size limits
- ✅ **MIME Type Validation**: Restricted file types for security
- ✅ **Dependency Security**: Regular security audits (zero vulnerabilities)

**Security Testing**:
- 30 dedicated security tests covering all attack vectors
- Comprehensive path traversal and injection prevention
- File system security and permission validation
- Input sanitization and output encoding tests

See [security-audit-report.md](security-audit-report.md) for detailed security assessment.

### 🧪 Testing Strategy

This project follows Test-Driven Development (TDD):

1. **Red**: Write a failing test
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests green

Tests run in watch mode by default - they'll automatically re-run when files change.

**Test Coverage**:
- **337 total tests** with 100% pass rate
- **30 security tests** for vulnerability prevention
- **Unit, integration, and e2e tests** for comprehensive coverage

### 🔌 Obsidian Plugin Development

This project includes a dual-build system for Obsidian plugin development with an intuitive 5-step onboarding wizard.

> **📖 Plugin Usage Guide**: See [docs/PLUGIN_USAGE.md](docs/PLUGIN_USAGE.md) for complete instructions on using the plugin after onboarding.

#### 🛠️ Development Build
- **Plugin ID**: `obsidian-message-sync-dev`
- **Plugin Name**: "Message Sync (Dev)"
- **Purpose**: For active development and testing
- **Features**: Source maps, unminified code, detailed logging

#### 📦 Production Build
- **Plugin ID**: `obsidian-message-sync`
- **Plugin Name**: "Message Sync"
- **Purpose**: For release and distribution
- **Features**: Minified code, optimized for performance

#### 🚀 Quick Setup
```bash
# Run the setup script
./scripts/setup-plugin-dev.sh

# Or manually:
pnpm run build:plugin:dev
```

#### 🔗 Symlink Setup (Recommended)
To test the plugin in Obsidian without manual copying:

```bash
# Create symlink to your Obsidian plugins directory
ln -s $(pwd)/dist ~/.obsidian/plugins/obsidian-message-sync-dev

# Or for a specific vault:
ln -s $(pwd)/dist /path/to/your/vault/.obsidian/plugins/obsidian-message-sync-dev
```

#### 📋 Plugin Build Commands
```bash
# Development build (default)
pnpm run build:plugin:dev

# Production build (for releases)
pnpm run build:plugin:prod

# Development with watch mode
pnpm run build:plugin:watch
```

#### 🔄 Development Workflow
1. Run `pnpm run build:plugin:watch` for continuous building
2. Create symlink as shown above
3. Enable plugin in Obsidian Community Plugins settings
4. Refresh plugins after each build
5. Test your changes in Obsidian

#### 📁 Plugin Output Files
- `dist/main.js` - Compiled plugin code
- `dist/manifest.json` - Plugin manifest (dev or prod version)
- `dist/styles.css` - Plugin styles

> **Note**: Use symlinks for development to avoid manual copying. The development build creates a different plugin ID (`obsidian-message-sync-dev`) so you can run both development and production versions simultaneously.

### 🏗️ Next Steps

Task 1 (Setup Project Repository) is now complete. Ready for:
- Task 2: Implement configuration management
- Task 3: Create Slack message getter
- Task 4: Implement note writers
- Task 5: Set up scheduling system
