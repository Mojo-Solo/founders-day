#!/usr/bin/env node

/**
 * Mock API Server for Testing
 * Provides a local mock of the Founders Day Admin API for integration testing
 * 
 * Usage:
 *   node test/helpers/mock-api-server.js
 *   npm run test:mock-server
 */

const http = require('http');
const url = require('url');

const PORT = process.env.MOCK_API_PORT || 3001;
const API_KEY = process.env.ADMIN_API_KEY || 'test-api-key';

// Mock data store
let mockData = {
  registrations: new Map(),
  volunteers: new Map(),
  content: [
    {
      id: '1',
      key: 'hero-title',
      title: 'Hero Title',
      content: 'Founders Day Minnesota 2025',
      type: 'text',
      category: 'home',
      published: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      key: 'hero-subtitle',
      title: 'Hero Subtitle',
      content: 'Celebrating Recovery, Unity, and Service',
      type: 'text',
      category: 'home',
      published: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  schedule: {
    date: "Saturday, June 21, 2025",
    timezone: "America/Chicago",
    schedule: [
      {
        time: "7:30 AM",
        duration: "90 minutes",
        title: "Registration & Check-in Opens",
        description: "Pick up your registration packet and name badge",
        location: "Main Lobby"
      },
      {
        time: "8:00 AM",
        duration: "60 minutes",
        title: "Coffee & Fellowship",
        description: "Meet and greet with coffee and light refreshments",
        location: "Fellowship Hall"
      },
      {
        time: "9:00 AM",
        duration: "120 minutes",
        title: "Opening Session",
        description: "Welcome and keynote presentation",
        location: "Main Auditorium"
      }
    ]
  }
};

// Utility functions
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function generateConfirmationNumber() {
  return 'FD' + Date.now().toString().slice(-8);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function validateApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  return apiKey === API_KEY;
}

function sendResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status = 400) {
  sendResponse(res, { error: message }, status);
}

// Route handlers
const routes = {
  'GET /api/health': (req, res) => {
    sendResponse(res, {
      status: 'healthy',
      services: {
        database: 'connected',
        squareApi: 'connected',
        twilioApi: 'connected'
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0-mock'
    });
  },

  'OPTIONS /api/public/content': (req, res) => {
    sendResponse(res, null, 204);
  },

  'GET /api/public/content': (req, res) => {
    const urlParts = url.parse(req.url, true);
    const { category } = urlParts.query;
    
    let content = mockData.content;
    if (category) {
      content = content.filter(item => item.category === category);
    }
    
    sendResponse(res, { content });
  },

  'GET /api/public/content/:key': (req, res, params) => {
    const { key } = params;
    const content = mockData.content.find(item => item.key === key);
    
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }
    
    sendResponse(res, content);
  },

  'GET /api/schedule': (req, res) => {
    sendResponse(res, mockData.schedule);
  },

  'POST /api/public/registrations': async (req, res) => {
    if (!validateApiKey(req)) {
      return sendError(res, 'Unauthorized', 401);
    }

    try {
      const body = await parseBody(req);
      
      // Basic validation
      if (!body.firstName || !body.lastName || !body.email) {
        return sendError(res, 'Missing required fields: firstName, lastName, email', 400);
      }
      
      if (!body.email.includes('@')) {
        return sendError(res, 'Invalid email format', 400);
      }

      // Check for duplicate email
      for (const [id, registration] of mockData.registrations) {
        if (registration.email === body.email) {
          return sendError(res, 'Email already registered', 409);
        }
      }

      const id = generateId();
      const confirmationNumber = generateConfirmationNumber();
      
      const registration = {
        id,
        confirmationNumber,
        ...body,
        registrationDate: new Date().toISOString(),
        status: 'confirmed',
        paymentStatus: 'pending',
        totalAmount: (body.tickets?.eventTickets || 0) * 25 + (body.tickets?.banquetTickets || 0) * 50
      };
      
      mockData.registrations.set(id, registration);
      
      sendResponse(res, registration, 201);
    } catch (error) {
      sendError(res, 'Invalid JSON', 400);
    }
  },

  'GET /api/public/registrations': (req, res) => {
    const urlParts = url.parse(req.url, true);
    const { email, confirmation } = urlParts.query;
    
    if (email) {
      for (const [id, registration] of mockData.registrations) {
        if (registration.email === email) {
          return sendResponse(res, registration);
        }
      }
      return sendError(res, 'Registration not found', 404);
    }
    
    if (confirmation) {
      for (const [id, registration] of mockData.registrations) {
        if (registration.confirmationNumber === confirmation) {
          return sendResponse(res, registration);
        }
      }
      return sendError(res, 'Registration not found', 404);
    }
    
    sendError(res, 'Email or confirmation number required', 400);
  },

  'POST /api/public/volunteers': async (req, res) => {
    if (!validateApiKey(req)) {
      return sendError(res, 'Unauthorized', 401);
    }

    try {
      const body = await parseBody(req);
      
      // Basic validation
      if (!body.firstName || !body.lastName || !body.email || !body.experience) {
        return sendError(res, 'Missing required fields: firstName, lastName, email, experience', 400);
      }
      
      if (!body.email.includes('@')) {
        return sendError(res, 'Invalid email format', 400);
      }
      
      if (body.experience.length < 10) {
        return sendError(res, 'Experience description too short (minimum 10 characters)', 400);
      }

      // Check for duplicate email
      for (const [id, volunteer] of mockData.volunteers) {
        if (volunteer.email === body.email) {
          return sendError(res, 'Email already exists in volunteer applications', 409);
        }
      }

      const id = generateId();
      
      const volunteer = {
        id,
        ...body,
        applicationDate: new Date().toISOString(),
        status: 'pending'
      };
      
      mockData.volunteers.set(id, volunteer);
      
      sendResponse(res, volunteer, 201);
    } catch (error) {
      sendError(res, 'Invalid JSON', 400);
    }
  },

  'GET /api/public/volunteers': (req, res) => {
    const urlParts = url.parse(req.url, true);
    const { email } = urlParts.query;
    
    if (email) {
      for (const [id, volunteer] of mockData.volunteers) {
        if (volunteer.email === email) {
          return sendResponse(res, volunteer);
        }
      }
      return sendError(res, 'Volunteer application not found', 404);
    }
    
    sendError(res, 'Email required', 400);
  },

  'POST /api/public/payments': async (req, res) => {
    if (!validateApiKey(req)) {
      return sendError(res, 'Unauthorized', 401);
    }

    try {
      const body = await parseBody(req);
      
      if (!body.amount || body.amount <= 0) {
        return sendError(res, 'Invalid amount', 400);
      }

      // Simulate payment processing
      const success = Math.random() > 0.1; // 90% success rate
      
      if (success) {
        sendResponse(res, {
          success: true,
          paymentId: 'payment_' + generateId(),
          status: 'COMPLETED',
          receiptUrl: 'https://example.com/receipt/' + generateId(),
          amount: body.amount
        });
      } else {
        sendError(res, 'Payment processing failed', 402);
      }
    } catch (error) {
      sendError(res, 'Invalid JSON', 400);
    }
  }
};

// Route matching
function matchRoute(method, pathname) {
  for (const [routePattern, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = routePattern.split(' ');
    
    if (method !== routeMethod) continue;
    
    // Exact match
    if (routePath === pathname) {
      return { handler, params: {} };
    }
    
    // Parameter match
    const routeParts = routePath.split('/');
    const pathParts = pathname.split('/');
    
    if (routeParts.length !== pathParts.length) continue;
    
    const params = {};
    let matches = true;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      return { handler, params };
    }
  }
  
  return null;
}

// Create server
const server = http.createServer((req, res) => {
  const { method, url: reqUrl } = req;
  const { pathname } = url.parse(reqUrl);
  
  console.log(`${new Date().toISOString()} ${method} ${pathname}`);
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }
  
  const route = matchRoute(method, pathname);
  
  if (route) {
    try {
      route.handler(req, res, route.params);
    } catch (error) {
      console.error('Route handler error:', error);
      sendError(res, 'Internal server error', 500);
    }
  } else {
    console.log(`404: ${method} ${pathname}`);
    sendError(res, 'Not found', 404);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/public/content`);
  console.log(`  GET  /api/public/content/:key`);
  console.log(`  GET  /api/schedule`);
  console.log(`  POST /api/public/registrations`);
  console.log(`  GET  /api/public/registrations`);
  console.log(`  POST /api/public/volunteers`);
  console.log(`  GET  /api/public/volunteers`);
  console.log(`  POST /api/public/payments`);
  console.log(`\n🔑 API Key: ${API_KEY}`);
  console.log(`🌐 CORS enabled for: http://localhost:3000`);
  console.log(`\n📊 Mock data status:`);
  console.log(`  Registrations: ${mockData.registrations.size}`);
  console.log(`  Volunteers: ${mockData.volunteers.size}`);
  console.log(`  Content items: ${mockData.content.length}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down mock API server...');
  server.close(() => {
    console.log('✅ Mock API server stopped');
    process.exit(0);
  });
});

module.exports = { server, mockData };