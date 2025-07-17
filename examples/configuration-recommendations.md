# Updated Configuration Examples

Here are some suggested configuration updates to get better organization:

## Option 1: Monthly Organization (Recommended)
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      token: "your-token-here"
      channels: ["D19HLGAFL", "devsecops", "#rekrytering-fullstack-med-devops-kunskaper-2025"]
      output: "sync/slack/{{channel}}/{{month}}.md"
      schedule: "manual"
      enabled: true
```

**Result**: One file per month per channel
- `sync/slack/devsecops/2025-07.md` (contains all July messages)
- `sync/slack/devsecops/2025-06.md` (contains all June messages)

## Option 2: Weekly Organization  
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      token: "your-token-here"
      channels: ["D19HLGAFL", "devsecops", "#rekrytering-fullstack-med-devops-kunskaper-2025"]
      output: "sync/slack/{{channel}}/{{week}}.md"
      schedule: "manual"
      enabled: true
```

**Result**: One file per week per channel
- `sync/slack/devsecops/2025-W29.md` (contains all Week 29 messages)
- `sync/slack/devsecops/2025-W28.md` (contains all Week 28 messages)

## Option 3: Yearly Organization (For Long-term Archive)
```yaml
sources:
  slack:
    - service: slack
      name: "primary-slack"
      token: "your-token-here"
      channels: ["D19HLGAFL", "devsecops", "#rekrytering-fullstack-med-devops-kunskaper-2025"]
      output: "sync/slack/{{channel}}/{{year}}.md"
      schedule: "manual"
      enabled: true
```

**Result**: One file per year per channel
- `sync/slack/devsecops/2025.md` (contains all 2025 messages)
- `sync/slack/devsecops/2024.md` (contains all 2024 messages)

## Current vs New Behavior

**Before (sync date based):**
- All messages from any time period would go into `2025-07-16.md` (today's date)
- Re-syncing would create new files each time
- Organization reflected when you synced, not when conversations happened

**After (content date based):**
- Messages go into files based on when they were actually sent
- July messages go into `2025-07.md` (if using monthly)
- June messages go into `2025-06.md` (if using monthly)
- Organization reflects actual conversation timeline

## Recommendation

I'd suggest starting with **monthly organization** (`{{month}}`) as it provides a good balance:
- Not too many files (like daily would create)
- Not too few files (like yearly would create)
- Easy to find conversations from a specific time period
- Good for most chat channel activity levels
