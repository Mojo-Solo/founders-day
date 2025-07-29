import { Page } from '@playwright/test';

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    onRetry
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for element with retry
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' } = {}
): Promise<void> {
  await retry(
    async () => {
      await page.waitForSelector(selector, {
        timeout: options.timeout || 5000,
        state: options.state || 'visible'
      });
    },
    {
      maxAttempts: 3,
      onRetry: (attempt) => {
        console.log(`Retrying wait for element '${selector}' (attempt ${attempt})`);
      }
    }
  );
}

/**
 * Navigate with retry
 */
export async function navigateWithRetry(
  page: Page,
  url: string,
  options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' } = {}
): Promise<void> {
  await retry(
    async () => {
      await page.goto(url, {
        waitUntil: options.waitUntil || 'load',
        timeout: 30000
      });
    },
    {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.log(`Retrying navigation to '${url}' (attempt ${attempt}): ${error.message}`);
      }
    }
  );
}

/**
 * Click with retry
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  options: { force?: boolean; timeout?: number } = {}
): Promise<void> {
  await retry(
    async () => {
      const element = page.locator(selector);
      await element.click({
        force: options.force,
        timeout: options.timeout || 5000
      });
    },
    {
      maxAttempts: 3,
      onRetry: (attempt) => {
        console.log(`Retrying click on '${selector}' (attempt ${attempt})`);
      }
    }
  );
}

/**
 * Fill form field with retry
 */
export async function fillWithRetry(
  page: Page,
  selector: string,
  value: string,
  options: { timeout?: number } = {}
): Promise<void> {
  await retry(
    async () => {
      const element = page.locator(selector);
      await element.fill(value, { timeout: options.timeout || 5000 });
    },
    {
      maxAttempts: 3,
      onRetry: (attempt) => {
        console.log(`Retrying fill '${selector}' with '${value}' (attempt ${attempt})`);
      }
    }
  );
}

/**
 * Check if element exists
 */
export async function elementExists(
  page: Page,
  selector: string,
  timeout: number = 1000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'attached' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get text content with retry
 */
export async function getTextWithRetry(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<string> {
  return retry(
    async () => {
      const element = page.locator(selector);
      return await element.textContent({ timeout: options.timeout || 5000 }) || '';
    },
    {
      maxAttempts: 3,
      onRetry: (attempt) => {
        console.log(`Retrying get text from '${selector}' (attempt ${attempt})`);
      }
    }
  );
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: options.timeout || 10000 });
}

/**
 * Take screenshot with metadata
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {}
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  
  console.log(`Taking screenshot: ${filename}`);
  
  return await page.screenshot({
    fullPage: options.fullPage ?? true,
    path: `./screenshots/${filename}`
  });
}

/**
 * Mobile gesture utilities
 */
export class MobileGestures {
  constructor(private page: Page) {}

  /**
   * Perform tap gesture
   */
  async tap(selector: string): Promise<void> {
    await retry(
      async () => {
        const element = this.page.locator(selector);
        const box = await element.boundingBox();
        
        if (!box) {
          throw new Error(`Element '${selector}' not found or not visible`);
        }
        
        // Use mouse events to simulate tap (more reliable than tap())
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await sleep(50); // Small delay to simulate real tap
        await this.page.mouse.up();
      },
      {
        maxAttempts: 3,
        onRetry: (attempt) => {
          console.log(`Retrying tap on '${selector}' (attempt ${attempt})`);
        }
      }
    );
  }

  /**
   * Perform swipe gesture
   */
  async swipe(
    direction: 'up' | 'down' | 'left' | 'right',
    distance: number = 200
  ): Promise<void> {
    const viewport = this.page.viewportSize();
    if (!viewport) throw new Error('No viewport size');
    
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;
    
    switch (direction) {
      case 'up':
        startY = centerY + distance / 2;
        endY = centerY - distance / 2;
        break;
      case 'down':
        startY = centerY - distance / 2;
        endY = centerY + distance / 2;
        break;
      case 'left':
        startX = centerX + distance / 2;
        endX = centerX - distance / 2;
        break;
      case 'right':
        startX = centerX - distance / 2;
        endX = centerX + distance / 2;
        break;
    }
    
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY, { steps: 10 });
    await this.page.mouse.up();
  }
}