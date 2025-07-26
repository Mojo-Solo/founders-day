# Error Handling & Error Boundaries Implementation

## Current State
- No error boundaries in place
- Unhandled promise rejections
- Poor user experience on errors
- No centralized error logging

## Day 8: Error Boundary Implementation

### 1. Global Error Boundary Component
```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to external service (e.g., Sentry)
    this.logErrorToService(error, errorInfo);
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Replace with your error logging service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // Example: Send to logging service
    // logService.error('Component Error', errorReport);
    console.error('Error Report:', errorReport);
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-gray-800">
            Something went wrong
          </h3>
          <div className="mt-2 text-sm text-gray-500">
            <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
          </div>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto">
                {error.message}
                {error.stack}
              </pre>
            </details>
          )}
          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
```

### 2. Specialized Error Boundaries
```typescript
// src/components/boundaries/AuthErrorBoundary.tsx
import { ErrorBoundary } from '../ErrorBoundary';
import { useRouter } from 'next/router';

export const AuthErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();

  const handleAuthError = (error: Error) => {
    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      router.push('/login');
    }
  };

  const AuthErrorFallback = () => (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
      <p className="text-gray-600 mb-4">Please log in to continue</p>
      <button
        onClick={() => router.push('/login')}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Go to Login
      </button>
    </div>
  );

  return (
    <ErrorBoundary fallback={<AuthErrorFallback />} onError={handleAuthError}>
      {children}
    </ErrorBoundary>
  );
};

// src/components/boundaries/CheckoutErrorBoundary.tsx
export const CheckoutErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const CheckoutErrorFallback = () => (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-4">Checkout Error</h2>
      <p className="text-gray-600 mb-4">
        There was an issue processing your order. Your cart has been saved.
      </p>
      <button
        onClick={() => window.location.href = '/cart'}
        className="bg-green-600 text-white px-4 py-2 rounded mr-2"
      >
        Return to Cart
      </button>
      <button
        onClick={() => window.location.reload()}
        className="bg-gray-600 text-white px-4 py-2 rounded"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <ErrorBoundary fallback={<CheckoutErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
};
```

## Day 9: API Error Handling

### 1. Centralized API Error Handler
```typescript
// src/lib/api-error-handler.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: any): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    const data = error.response.data;
    
    return new ApiError(
      data?.message || `HTTP Error ${status}`,
      status,
      data?.code,
      data
    );
  }

  if (error.request) {
    // Network error
    return new ApiError(
      'Network error - please check your connection',
      0,
      'NETWORK_ERROR'
    );
  }

  // Other errors
  return new ApiError(
    error.message || 'An unexpected error occurred',
    500,
    'UNKNOWN_ERROR'
  );
};

export const retryApiCall = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: ApiError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = handleApiError(error);
      
      // Don't retry client errors (4xx)
      if (lastError.status >= 400 && lastError.status < 500) {
        throw lastError;
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};
```

### 2. React Query Error Handling
```typescript
// src/hooks/useApiQuery.ts
import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { handleApiError, retryApiCall } from '@/lib/api-error-handler';

export const useApiQuery = <TData>(
  key: string[],
  queryFn: () => Promise<TData>,
  options?: {
    retry?: number;
    staleTime?: number;
    onError?: (error: ApiError) => void;
  }
) => {
  return useQuery({
    queryKey: key,
    queryFn: () => retryApiCall(queryFn, options?.retry),
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      const apiError = handleApiError(error);
      console.error(`Query error for ${key.join('/')}:`, apiError);
      options?.onError?.(apiError);
    },
  });
};

// Usage Example
export const useUserProfile = (userId: string) => {
  return useApiQuery(
    ['user', userId],
    () => fetch(`/api/users/${userId}`).then(res => res.json()),
    {
      onError: (error) => {
        if (error.status === 404) {
          // Handle user not found
          router.push('/404');
        }
      }
    }
  );
};
```

## Day 10: Error Boundary Integration

### 1. App-Level Integration
```typescript
// pages/_app.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthErrorBoundary } from '@/components/boundaries/AuthErrorBoundary';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <QueryClient>
        <AuthProvider>
          <AuthErrorBoundary>
            <Component {...pageProps} />
          </AuthErrorBoundary>
        </AuthProvider>
      </QueryClient>
    </ErrorBoundary>
  );
}
```

### 2. Page-Level Error Boundaries
```typescript
// pages/checkout.tsx
import { CheckoutErrorBoundary } from '@/components/boundaries/CheckoutErrorBoundary';

export default function CheckoutPage() {
  return (
    <CheckoutErrorBoundary>
      <CheckoutForm />
      <PaymentProcessor />
    </CheckoutErrorBoundary>
  );
}
```

## Success Criteria
- [ ] Global error boundary implemented
- [ ] Specialized error boundaries for critical flows
- [ ] Centralized API error handling
- [ ] User-friendly error messages
- [ ] Error logging and monitoring
- [ ] Graceful degradation for non-critical features

## Testing Error Boundaries
```typescript
// src/components/__tests__/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error fallback when error occurs', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
```