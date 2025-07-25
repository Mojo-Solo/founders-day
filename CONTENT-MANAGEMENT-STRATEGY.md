# Content Management Strategy - Founders Day

## Overview

This document outlines the content management strategy for the Founders Day Minnesota event website. All content is now centrally managed through the CMS backend and dynamically loaded in the frontend.

## Key Changes Implemented

### 1. **Removed Hardcoded Prices**
- ✅ Registration page: Event ticket ($25), Banquet ($60), Hotel ($126)
- ✅ Banquet page: Dynamic pricing from CMS
- ✅ Home page: Event ticket price now from CMS

### 2. **Standardized Event Information**
- ✅ Event Date: **Saturday, November 29, 2025** (consistent across all pages)
- ✅ Event Time: **8:30 AM - 12:00 AM** (midnight)
- ✅ Venue: **DoubleTree by Hilton, Bloomington**
- ✅ Address: **7800 Normandale Blvd, Bloomington, MN 55439**

### 3. **CMS Content Keys**

The following content keys are now available in the CMS:

| Key | Content | Category | Used By |
|-----|---------|----------|---------|
| `hero-title` | Founders Day Minnesota 2025 | home | Home page |
| `hero-subtitle` | Celebrating Recovery, Unity, and Service | home | Home page |
| `hero-date` | Saturday, November 29, 2025 | home | Home page |
| `hero-time` | 8:30 AM - 12:00 AM | home | Home page |
| `hero-location` | DoubleTree by Hilton, Bloomington | home | Home page |
| `venue-name` | DoubleTree by Hilton | home | Multiple pages |
| `venue-address` | 7800 Normandale Blvd, Bloomington, MN 55439 | home | Multiple pages |
| `event-date` | Saturday, November 29, 2025 | registration | Registration, About |
| `event-time` | 8:30 AM - 12:00 AM | registration | Registration, About |
| `registration-pricing` | JSON with event, banquet, hotel prices | registration | All registration pages |

### 4. **Pricing Structure**

The `registration-pricing` key contains a JSON object:
```json
{
  "event": { "price": 25, "description": "Full day event access" },
  "banquet": { "price": 60, "description": "Evening banquet dinner" },
  "hotel": { "price": 126, "description": "Special group rate at DoubleTree by Hilton" }
}
```

## Implementation Pattern

### Frontend Integration

All pages now follow this pattern for CMS content:

```typescript
// 1. Import CMS functions
import { getPublishedContent, type ContentItem } from "@/lib/api/content"

// 2. Set up state
const [dynamicContent, setDynamicContent] = useState<ContentItem[]>([])
const [isLoading, setIsLoading] = useState(true)

// 3. Define fallback content
const defaultContent = {
  'key-name': 'fallback value'
}

// 4. Helper function for content retrieval
const getContentByKey = (key: string, defaultValue: string = '') => {
  const item = dynamicContent.find(c => c.key === key)
  return item?.content || defaultValue
}

// 5. Fetch content on mount
useEffect(() => {
  const fetchContent = async () => {
    try {
      const data = await getPublishedContent('category')
      setDynamicContent(data || [])
    } catch (error) {
      console.error('Failed to fetch content:', error)
    } finally {
      setIsLoading(false)
    }
  }
  fetchContent()
}, [])
```

### Pricing Integration

For pricing data specifically:

```typescript
const getPricing = () => {
  const pricingItem = dynamicContent.find(c => c.key === 'registration-pricing')
  if (pricingItem && pricingItem.content) {
    try {
      const parsed = JSON.parse(pricingItem.content)
      return {
        event: parsed.event?.price || defaultPricing.event,
        banquet: parsed.banquet?.price || defaultPricing.banquet,
        hotel: parsed.hotel?.price || defaultPricing.hotel
      }
    } catch (e) {
      console.error('Failed to parse pricing data:', e)
    }
  }
  return defaultPricing
}
```

## Benefits

1. **Single Source of Truth**: All content managed in one place
2. **No Code Changes Required**: Update prices, dates, venues without deploying
3. **Graceful Fallbacks**: Site works even if CMS is unavailable
4. **Consistent Information**: No more conflicting dates or prices
5. **Loading States**: Better UX with loading indicators

## Future Enhancements

1. Add more content keys for schedule, speakers, etc.
2. Implement content versioning
3. Add preview functionality
4. Create admin UI for easy content updates
5. Add content validation rules

## Testing the Content Flow

To test the CMS content flow:

1. Start the admin backend: `cd founders-day-admin && npm run dev`
2. Start the frontend: `cd founders-day-frontend && npm run dev`
3. Access the CMS API: `http://localhost:3001/api/public/content`
4. Verify content loads on all pages
5. Test fallback behavior by stopping the backend

---

*Last Updated: January 2025*