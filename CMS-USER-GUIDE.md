# Founders Day CMS User Guide

## Quick Start

To edit any content on the website:

1. **Start the System**: Run `./start-both.sh` from the terminal
2. **Open Admin Panel**: Go to http://localhost:3001
3. **Navigate to Content**: Click "Content Management" in the sidebar
4. **Edit & Publish**: Make changes and click "Publish"
5. **See Changes**: View updates instantly at http://localhost:3000

## What You Can Edit

### 🎫 Event Pricing
- Early Bird Price: $25
- Door Price: $30  
- Banquet Price: $60
- Hotel Price: $126

**How to edit**: 
1. Go to Content Management
2. Search for "pricing" 
3. Edit the values
4. Click "Publish"

### 📅 Event Details
- Event Name: "Founders Day Minnesota 2025"
- Date: "November 29, 2025"
- Time: "8:30 AM - 12:00 AM"
- Venue: "DoubleTree by Hilton"
- Address: "7800 Normandale Blvd, Bloomington, MN 55439"

**How to edit**:
1. Go to Content Management
2. Look for items with category "home" or "event"
3. Edit the content
4. Click "Publish"

### 📋 Schedule
Edit all session times, speakers, and room assignments

**How to edit**:
1. Go to Content Management
2. Filter by category "schedule"
3. Edit each time slot
4. Click "Publish"

### 📝 Page Content
- Hero section text
- About page content
- Why Attend section
- Special Features
- Footer information

**How to edit**:
1. Find the content by its category (home, about, etc.)
2. Edit using the rich text editor
3. Preview before publishing
4. Click "Publish"

## Content Management Features

### Content Types
- **Text**: Simple text content
- **HTML**: Rich formatted content
- **Markdown**: Developer-friendly formatting
- **JSON**: Structured data (for schedules, pricing)

### Content States
- **Draft**: Saved but not visible on website
- **Published**: Live on the website
- **Archived**: Hidden but kept for history

### Version Control
- Every change is saved as a new version
- View history: Click "Version History"
- Restore old version: Click "Restore" on any past version

## Step-by-Step Examples

### Example 1: Change Event Ticket Price
1. Start the system: `./start-both.sh`
2. Go to http://localhost:3001/content
3. Search for "pricing" or filter by category "registration"
4. Find "early-bird-price" content item
5. Click "Edit"
6. Change from "$25" to "$35"
7. Click "Save as Draft" to preview
8. Click "Publish" to make live
9. Check http://localhost:3000 - price is updated!

### Example 2: Update Schedule
1. Go to Content Management
2. Filter by category "schedule"
3. Find the time slot you want to edit
4. Click "Edit"
5. Update speaker name, topic, or room
6. Click "Publish"
7. Schedule on website updates immediately

### Example 3: Edit Hero Banner Text
1. Go to Content Management
2. Look for "hero-title" or "hero-subtitle"
3. Click "Edit"
4. Change text
5. Use Preview to see how it looks
6. Click "Publish" when happy

## Important Notes

### Always Preview First
- Use the "Preview" button before publishing
- Check how content looks on different screen sizes
- Ensure formatting is correct

### Content Keys
Each piece of content has a "key" - don't change these!
- `hero-title` → Main heading on homepage
- `early-bird-price` → Early registration price
- `venue-name` → Event location name
- etc.

### Rich Text Editor
- **Bold**: Select text and click B
- **Links**: Select text and click link icon
- **Lists**: Use bullet or number buttons
- **Headings**: Use dropdown for H1, H2, etc.

## Troubleshooting

### Changes Not Appearing?
1. Make sure you clicked "Publish" (not just "Save as Draft")
2. Refresh the frontend page (Ctrl+R or Cmd+R)
3. Check that both services are running (admin and frontend)

### Can't Find Content?
1. Use the search bar
2. Try different category filters
3. Look for content by its key name

### Lost Your Changes?
1. Go to "Version History"
2. Find your previous version
3. Click "Restore"

## Pro Tips

1. **Bulk Updates**: Select multiple items and update together
2. **Quick Search**: Type "/" to focus search box
3. **Keyboard Shortcuts**: 
   - Ctrl+S (Cmd+S) = Save draft
   - Ctrl+P (Cmd+P) = Publish
   - Esc = Cancel editing

4. **Mobile Preview**: Use device toggle in preview mode

## Support

If you need help:
1. Check this guide first
2. All changes are reversible via Version History
3. The system has automatic backups
4. Original content is always preserved as fallback