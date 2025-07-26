# Test Infrastructure Setup Plan

## Current State
- **Coverage:** 25% (2 test files in 316k+ lines)
- **Infrastructure:** Minimal Jest setup
- **Target:** 40% coverage with robust testing framework

## Day 3: Jest & RTL Configuration

### 1. Enhanced Jest Configuration
```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/pages/api/**',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
};

module.exports = createJestConfig(customJestConfig);
```

### 2. Testing Setup File
```javascript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
    };
  },
}));

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}));
```

## Day 4: Priority Component Tests

### 1. Authentication Components (Critical)
```typescript
// src/components/auth/__tests__/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('should validate required fields', async () => {
    render(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const mockOnSubmit = jest.fn();
    render(<LoginForm onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });
});
```

### 2. Cart Components (Business Critical)
```typescript
// src/components/cart/__tests__/CartItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CartItem } from '../CartItem';

const mockItem = {
  id: '1',
  name: 'Test Product',
  price: 25.99,
  quantity: 2,
  image: '/test-image.jpg'
};

describe('CartItem', () => {
  it('should display item information correctly', () => {
    render(<CartItem item={mockItem} />);
    
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$25.99')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('should call onQuantityChange when quantity is updated', () => {
    const mockOnQuantityChange = jest.fn();
    render(<CartItem item={mockItem} onQuantityChange={mockOnQuantityChange} />);
    
    const quantityInput = screen.getByDisplayValue('2');
    fireEvent.change(quantityInput, { target: { value: '3' } });
    
    expect(mockOnQuantityChange).toHaveBeenCalledWith('1', 3);
  });
});
```

### 3. Testing Commands
```bash
# Run tests with coverage
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch

# Run specific test file
npm test CartItem.test.tsx
```

## Success Metrics
- [ ] Jest & RTL properly configured
- [ ] 5+ critical component tests written
- [ ] Coverage reports working
- [ ] CI/CD integration ready
- [ ] Test coverage increased to 30%+

## Priority Test Files (Week 1)
1. `LoginForm.test.tsx` - Authentication security
2. `CartItem.test.tsx` - Business logic
3. `CheckoutForm.test.tsx` - Payment processing
4. `ProductCard.test.tsx` - Core functionality
5. `ErrorBoundary.test.tsx` - Error handling