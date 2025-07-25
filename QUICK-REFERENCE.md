# 🚀 Founders Day Quick Reference

## Start Everything
```bash
./start-both.sh
```

## URLs
- **Edit Content**: http://localhost:3001/content
- **View Website**: http://localhost:3000

## Common Edits

### Change Prices
1. Go to Content Management
2. Search: "price"
3. Edit values ($25, $30, $60, $126)
4. Click "Publish"

### Update Schedule
1. Filter by: Category = "schedule"
2. Edit session times/speakers
3. Click "Publish"

### Edit Homepage
1. Search: "hero"
2. Edit title, subtitle, etc.
3. Click "Publish"

## Content Keys Cheat Sheet

| What You Want to Edit | Search For This Key |
|-----------------------|---------------------|
| Event Name | `hero-title` |
| Event Tagline | `hero-subtitle` |
| Event Date | `hero-date` |
| Event Time | `hero-time` |
| Venue Name | `venue-name` |
| Venue Address | `venue-address` |
| Early Bird Price | `early-bird-price` |
| Door Price | `door-price` |
| Banquet Price | `banquet-price` |
| Hotel Price | `hotel-price` |

## Quick Tips
- **Save Draft** = Preview without going live
- **Publish** = Make changes live immediately
- **Version History** = Undo any mistakes
- **Refresh** = Ctrl+R (Windows) or Cmd+R (Mac)

## Emergency Fixes
- **Can't see changes?** → Refresh the page
- **Broke something?** → Use Version History to restore
- **System won't start?** → Check if port 3001 or 3000 is in use

## Support Files
- Full guide: `CMS-USER-GUIDE.md`
- How it works: `CONTENT-FLOW.md`
- Test system: `node test-content-flow.js`