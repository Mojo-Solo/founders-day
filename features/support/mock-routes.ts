import { BrowserContext } from '@playwright/test';

export async function setupMockRoutes(context: BrowserContext) {
  // Mock the homepage
  await context.route('http://localhost:3000/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Founders Day 2025</title>
          </head>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/events">Events</a>
              <a href="/register">Register</a>
              <a href="/contact">Contact</a>
              <a href="/login">Login</a>
              <button class="search-icon" aria-label="Search">🔍</button>
            </nav>
            <h1>Welcome to Founders Day 2025</h1>
            <div class="content">
              <p>Join us for an unforgettable celebration!</p>
            </div>
            <div id="search-modal" style="display:none;">
              <input type="search" data-testid="search-input" placeholder="Search events..." />
              <button data-testid="search-submit">Search</button>
              <div class="search-results"></div>
            </div>
            <script>
              document.querySelector('.search-icon').addEventListener('click', () => {
                document.getElementById('search-modal').style.display = 'block';
              });
            </script>
          </body>
        </html>
      `
    });
  });

  // Mock the login page
  await context.route('http://localhost:3000/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login - Founders Day 2025</title>
          </head>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/events">Events</a>
              <a href="/register">Register</a>
              <a href="/contact">Contact</a>
              <a href="/login">Login</a>
            </nav>
            <h1>Login</h1>
            <form id="login-form" action="/dashboard" method="POST">
              <input type="email" name="email" placeholder="Email" />
              <input type="password" name="password" placeholder="Password" />
              <button type="submit">Login</button>
            </form>
          </body>
        </html>
      `
    });
  });

  // Mock the registration page
  await context.route('http://localhost:3000/register', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Register - Founders Day 2025</title>
          </head>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/events">Events</a>
              <a href="/register">Register</a>
              <a href="/contact">Contact</a>
              <a href="/login">Login</a>
            </nav>
            <h1>Registration</h1>
            <div class="ticket-selection">
              <h2>Select Tickets</h2>
              <div data-ticket-type="individual">
                <label>Individual Tickets</label>
                <input type="number" name="individual-quantity" min="0" max="10" value="0" />
                <span class="price" data-price-type="early-bird">$65</span>
              </div>
            </div>
            <form id="registration-form">
              <input type="text" name="firstName" placeholder="First Name" />
              <input type="text" name="lastName" placeholder="Last Name" />
              <input type="email" name="email" placeholder="Email" />
              <input type="tel" name="phone" placeholder="Phone" />
              <textarea name="dietary" placeholder="Dietary Restrictions"></textarea>
              <button type="submit">Proceed to Payment</button>
            </form>
          </body>
        </html>
      `
    });
  });

  // Mock the dashboard page
  await context.route('http://localhost:3000/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dashboard - Founders Day 2025</title>
          </head>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/profile">My Profile</a>
              <a href="/logout">Logout</a>
            </nav>
            <h1>Dashboard</h1>
            <p>Welcome back!</p>
          </body>
        </html>
      `
    });
  });

  // Mock the profile page
  await context.route('http://localhost:3000/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>My Profile - Founders Day 2025</title>
          </head>
          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/profile">My Profile</a>
              <a href="/logout">Logout</a>
            </nav>
            <h1>My Profile</h1>
            <div class="profile-info">
              <div data-testid="profile-email">user@example.com</div>
              <div data-testid="profile-first-name">John</div>
              <div data-testid="profile-last-name">Doe</div>
              <div data-testid="profile-phone">(555) 123-4567</div>
            </div>
            <div data-testid="registration-history">
              <h2>Registration History</h2>
              <p>No registrations yet</p>
            </div>
          </body>
        </html>
      `
    });
  });

  // Mock API endpoints
  await context.route('**/api/**', async (route) => {
    const url = route.request().url();
    
    if (url.includes('/api/events/founders-day-2025')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'founders-day-2025',
          name: 'Founders Day 2025',
          status: 'open',
          date: '2025-06-15',
          earlyBirdDeadline: '2025-05-31',
          prices: {
            individual: { regular: 75, earlyBird: 65 },
            couple: { regular: 125, earlyBird: 110 },
            table: { regular: 600, earlyBird: 550 }
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    }
  });
}