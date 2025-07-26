# Runtime Type Validation & Type Guards Implementation

## Current Issue
- API responses not validated at runtime
- Potential runtime errors from malformed data
- No protection against API contract changes
- Unsafe type assertions throughout codebase

## Day 11: Type Guards & Validation Setup

### 1. Runtime Type Validation Library Setup
```bash
# Install runtime validation library
npm install zod
npm install @types/node --save-dev
```

### 2. Core Type Schemas
```typescript
// src/lib/schemas.ts
import { z } from 'zod';

// User schemas
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().optional(),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AuthUserSchema = UserSchema.extend({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenExpiry: z.number(),
});

// Product schemas
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  images: z.array(z.string().url()),
  category: z.string(),
  inStock: z.boolean(),
  inventory: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

// Cart schemas
export const CartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int().min(1),
  price: z.number().positive(),
  product: ProductSchema,
});

export const CartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(CartItemSchema),
  total: z.number().min(0),
  updatedAt: z.string().datetime(),
});

// Order schemas
export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(CartItemSchema),
  total: z.number().positive(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  paymentMethod: z.string(),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  createdAt: z.string().datetime(),
});

// API Response schemas
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  });

// Type exports
export type User = z.infer<typeof UserSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
};
```

### 3. Type Guards Implementation
```typescript
// src/lib/type-guards.ts
import { z } from 'zod';
import {
  UserSchema,
  ProductSchema,
  CartSchema,
  OrderSchema,
  ApiResponseSchema,
} from './schemas';

// Generic type guard creator
export const createTypeGuard = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): data is T => {
    try {
      schema.parse(data);
      return true;
    } catch {
      return false;
    }
  };
};

// Specific type guards
export const isUser = createTypeGuard(UserSchema);
export const isProduct = createTypeGuard(ProductSchema);
export const isCart = createTypeGuard(CartSchema);
export const isOrder = createTypeGuard(OrderSchema);

// API response type guard
export const isApiResponse = <T>(
  data: unknown,
  dataSchema: z.ZodSchema<T>
): data is ApiResponse<T> => {
  const responseSchema = ApiResponseSchema(dataSchema);
  return createTypeGuard(responseSchema)(data);
};

// Safe parsers with detailed error information
export const safeParseUser = (data: unknown) => {
  const result = UserSchema.safeParse(data);
  if (!result.success) {
    console.error('User validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
};

export const safeParseProduct = (data: unknown) => {
  const result = ProductSchema.safeParse(data);
  if (!result.success) {
    console.error('Product validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
};

export const safeParseApiResponse = <T>(
  data: unknown,
  dataSchema: z.ZodSchema<T>
) => {
  const responseSchema = ApiResponseSchema(dataSchema);
  const result = responseSchema.safeParse(data);
  if (!result.success) {
    console.error('API response validation failed:', result.error.flatten());
    return null;
  }
  return result.data;
};

// Array validators
export const validateProductArray = (data: unknown): Product[] => {
  const schema = z.array(ProductSchema);
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('Product array validation failed:', error);
    return [];
  }
};

export const validateUserArray = (data: unknown): User[] => {
  const schema = z.array(UserSchema);
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('User array validation failed:', error);
    return [];
  }
};
```

## Day 12: API Integration with Type Safety

### 1. Safe API Client
```typescript
// src/lib/api-client.ts
import { z } from 'zod';
import { ApiResponseSchema } from './schemas';
import { handleApiError, ApiError } from './api-error-handler';

class SafeApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  private async request<T>(
    endpoint: string,
    options: RequestInit,
    responseSchema: z.ZodSchema<T>
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      // Validate response structure
      const apiResponseSchema = ApiResponseSchema(responseSchema);
      const validatedResponse = apiResponseSchema.parse(data);
      
      if (!validatedResponse.success && validatedResponse.error) {
        throw new ApiError(validatedResponse.error, 400);
      }

      return validatedResponse.data;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('API Response validation failed:', error.flatten());
        throw new ApiError(
          'Invalid response format from server',
          500,
          'VALIDATION_ERROR',
          error.flatten()
        );
      }
      throw handleApiError(error);
    }
  }

  // Generic CRUD methods with type safety
  async get<T>(endpoint: string, schema: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: 'GET' }, schema);
  }

  async post<T, U>(
    endpoint: string,
    data: U,
    responseSchema: z.ZodSchema<T>,
    requestSchema?: z.ZodSchema<U>
  ): Promise<T> {
    // Validate request data if schema provided
    if (requestSchema) {
      requestSchema.parse(data);
    }

    return this.request(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      responseSchema
    );
  }

  async put<T, U>(
    endpoint: string,
    data: U,
    responseSchema: z.ZodSchema<T>,
    requestSchema?: z.ZodSchema<U>
  ): Promise<T> {
    if (requestSchema) {
      requestSchema.parse(data);
    }

    return this.request(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      responseSchema
    );
  }

  async delete<T>(endpoint: string, schema: z.ZodSchema<T>): Promise<T> {
    return this.request(endpoint, { method: 'DELETE' }, schema);
  }
}

export const apiClient = new SafeApiClient();
```

