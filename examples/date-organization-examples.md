# Date Organization Examples

The enhanced message sync service now organizes messages by their actual content dates rather than sync dates. This provides much more meaningful organization of your message history.

## Template Granularity Examples

### Daily Organization (Default)
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      channels: ["general", "random"]
      output: "sync/slack/{{channel}}/{{date}}.md"
```

**Result**: One markdown file per day, organized by when messages were actually sent.
- `sync/slack/general/2025-07-15.md`
- `sync/slack/general/2025-07-16.md`
- `sync/slack/random/2025-07-15.md`

### Monthly Organization
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      channels: ["general", "random"]
      output: "sync/slack/{{channel}}/{{month}}.md"
```

**Result**: One markdown file per month, containing all messages from that month.
- `sync/slack/general/2025-07.md`
- `sync/slack/general/2025-06.md`
- `sync/slack/random/2025-07.md`

### Yearly Organization
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      channels: ["general", "random"]
      output: "sync/slack/{{channel}}/{{year}}.md"
```

**Result**: One markdown file per year, containing all messages from that year.
- `sync/slack/general/2025.md`
- `sync/slack/general/2024.md`
- `sync/slack/random/2025.md`

### Weekly Organization
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      channels: ["general", "random"]
      output: "sync/slack/{{channel}}/{{week}}.md"
```

**Result**: One markdown file per ISO week, containing all messages from that week.
- `sync/slack/general/2025-W29.md`
- `sync/slack/general/2025-W28.md`
- `sync/slack/random/2025-W29.md`

## How It Works

1. **Message Grouping**: Messages are grouped by their actual timestamp (when they were sent) rather than when they were synced.

2. **Template Analysis**: The system analyzes your output template to determine the finest granularity:
   - `{{date}}` → Daily files
   - `{{week}}` → Weekly files
   - `{{month}}` → Monthly files
   - `{{year}}` → Yearly files

3. **Content Merging**: If a file already exists (from a previous sync), new messages are merged with existing content.

4. **Chronological Order**: Within each file, messages are sorted chronologically by their original timestamp.

## Benefits

- **Content-Focused**: Organization reflects when conversations actually happened
- **Consistent History**: Re-syncing doesn't create duplicate files with sync dates
- **Flexible Granularity**: Choose the organization level that works best for your workflow
- **Incremental Updates**: New messages are properly merged with existing content

## Migration Note

If you have existing files organized by sync date, you may want to:
1. Back up your current sync directory
2. Delete existing files
3. Re-sync with the new system to get properly organized files

The new system will create a cleaner, more logical organization of your message history.
