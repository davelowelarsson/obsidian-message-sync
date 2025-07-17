# Debug Guide: Viewing Plugin Output

## 🔍 How to View Plugin Console Output

### Method 1: Developer Console (Recommended)
1. Open Obsidian
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Click on the **Console** tab
4. Use the plugin - you'll see detailed logs like:
   ```
   📝 Writing config file to: config.yaml
   ✅ Config file written successfully
   🎉 Configuration created successfully!
   ```

### Method 2: Plugin Console Logs
The plugin now includes detailed console logging for debugging:

- **Configuration Creation**: See step-by-step config creation process
- **Token Validation**: Check if tokens are properly stored
- **File Operations**: Monitor config file creation and writing
- **Error Details**: Get specific error messages when things fail

### 🐛 Common Issues & Solutions

#### Issue: "Failed to create configuration"
**Look for in console:**
```
❌ Config path not set in settings
```
**Solution:** The plugin should now automatically set the config path

#### Issue: "Error creating configuration"
**Look for in console:**
```
❌ Failed to write config file: [specific error]
```
**Solution:** Check file permissions and vault path

#### Issue: Button shows "Success" but error appears
**Look for in console:**
```
❌ No Slack token provided
```
**Solution:** Make sure you entered a valid Slack token

### 🔧 What You Should See on Success

When configuration creation works properly:
```
📝 Writing config file to: config.yaml
✅ Config file written successfully
🎉 Configuration created successfully!
```

### 📱 Mobile Debugging

If you're on mobile Obsidian:
1. Use the desktop version for debugging
2. Check the `config.yaml` file manually in your vault
3. Look for error notices in the Obsidian interface

### 🛠️ Debug Steps

1. **Open Developer Console** before using the plugin
2. **Complete onboarding** with a valid Slack token
3. **Watch console output** during configuration creation
4. **Check file system** - look for `config.yaml` in your vault root
5. **Report issues** with console output included

The plugin should now provide much clearer error messages and detailed logging to help identify exactly where things go wrong.