### 2. Typed API Hooks
```typescript
// src/hooks/api/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ProductSchema, UserSchema } from '@/lib/schemas';
import { z } from 'zod';

// Get products with type safety
export const useProducts = (category?: string) => {
  return useQuery({
    queryKey: ['products', category],
    queryFn: () => {
      const endpoint = category ? `/products?category=${category}` : '/products';
      return apiClient.get(endpoint, z.array(ProductSchema));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single product
export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => apiClient.get(`/products/${id}`, ProductSchema),
    enabled: !!id,
  });
};

// Create product mutation
const CreateProductSchema = ProductSchema.omit({ id: 'true', createdAt: 'true' });
type CreateProductData = z.infer<typeof CreateProductSchema>;

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductData) =>
      apiClient.post('/products', data, ProductSchema, CreateProductSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// src/hooks/api/useAuth.ts
export const useLogin = () => {
  const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  return useMutation({
    mutationFn: (credentials: z.infer<typeof LoginSchema>) =>
      apiClient.post('/auth/login', credentials, UserSchema, LoginSchema),
  });
};
```

### 3. Component Integration with Type Safety
```typescript
// src/components/ProductCard.tsx
import { Product } from '@/lib/schemas';
import { isProduct } from '@/lib/type-guards';

interface ProductCardProps {
  product: unknown; // Intentionally unknown to demonstrate validation
  onAddToCart?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart 
}) => {
  // Runtime validation
  if (!isProduct(product)) {
    console.error('Invalid product data:', product);
    return (
      <div className="border rounded-lg p-4 bg-red-50">
        <p className="text-red-600">Invalid product data</p>
      </div>
    );
  }

  // TypeScript now knows product is of type Product
  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <img 
        src={product.images[0]} 
        alt={product.name}
        className="w-full h-48 object-cover rounded"
      />
      <h3 className="text-lg font-semibold mt-2">{product.name}</h3>
      <p className="text-gray-600 text-sm">{product.description}</p>
      <div className="flex justify-between items-center mt-4">
        <span className="text-xl font-bold">${product.price.toFixed(2)}</span>
        {product.inStock ? (
          <button
            onClick={() => onAddToCart?.(product.id)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add to Cart
          </button>
        ) : (
          <span className="text-red-600 font-medium">Out of Stock</span>
        )}
      </div>
    </div>
  );
};
```

## Success Criteria
- [ ] Zod schemas for all data types
- [ ] Runtime validation for all API responses
- [ ] Type guards protect against malformed data
- [ ] Safe API client with validation
- [ ] Error handling for validation failures
- [ ] Components handle invalid data gracefully

## Testing Type Validation
```typescript
// src/lib/__tests__/type-guards.test.ts
import { isUser, isProduct, safeParseUser } from '../type-guards';

describe('Type Guards', () => {
  describe('isUser', () => {
    it('should return true for valid user data', () => {
      const validUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      expect(isUser(validUser)).toBe(true);
    });

    it('should return false for invalid user data', () => {
      const invalidUser = {
        id: '123',
        email: 'invalid-email', // Invalid email format
        name: 'Test User',
      };

      expect(isUser(invalidUser)).toBe(false);
    });
  });

  describe('safeParseUser', () => {
    it('should return parsed user for valid data', () => {
      const validUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = safeParseUser(validUser);
      expect(result).toEqual(validUser);
    });

    it('should return null for invalid data', () => {
      const invalidUser = { id: '123' }; // Missing required fields

      const result = safeParseUser(invalidUser);
      expect(result).toBeNull();
    });
  });
});
```