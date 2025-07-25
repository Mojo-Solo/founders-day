# Content Management Flow

## How Content Flows from CMS to Website

```
┌─────────────────────────┐
│   CLIENT EDITS HERE     │
│                         │
│   Admin CMS Panel       │
│   localhost:3001        │
│                         │
│   • Edit prices         │
│   • Update schedule     │
│   • Change text         │
│   • Modify dates        │
│   • Upload images       │
└───────────┬─────────────┘
            │
            │ Click "Publish"
            ▼
┌─────────────────────────┐
│   Content Database      │
│   (Supabase/Neon)       │
│                         │
│   Stores all content    │
│   with versions         │
└───────────┬─────────────┘
            │
            │ API Request
            ▼
┌─────────────────────────┐
│   Public Frontend       │
│   localhost:3000        │
│                         │
│   Fetches content       │
│   Falls back if needed  │
└─────────────────────────┘
            │
            │ Displays to
            ▼
┌─────────────────────────┐
│   Website Visitors      │
│                         │
│   See updated:          │
│   • Prices              │
│   • Schedule            │
│   • Event details       │
│   • All content         │
└─────────────────────────┘
```

## Content Priority System

1. **CMS Content** (if available)
   - Latest published version from admin panel
   - Real-time updates

2. **Fallback Content** (if CMS unavailable)
   - Hardcoded in frontend
   - Ensures site never breaks

3. **Default Values** (last resort)
   - Basic placeholder text
   - Prevents empty sections

## Example: Updating Ticket Price

```
Admin Panel                    Frontend Code
-----------                    -------------
┌─────────────────┐           getContent('early-bird-price')
│ Edit Price      │                    ↓
│                 │           Try CMS API first
│ $25 → $35      │                    ↓
│                 │           If success: Show $35
│ [Publish]       │           If fail: Show hardcoded $25
└─────────────────┘                    ↓
                              Display on website
```

## Content Categories

### Home Page Content
- `hero-title`: Main heading
- `hero-subtitle`: Subheading
- `hero-date`: Event date
- `hero-time`: Event time
- `hero-location`: Venue name

### Pricing Content
- `early-bird-price`: Early registration
- `door-price`: Day-of price
- `banquet-price`: Dinner ticket
- `hotel-price`: Room rate

### Schedule Content
- `schedule-9am`: Morning session
- `schedule-10am`: Mid-morning
- `schedule-noon`: Lunch time
- etc.

### About Content
- `about-description`: Main about text
- `about-history`: Event history
- `about-mission`: Mission statement

## Content Types Explained

### Text Content
```
Simple plain text
No formatting
Good for: prices, dates, names
```

### HTML Content
```html
<h2>Welcome</h2>
<p>This is <strong>formatted</strong> content</p>
<ul>
  <li>With lists</li>
  <li>And more</li>
</ul>
Good for: rich descriptions, formatted text
```

### Markdown Content
```markdown
## Welcome
This is **formatted** content
- With lists
- And more

Good for: technical users, easy formatting
```

### JSON Content
```json
{
  "sessions": [
    {
      "time": "9:00 AM",
      "title": "Opening Session",
      "speaker": "John Doe"
    }
  ]
}
Good for: structured data, schedules
```

## Security & Permissions

- Only authenticated admins can edit
- All changes are logged
- Version history preserved
- Automatic backups
- Published content is public
- Draft content is hidden