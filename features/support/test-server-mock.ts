/**
 * Simple test server mock using Playwright's route handlers
 * This replaces MSW for now to avoid dependency issues
 */

import { BrowserContext, Route } from 'playwright';

export interface MockUser {
  id: string;
  email: string;
  username: string;
  name: string;
  profileComplete: boolean;
}

export interface MockProfile {
  id: string;
  userId: string;
  name: string;
  bio: string;
  avatar: string;
  skills: string[];
  interests: string[];
}

// Test data
export const testData = {
  users: {
    validUser: {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      profileComplete: true
    } as MockUser
  },
  profiles: {
    completeProfile: {
      id: '1',
      userId: '1',
      name: 'Test User',
      bio: 'Test bio',
      avatar: '/images/avatar.png',
      skills: ['JavaScript', 'React', 'Node.js'],
      interests: ['Web Development', 'Open Source']
    } as MockProfile
  }
};

export async function setupMockRoutes(context: BrowserContext) {
  // Mock API endpoints
  await context.route('**/api/auth/login', async (route: Route) => {
    const postData = route.request().postDataJSON();
    
    if (postData?.email === 'test@example.com' && postData?.password === 'password123') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: testData.users.validUser,
          token: 'mock-jwt-token'
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      });
    }
  });

  await context.route('**/api/auth/register', async (route: Route) => {
    const postData = route.request().postDataJSON();
    
    if (postData?.email && postData?.username && postData?.password) {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '2',
            email: postData.email,
            username: postData.username,
            name: postData.username,
            profileComplete: false
          },
          token: 'mock-jwt-token-new'
        })
      });
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'All fields are required' })
      });
    }
  });

  await context.route('**/api/users/*', async (route: Route) => {
    const userId = route.request().url().split('/').pop();
    
    if (userId === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testData.users.validUser)
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'User not found' })
      });
    }
  });

  await context.route('**/api/profiles/*', async (route: Route) => {
    const userId = route.request().url().split('/').pop();
    
    if (route.request().method() === 'GET') {
      if (userId === '1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testData.profiles.completeProfile)
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Profile not found' })
        });
      }
    } else if (route.request().method() === 'PUT') {
      const updates = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...testData.profiles.completeProfile,
          ...updates
        })
      });
    }
  });

  // Mock page routes
  await context.route('**/login', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: createLoginPage()
      });
    } else {
      await route.continue();
    }
  });

  await context.route('**/register', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: createRegisterPage()
      });
    } else {
      await route.continue();
    }
  });

  await context.route('**/dashboard', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: createDashboardPage()
      });
    } else {
      await route.continue();
    }
  });

  await context.route('**/profile', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: createProfilePage()
      });
    } else {
      await route.continue();
    }
  });
}

function createLoginPage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Founders Day</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; }
        form { display: flex; flex-direction: column; gap: 15px; }
        input { padding: 10px; font-size: 16px; }
        button { padding: 12px; background: #007bff; color: white; border: none; cursor: pointer; }
        .error { color: red; display: none; }
      </style>
    </head>
    <body>
      <h1>Login</h1>
      <form id="loginForm">
        <input type="email" id="email" name="email" placeholder="Email" required>
        <input type="password" id="password" name="password" placeholder="Password" required>
        <button type="submit">Login</button>
        <div class="error" id="error"></div>
      </form>
      <p>Don't have an account? <a href="/register">Register here</a></p>
      
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              localStorage.setItem('auth_token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              window.location.href = '/dashboard';
            } else {
              document.getElementById('error').textContent = data.error;
              document.getElementById('error').style.display = 'block';
            }
          } catch (err) {
            document.getElementById('error').textContent = 'Network error';
            document.getElementById('error').style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `;
}

function createRegisterPage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Founders Day</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; }
        form { display: flex; flex-direction: column; gap: 15px; }
        input { padding: 10px; font-size: 16px; }
        button { padding: 12px; background: #007bff; color: white; border: none; cursor: pointer; }
        .error { color: red; display: none; }
      </style>
    </head>
    <body>
      <h1>Create Account</h1>
      <form id="registerForm">
        <input type="email" id="email" name="email" placeholder="Email" required>
        <input type="text" id="username" name="username" placeholder="Username" required>
        <input type="password" id="password" name="password" placeholder="Password" required>
        <button type="submit">Register</button>
        <div class="error" id="error"></div>
      </form>
      <p>Already have an account? <a href="/login">Login here</a></p>
      
      <script>
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              localStorage.setItem('auth_token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              window.location.href = '/dashboard';
            } else {
              document.getElementById('error').textContent = data.error;
              document.getElementById('error').style.display = 'block';
            }
          } catch (err) {
            document.getElementById('error').textContent = 'Network error';
            document.getElementById('error').style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `;
}

function createDashboardPage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard - Founders Day</title>
    </head>
    <body>
      <h1>Dashboard</h1>
      <nav>
        <a href="/profile">My Profile</a>
        <a href="/settings">Settings</a>
        <a href="/logout">Logout</a>
      </nav>
      <div id="welcome">Welcome to Founders Day!</div>
    </body>
    </html>
  `;
}

function createProfilePage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Profile - Founders Day</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
        form { display: flex; flex-direction: column; gap: 15px; }
        input, textarea { padding: 10px; font-size: 16px; }
        button { padding: 12px; background: #007bff; color: white; border: none; cursor: pointer; }
        .success { color: green; display: none; }
      </style>
    </head>
    <body>
      <h1>My Profile</h1>
      <form id="profileForm">
        <input type="text" id="name" name="name" placeholder="Full Name" value="Test User">
        <textarea id="bio" name="bio" placeholder="Bio" rows="4">Test bio</textarea>
        <input type="text" id="skills" name="skills" placeholder="Skills (comma separated)" value="JavaScript, React, Node.js">
        <button type="submit">Update Profile</button>
        <div class="success" id="success">Profile updated successfully!</div>
      </form>
      
      <script>
        // Load profile data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        document.getElementById('profileForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = {
            name: document.getElementById('name').value,
            bio: document.getElementById('bio').value,
            skills: document.getElementById('skills').value.split(',').map(s => s.trim())
          };
          
          try {
            const response = await fetch('/api/profiles/' + (user.id || '1'), {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
              },
              body: JSON.stringify(formData)
            });
            
            if (response.ok) {
              document.getElementById('success').style.display = 'block';
              setTimeout(() => {
                document.getElementById('success').style.display = 'none';
              }, 3000);
            }
          } catch (err) {
            console.error('Error updating profile:', err);
          }
        });
      </script>
    </body>
    </html>
  `;
}