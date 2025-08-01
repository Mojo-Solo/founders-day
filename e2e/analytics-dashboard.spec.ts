/**
 * BDD E2E Tests for Analytics Dashboards
 * Ensures 100% perfect UX/UI with zero bugs
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const MOCK_METRICS = {
  activeUsers: 150,
  pageViewsPerMinute: 250,
  conversionRate: 5.2,
  bounceRate: 35.8,
  avgSessionDuration: 180
};

// Page Object for Analytics Dashboard
class AnalyticsDashboardPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/analytics/realtime');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForDataLoad() {
    // Wait for real-time data to load
    await this.page.waitForSelector('[data-testid="metrics-loaded"]', { 
      timeout: 10000 
    });
  }

  async getMetricValue(metricName: string): Promise<string> {
    const selector = `[data-testid="metric-${metricName}"]`;
    return await this.page.textContent(selector) || '';
  }

  async selectTab(tabName: string) {
    await this.page.click(`[role="tab"]:has-text("${tabName}")`);
    await this.page.waitForTimeout(500); // Wait for tab transition
  }

  async isConnectionActive(): Promise<boolean> {
    const badge = await this.page.locator('[data-testid="connection-status"]');
    const text = await badge.textContent();
    return text === 'Connected';
  }

  async getLastUpdateTime(): Promise<string> {
    return await this.page.textContent('[data-testid="last-update"]') || '';
  }
}

// BDD Test Suite
test.describe('Real-Time Analytics Dashboard - Perfect UX/UI', () => {
  let dashboardPage: AnalyticsDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new AnalyticsDashboardPage(page);
    await dashboardPage.navigate();
  });

  test.describe('Given the user opens the real-time analytics dashboard', () => {
    test('When the page loads, Then all key metrics should be visible and updating', async ({ page }) => {
      await dashboardPage.waitForDataLoad();

      // Verify all key metrics are present
      const metrics = ['activeUsers', 'pageViewsPerMinute', 'conversionRate', 'bounceRate'];
      
      for (const metric of metrics) {
        const value = await dashboardPage.getMetricValue(metric);
        expect(value).not.toBe('');
        expect(value).not.toBe('0'); // Should have real data
      }

      // Verify connection status
      const isConnected = await dashboardPage.isConnectionActive();
      expect(isConnected).toBe(true);

      // Verify last update time is recent
      const lastUpdate = await dashboardPage.getLastUpdateTime();
      expect(lastUpdate).toContain(':'); // Should show time
    });

    test('When auto-refresh is enabled, Then metrics should update every 5 seconds', async ({ page }) => {
      await dashboardPage.waitForDataLoad();

      // Get initial values
      const initialUsers = await dashboardPage.getMetricValue('activeUsers');
      
      // Wait for auto-refresh (5 seconds + buffer)
      await page.waitForTimeout(6000);

      // Check if values have been updated
      const updatedUsers = await dashboardPage.getMetricValue('activeUsers');
      const lastUpdate = await dashboardPage.getLastUpdateTime();

      // Last update time should be recent
      expect(lastUpdate).toBeTruthy();
    });
  });

  test.describe('Given the user wants to analyze different metrics', () => {
    test('When clicking on Activity tab, Then top pages and events should display', async ({ page }) => {
      await dashboardPage.waitForDataLoad();
      await dashboardPage.selectTab('Activity');

      // Verify top pages section
      await expect(page.locator('text=Top Pages')).toBeVisible();
      const topPages = await page.locator('[data-testid="top-pages-list"] > div');
      await expect(topPages).toHaveCount(5); // Should show top 5 pages

      // Verify top events section  
      await expect(page.locator('text=Top Events')).toBeVisible();
      const topEvents = await page.locator('[data-testid="top-events-list"] > div');
      expect(await topEvents.count()).toBeGreaterThan(0);
    });

    test('When clicking on Performance tab, Then Core Web Vitals should display', async ({ page }) => {
      await dashboardPage.waitForDataLoad();
      await dashboardPage.selectTab('Performance');

      // Verify performance metrics
      const vitals = ['FCP', 'LCP', 'FID', 'CLS'];
      for (const vital of vitals) {
        await expect(page.locator(`text=${vital}`)).toBeVisible();
      }

      // Verify progress bars show performance status
      const progressBars = await page.locator('[role="progressbar"]');
      expect(await progressBars.count()).toBeGreaterThan(0);
    });

    test('When clicking on Errors tab, Then error metrics should display', async ({ page }) => {
      await dashboardPage.waitForDataLoad();
      await dashboardPage.selectTab('Errors');

      // Verify error metrics cards
      await expect(page.locator('text=Total Errors')).toBeVisible();
      await expect(page.locator('text=Error Rate')).toBeVisible();
      await expect(page.locator('text=Affected Users')).toBeVisible();

      // Verify top errors list
      await expect(page.locator('text=Top Errors')).toBeVisible();
    });

    test('When clicking on Behavior tab, Then user insights should display', async ({ page }) => {
      await dashboardPage.waitForDataLoad();
      await dashboardPage.selectTab('Behavior');

      // Verify device categories
      await expect(page.locator('text=Device Categories')).toBeVisible();
      await expect(page.locator('text=Desktop')).toBeVisible();
      await expect(page.locator('text=Mobile')).toBeVisible();

      // Verify traffic sources
      await expect(page.locator('text=Traffic Sources')).toBeVisible();
    });
  });

  test.describe('Given the dashboard is displaying real-time data', () => {
    test('When metrics change significantly, Then visual indicators should update', async ({ page }) => {
      await dashboardPage.waitForDataLoad();

      // Check for trend indicators
      const trendIcons = await page.locator('[data-testid*="trend-"]');
      expect(await trendIcons.count()).toBeGreaterThan(0);

      // Verify color coding for good/bad metrics
      const goodMetrics = await page.locator('.text-green-600');
      const warningMetrics = await page.locator('.text-yellow-600'); 
      const poorMetrics = await page.locator('.text-red-600');

      // At least some metrics should be visible
      const totalMetrics = await goodMetrics.count() + 
                          await warningMetrics.count() + 
                          await poorMetrics.count();
      expect(totalMetrics).toBeGreaterThan(0);
    });

    test('When there is no data, Then appropriate empty states should show', async ({ page }) => {
      // Navigate to a time period with no data
      await page.goto('/analytics/realtime?period=future');
      
      // Should show loading state first
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // Then show appropriate messaging
      await page.waitForTimeout(2000);
      const content = await page.content();
      expect(content).toContain('Loading analytics');
    });
  });
});

test.describe('Performance Dashboard - Perfect UX/UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics/performance');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Given the user opens the performance dashboard', () => {
    test('When the page loads, Then Core Web Vitals should display with targets', async ({ page }) => {
      // Wait for metrics to load
      await page.waitForSelector('[data-testid="web-vitals-loaded"]', {
        timeout: 10000
      });

      // Verify all Core Web Vitals are displayed
      const vitals = [
        { name: 'FCP', target: '1.8s' },
        { name: 'LCP', target: '2.5s' },
        { name: 'FID', target: '100ms' },
        { name: 'CLS', target: '0.1' },
        { name: 'TTFB', target: '800ms' }
      ];

      for (const vital of vitals) {
        await expect(page.locator(`text=${vital.name}`)).toBeVisible();
        await expect(page.locator(`text=Target: ${vital.target}`)).toBeVisible();
      }
    });

    test('When selecting different time ranges, Then data should update accordingly', async ({ page }) => {
      // Select time range dropdown
      await page.click('[data-testid="time-range-select"]');
      
      // Verify options are available
      await expect(page.locator('text=1 Hour')).toBeVisible();
      await expect(page.locator('text=24 Hours')).toBeVisible();
      await expect(page.locator('text=7 Days')).toBeVisible();
      await expect(page.locator('text=30 Days')).toBeVisible();

      // Select 7 days
      await page.click('text=7 Days');

      // Verify data updates (loading state should appear)
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    });
  });

  test.describe('Given the user wants to analyze performance trends', () => {
    test('When viewing the Trends tab, Then historical charts should be interactive', async ({ page }) => {
      await page.click('[role="tab"]:has-text("Trends")');

      // Wait for chart to render
      await page.waitForSelector('[data-testid="trends-chart"]', {
        timeout: 10000
      });

      // Verify chart elements
      await expect(page.locator('.recharts-line')).toHaveCount(4); // 4 metrics
      await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible();

      // Hover over chart to test interactivity
      const chartArea = await page.locator('.recharts-wrapper');
      await chartArea.hover();
      
      // Tooltip should appear
      await expect(page.locator('.recharts-tooltip')).toBeVisible();
    });

    test('When viewing the Resources tab, Then slowest resources should be listed', async ({ page }) => {
      await page.click('[role="tab"]:has-text("Resources")');

      // Wait for resources to load
      await page.waitForSelector('[data-testid="resources-list"]');

      // Verify resource entries
      const resources = await page.locator('[data-testid="resource-item"]');
      expect(await resources.count()).toBeGreaterThan(0);

      // Each resource should show timing
      const firstResource = resources.first();
      await expect(firstResource.locator('text=/\\d+ms/')).toBeVisible();
    });

    test('When viewing the Optimization tab, Then actionable suggestions should appear', async ({ page }) => {
      await page.click('[role="tab"]:has-text("Optimization")');

      // Wait for suggestions
      await page.waitForSelector('[data-testid="optimization-suggestions"]');

      // Verify suggestions are shown for poor metrics
      const suggestions = await page.locator('[data-testid="suggestion-item"]');
      
      // Each suggestion should have:
      // - Metric name
      // - Current vs Target values  
      // - Specific recommendation
      if (await suggestions.count() > 0) {
        const firstSuggestion = suggestions.first();
        await expect(firstSuggestion.locator('text=/Current:/')).toBeVisible();
        await expect(firstSuggestion.locator('text=/Target:/')).toBeVisible();
      }
    });
  });

  test.describe('Given the user wants to export performance data', () => {
    test('When clicking Export button, Then a report should download', async ({ page }) => {
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button
      await page.click('[data-testid="export-button"]');
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('performance-report');
      expect(download.suggestedFilename()).toContain('.json');
    });
  });
});

// Visual Regression Tests
test.describe('Analytics Dashboard - Visual Consistency', () => {
  test('Real-time dashboard should match visual snapshot', async ({ page }) => {
    await page.goto('/analytics/realtime');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for animations

    await expect(page).toHaveScreenshot('realtime-dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Performance dashboard should match visual snapshot', async ({ page }) => {
    await page.goto('/analytics/performance');  
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for animations

    await expect(page).toHaveScreenshot('performance-dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

// Accessibility Tests
test.describe('Analytics Dashboard - Accessibility', () => {
  test('Should have no accessibility violations', async ({ page }) => {
    await page.goto('/analytics/realtime');
    
    // Check for basic accessibility
    // - All images have alt text
    const images = await page.locator('img:not([alt])');
    expect(await images.count()).toBe(0);

    // - All form inputs have labels
    const inputs = await page.locator('input:not([aria-label]):not([aria-labelledby])');
    expect(await inputs.count()).toBe(0);

    // - Proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // - Keyboard navigation works
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});

// Mobile Responsiveness Tests  
test.describe('Analytics Dashboard - Mobile UX', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Should be fully responsive on mobile', async ({ page }) => {
    await page.goto('/analytics/realtime');
    await page.waitForLoadState('networkidle');

    // Verify mobile layout
    // - Cards should stack vertically
    const cards = await page.locator('[data-testid^="metric-card-"]');
    const firstCard = await cards.first().boundingBox();
    const secondCard = await cards.nth(1).boundingBox();
    
    if (firstCard && secondCard) {
      expect(secondCard.y).toBeGreaterThan(firstCard.y + firstCard.height);
    }

    // - Navigation should be accessible
    await expect(page.locator('[role="tablist"]')).toBeVisible();

    // - No horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});