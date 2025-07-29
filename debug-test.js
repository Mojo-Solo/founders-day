const { chromium } = require('playwright');

async function debugTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Set up mock route
  await context.route('http://localhost:3000/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head><title>My Profile</title></head>
          <body>
            <h1>My Profile</h1>
            <div data-testid="profile-email">user@example.com</div>
            <div data-testid="profile-first-name">John</div>
            <div data-testid="profile-last-name">Doe</div>
            <div data-testid="profile-phone">(555) 123-4567</div>
            <div data-testid="registration-history">
              <h2>Registration History</h2>
            </div>
          </body>
        </html>
      `
    });
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:3000/profile');
  
  // Check if elements exist
  const email = await page.getByTestId('profile-email');
  console.log('Email element found:', await email.isVisible());
  console.log('Email text:', await email.textContent());
  
  await browser.close();
}

debugTest().catch(console.error);