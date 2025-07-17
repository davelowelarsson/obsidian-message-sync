# File Download Guide

## ✅ File Downloads Working

As of the latest update, file downloads are working correctly when you have the proper token configuration.

## 🔑 Token Requirements

For file downloads to work, you need a **User token** with the `files:read` scope:

```bash
# In your .env file
SLACK_USER_TOKEN=xoxp-your-user-token-here  # Required for file downloads
SLACK_BOT_TOKEN=xoxb-your-bot-token-here    # Still needed for other operations
```

## ✅ Success Example

When properly configured, you'll see output like this:

```
📥 Downloading Skärmavbild 2025-06-30 kl. 15.24.50.png (F093QBYHPAQ)
   🔑 Using: User Token (xoxp-3118687...)
   📋 File info: size=633710, mimetype=image/png
   🔗 URLs available: url_private=true, url_private_download=true
   Trying url_private_download: https://files.slack.com/...
   ✅ Success with url_private_download
✅ Successfully downloaded Skärmavbild 2025-06-30 kl. 15.24.50.png (619 KB)
```

## 🚨 Troubleshooting

### Problem: HTML Instead of Files

**Symptoms:**
- Downloaded PNG files containing HTML login pages
- Error messages about "authentication required"
- Files with correct extensions but wrong content type

**Root Cause:**
Slack's file URLs (`url_private` and `url_private_download`) are designed for browser authentication. Bot tokens have limited file access permissions and often receive HTML login pages instead of actual file content.

**Solution:**
Use a User token with `files:read` scope (see Token Requirements above).

## 🔧 Setup Instructions

1. **Create a Slack app** at <https://api.slack.com/apps>
2. **Add the required scopes** in "OAuth & Permissions":

   **Bot Token Scopes:**
   - `channels:read` - Read channel information
   - `channels:history` - Read message history
   - `users:read` - Read user information

   **User Token Scopes:**
   - `files:read` - Download file content (this is the critical one)

3. **Install the app** to your workspace
4. **Copy both tokens** to your `.env` file

## 🧪 Testing File Downloads

To test if file downloads work:

1. Enable file downloads in your config:

   ```typescript
   const options: WriterOptions = {
     downloadFiles: true,
     assetsDir: 'assets'
   };
   ```

2. Run the demo with a channel that contains files:

   ```bash
   pnpm run demo
   ```

3. Check the console output for download status messages

## 📁 File Organization

Downloaded files are organized as follows:

- **Assets location**: `{outputDir}/assets/filename.ext`
- **Default path**: `./output/assets/filename.ext`
- **Markdown links**: Automatically calculated relative paths based on organization:
  - **Daily** (`2025/06/`): `../../assets/filename.ext`
  - **Monthly** (`2025/`): `../assets/filename.ext`
  - **Yearly** (root): `assets/filename.ext`

The system automatically calculates the correct relative paths so that images render properly in Obsidian and other markdown viewers.

## 🔒 Security Note

User tokens have broader permissions than bot tokens. Always:

- Store tokens securely in environment variables
- Use minimal required scopes
- Regularly rotate tokens
- Never commit tokens to version control

## 🆘 Still Having Issues?

If file downloads still don't work:

1. **Check your token type**: `xoxp-` (User) vs `xoxb-` (Bot)
2. **Verify scopes**: Ensure `files:read` is granted to your User token
3. **Check console output**: Look for detailed error messages
4. **Test token validity**: Use Slack's API tester

**Common Error Messages:**

- `"Received HTML instead of file content"` → Need User token with files:read
- `"HTTP 403: Forbidden"` → Token lacks permissions
- `"HTTP 401: Unauthorized"` → Invalid or expired token
- `"Cannot download: No Slack token provided"` → Token not configured
