# Frontend Component Library Documentation
## Founders Day Square Payment Integration

### Table of Contents
1. [Component Library Overview](#component-library-overview)
2. [Design System](#design-system)
3. [Common Components](#common-components)
4. [Payment Components](#payment-components)
5. [Product Components](#product-components)
6. [Cart Components](#cart-components)
7. [Customer Components](#customer-components)
8. [Admin Components](#admin-components)
9. [Hooks and Utilities](#hooks-and-utilities)
10. [Testing Guidelines](#testing-guidelines)

---

## Component Library Overview

### Architecture Principles
- **Atomic Design**: Components organized in atoms, molecules, organisms, templates
- **Composition over Inheritance**: Flexible component composition
- **TypeScript First**: Full type safety across all components
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized with React.memo and lazy loading
- **Responsive**: Mobile-first responsive design

### Technology Stack
```typescript
// Core Technologies
React 18.x              // UI library
TypeScript 5.x          // Type safety
Next.js 14.x            // Framework
Tailwind CSS 3.x        // Utility-first CSS

// UI Libraries
Headless UI             // Unstyled components
React Hook Form         // Form management
Framer Motion           // Animations
React Query             // Server state

// Development Tools
Storybook               // Component documentation
Jest                    // Unit testing
React Testing Library   // Component testing
Chromatic              // Visual testing
```

---

## Design System

### Color Palette
```typescript
// colors.ts
export const colors = {
  primary: {
    50: '#fef7ee',
    100: '#fdedd6',
    500: '#f97316',
    600: '#ea580c',
    900: '#9a3412',
  },
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    500: '#64748b',
    600: '#475569',
    900: '#0f172a',
  },
  success: {
    50: '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
  },
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
};
```

### Typography System
```typescript
// typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['Fira Code', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
```

### Spacing System
```typescript
// spacing.ts
export const spacing = {
  0: '0px',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
};
```

---

## Common Components

### Button Component

```typescript
// components/common/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button, buttonVariants };

// Usage Examples:
// <Button>Default Button</Button>
// <Button variant="outline" size="sm">Small Outline</Button>
// <Button isLoading>Loading Button</Button>
// <Button leftIcon={<PlusIcon />}>Add Item</Button>
```

### Input Component

```typescript
// components/common/Input.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-success focus-visible:ring-success',
      },
      size: {
        default: 'h-10',
        sm: 'h-9',
        lg: 'h-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, label, error, helperText, leftIcon, rightIcon, ...props }, ref) => {
    const hasError = Boolean(error);
    const inputVariant = hasError ? 'error' : variant;

    return (
      <div className="w-full">
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            className={inputVariants({ 
              variant: inputVariant, 
              size, 
              className: `${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}` 
            })}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={`text-sm mt-1 ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input, inputVariants };
```

### Modal Component

```typescript
// components/common/Modal.tsx
import React from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50" 
        onClose={closeOnOverlayClick ? onClose : () => {}}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    {title && (
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900"
                      >
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="text-sm text-gray-500 mt-1">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  {showCloseButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Usage Example:
// <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
//   <p>Are you sure you want to continue?</p>
//   <div className="flex gap-2 mt-4">
//     <Button onClick={handleConfirm}>Confirm</Button>
//     <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
//   </div>
// </Modal>
```

---

## Payment Components

### PaymentForm Component

```typescript
// components/payment/PaymentForm.tsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useSquarePayment } from '../../hooks/useSquarePayment';
import { Alert } from '../common/Alert';

const paymentSchema = z.object({
  cardNumber: z.string().min(13, 'Invalid card number'),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Invalid expiry date (MM/YY)'),
  cvv: z.string().min(3, 'Invalid CVV'),
  cardholderName: z.string().min(2, 'Cardholder name is required'),
  billingAddress: z.object({
    addressLine1: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    postalCode: z.string().min(5, 'Postal code is required'),
    country: z.string().default('US'),
  }),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export interface PaymentFormProps {
  amount: number;
  currency: string;
  orderId: string;
  onSuccess: (payment: any) => void;
  onError: (error: string) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  currency,
  orderId,
  onSuccess,
  onError,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { initializeSquare, processPayment, isReady, error } = useSquarePayment();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
  });

  useEffect(() => {
    initializeSquare();
  }, [initializeSquare]);

  const onSubmit = async (data: PaymentFormData) => {
    if (!isReady) {
      onError('Payment system not ready');
      return;
    }

    setIsProcessing(true);

    try {
      const paymentResult = await processPayment({
        orderId,
        amount,
        currency,
        cardData: data,
      });

      if (paymentResult.success) {
        onSuccess(paymentResult.payment);
      } else {
        onError(paymentResult.error || 'Payment failed');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading payment system...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-2">Payment Summary</h3>
        <div className="flex justify-between">
          <span>Total Amount:</span>
          <span className="font-semibold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currency,
            }).format(amount / 100)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          label="Cardholder Name"
          {...register('cardholderName')}
          error={errors.cardholderName?.message}
          placeholder="John Doe"
        />

        <Input
          label="Card Number"
          {...register('cardNumber')}
          error={errors.cardNumber?.message}
          placeholder="1234 5678 9012 3456"
          maxLength={19}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Expiry Date"
            {...register('expiryDate')}
            error={errors.expiryDate?.message}
            placeholder="MM/YY"
            maxLength={5}
          />

          <Input
            label="CVV"
            {...register('cvv')}
            error={errors.cvv?.message}
            placeholder="123"
            maxLength={4}
            type="password"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Billing Address</h4>
        
        <Input
          label="Address Line 1"
          {...register('billingAddress.addressLine1')}
          error={errors.billingAddress?.addressLine1?.message}
          placeholder="123 Main St"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            {...register('billingAddress.city')}
            error={errors.billingAddress?.city?.message}
            placeholder="New York"
          />

          <Input
            label="State"
            {...register('billingAddress.state')}
            error={errors.billingAddress?.state?.message}
            placeholder="NY"
          />
        </div>

        <Input
          label="Postal Code"
          {...register('billingAddress.postalCode')}
          error={errors.billingAddress?.postalCode?.message}
          placeholder="10001"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={isProcessing}
        disabled={!isReady || isProcessing}
      >
        {isProcessing ? 'Processing Payment...' : `Pay ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
        }).format(amount / 100)}`}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        Your payment information is encrypted and secure. We use Square's secure payment processing.
      </p>
    </form>
  );
};
```

### SquareCard Component

```typescript
// components/payment/SquareCard.tsx
import React, { useEffect, useRef } from 'react';
import { useSquareCard } from '../../hooks/useSquareCard';

export interface SquareCardProps {
  applicationId: string;
  locationId: string;
  onCardNonceReceived: (nonce: string, buyerVerificationToken?: string) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export const SquareCard: React.FC<SquareCardProps> = ({
  applicationId,
  locationId,
  onCardNonceReceived,
  onError,
  disabled = false,
}) => {
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const { 
    initializePaymentForm, 
    requestCardNonce, 
    isLoaded, 
    error 
  } = useSquareCard({
    applicationId,
    locationId,
  });

  useEffect(() => {
    if (cardContainerRef.current && !isLoaded) {
      initializePaymentForm(cardContainerRef.current);
    }
  }, [initializePaymentForm, isLoaded]);

  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);

  const handlePaymentRequest = async () => {
    try {
      const { nonce, buyerVerificationToken } = await requestCardNonce();
      onCardNonceReceived(nonce, buyerVerificationToken);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={cardContainerRef}
        id="square-card-element"
        className={`min-h-[200px] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      />
      
      {!isLoaded && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-gray-600">Loading payment form...</span>
        </div>
      )}
      
      {error && (
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
          {error.message || 'Payment form error'}
        </div>
      )}
    </div>
  );
};
```

### PaymentSummary Component

```typescript
// components/payment/PaymentSummary.tsx
import React from 'react';
import { formatCurrency } from '../../utils/currency';

export interface PaymentSummaryProps {
  subtotal: number;
  tax: number;
  shipping: number;
  discount?: number;
  total: number;
  currency: string;
  couponCode?: string;
  onRemoveCoupon?: () => void;
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  subtotal,
  tax,
  shipping,
  discount = 0,
  total,
  currency,
  couponCode,
  onRemoveCoupon,
}) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
      <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span className="flex items-center">
              Discount
              {couponCode && (
                <span className="ml-1 text-xs bg-green-100 px-2 py-1 rounded">
                  {couponCode}
                  {onRemoveCoupon && (
                    <button
                      onClick={onRemoveCoupon}
                      className="ml-1 text-green-700 hover:text-green-800"
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </span>
            <span>-{formatCurrency(discount, currency)}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatCurrency(tax, currency)}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{shipping > 0 ? formatCurrency(shipping, currency) : 'Free'}</span>
        </div>
        
        <hr className="border-gray-200" />
        
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </div>
  );
};
```

---

## Product Components

### ProductCard Component

```typescript
// components/product/ProductCard.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, ShoppingCart, Heart } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { formatCurrency } from '../../utils/currency';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    currency: string;
    images: Array<{
      url: string;
      alt: string;
    }>;
    rating: number;
    reviewCount: number;
    isInStock: boolean;
    isFeatured?: boolean;
    badge?: string;
  };
  onQuickView?: (productId: string) => void;
  showAddToCart?: boolean;
  showWishlist?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onQuickView,
  showAddToCart = true,
  showWishlist = true,
}) => {
  const { addToCart, isLoading: isAddingToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  
  const isWishlisted = isInWishlist(product.id);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercentage = hasDiscount 
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product.id);
      }
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
    }
  };

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
      <Link href={`/products/${product.slug}`}>
        <div className="aspect-square relative overflow-hidden rounded-t-lg">
          <Image
            src={product.images[0]?.url || '/placeholder-product.jpg'}
            alt={product.images[0]?.alt || product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isFeatured && (
              <Badge variant="secondary">Featured</Badge>
            )}
            {hasDiscount && (
              <Badge variant="destructive">{discountPercentage}% OFF</Badge>
            )}
            {product.badge && (
              <Badge variant="outline">{product.badge}</Badge>
            )}
            {!product.isInStock && (
              <Badge variant="secondary">Out of Stock</Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {showWishlist && (
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/80 hover:bg-white"
                onClick={handleToggleWishlist}
              >
                <Heart 
                  className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`}
                />
              </Button>
            )}
            {onQuickView && (
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/80 hover:bg-white"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(product.id);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-semibold text-sm mb-1 line-clamp-2 hover:text-primary">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < Math.floor(product.rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600">
            ({product.reviewCount})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-semibold text-lg">
            {formatCurrency(product.price, product.currency)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              {formatCurrency(product.compareAtPrice!, product.currency)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        {showAddToCart && (
          <Button
            className="w-full"
            size="sm"
            onClick={handleAddToCart}
            disabled={!product.isInStock || isAddingToCart}
            isLoading={isAddingToCart}
          >
            {!product.isInStock ? (
              'Out of Stock'
            ) : isAddingToCart ? (
              'Adding...'
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
```

### ProductList Component

```typescript
// components/product/ProductList.tsx
import React from 'react';
import { ProductCard } from './ProductCard';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

export interface ProductListProps {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    currency: string;
    images: Array<{ url: string; alt: string }>;
    rating: number;
    reviewCount: number;
    isInStock: boolean;
    isFeatured?: boolean;
    badge?: string;
  }>;
  isLoading?: boolean;
  error?: string;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onQuickView?: (productId: string) => void;
  showPagination?: boolean;
  gridCols?: 2 | 3 | 4;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  isLoading = false,
  error,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  onQuickView,
  showPagination = true,
  gridCols = 4,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Error Loading Products"
        description={error}
        action={{
          label: 'Try Again',
          onClick: () => window.location.reload(),
        }}
      />
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        title="No Products Found"
        description="We couldn't find any products matching your criteria."
      />
    );
  }

  const gridClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className="space-y-6">
      <div className={`grid ${gridClasses[gridCols]} gap-6`}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onQuickView={onQuickView}
          />
        ))}
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
};
```

---

## Cart Components

### CartDrawer Component

```typescript
// components/cart/CartDrawer.tsx
import React from 'react';
import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/currency';
import { useCart } from '../../hooks/useCart';

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { 
    cart, 
    updateQuantity, 
    removeFromCart, 
    isLoading 
  } = useCart();

  if (!isOpen) return null;

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeFromCart(itemId);
    } else {
      await updateQuantity(itemId, newQuantity);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                Shopping Cart ({cart?.itemCount || 0})
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {!cart?.items.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingBag className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Your cart is empty
                </h3>
                <p className="text-gray-500 mb-4">
                  Add some products to get started
                </p>
                <Button onClick={onClose}>Continue Shopping</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {formatCurrency(item.unitPrice, cart.currency)}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= item.product.stockQuantity}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 ml-auto"
                          onClick={() => removeFromCart(item.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(item.totalPrice, cart.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cart?.items.length > 0 && (
            <div className="border-t p-4 space-y-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(cart.total, cart.currency)}</span>
              </div>
              
              <div className="space-y-2">
                <Button className="w-full" size="lg">
                  Checkout
                </Button>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Continue Shopping
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
```

---

## Hooks and Utilities

### useSquarePayment Hook

```typescript
// hooks/useSquarePayment.ts
import { useState, useCallback } from 'react';

interface SquarePaymentConfig {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  cardData: any;
}

interface PaymentResult {
  success: boolean;
  payment?: any;
  error?: string;
}

export const useSquarePayment = () => {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSquare = useCallback(async () => {
    try {
      // Initialize Square Web SDK
      if (typeof window !== 'undefined' && window.Square) {
        setIsReady(true);
      } else {
        throw new Error('Square Web SDK not loaded');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Square');
    }
  }, []);

  const processPayment = useCallback(async (
    request: PaymentRequest
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Payment failed');
      }

      return {
        success: true,
        payment: result.payment,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment processing failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isReady,
    isProcessing,
    error,
    initializeSquare,
    processPayment,
  };
};
```

### useCart Hook

```typescript
// hooks/useCart.ts
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    stockQuantity: number;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  itemCount: number;
}

export const useCart = () => {
  const queryClient = useQueryClient();

  // Fetch cart data
  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async (): Promise<Cart> => {
      const response = await fetch('/api/cart');
      if (!response.ok) throw new Error('Failed to fetch cart');
      const result = await response.json();
      return result.cart;
    },
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      if (!response.ok) throw new Error('Failed to add to cart');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity }),
      });
      if (!response.ok) throw new Error('Failed to update cart');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch('/api/cart/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (!response.ok) throw new Error('Failed to remove from cart');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  return {
    cart,
    isLoading: isLoading || addToCartMutation.isPending || updateQuantityMutation.isPending || removeFromCartMutation.isPending,
    addToCart: (productId: string, quantity: number) => 
      addToCartMutation.mutateAsync({ productId, quantity }),
    updateQuantity: (itemId: string, quantity: number) => 
      updateQuantityMutation.mutateAsync({ itemId, quantity }),
    removeFromCart: (itemId: string) => 
      removeFromCartMutation.mutateAsync(itemId),
  };
};
```

---

## Testing Guidelines

### Component Testing Example

```typescript
// __tests__/components/PaymentForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentForm } from '../components/payment/PaymentForm';
import { useSquarePayment } from '../hooks/useSquarePayment';

// Mock the Square payment hook
jest.mock('../hooks/useSquarePayment');
const mockUseSquarePayment = useSquarePayment as jest.MockedFunction<typeof useSquarePayment>;

describe('PaymentForm', () => {
  const mockProps = {
    amount: 10000, // $100.00 in cents
    currency: 'USD',
    orderId: 'order-123',
    onSuccess: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    mockUseSquarePayment.mockReturnValue({
      isReady: true,
      isProcessing: false,
      error: null,
      initializeSquare: jest.fn(),
      processPayment: jest.fn(),
    });
  });

  it('renders payment form with correct amount', () => {
    render(<PaymentForm {...mockProps} />);
    
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Cardholder Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<PaymentForm {...mockProps} />);
    
    const submitButton = screen.getByRole('button', { name: /pay/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cardholder name is required')).toBeInTheDocument();
      expect(screen.getByText('Invalid card number')).toBeInTheDocument();
    });
  });

  it('calls processPayment on form submission', async () => {
    const mockProcessPayment = jest.fn().mockResolvedValue({
      success: true,
      payment: { id: 'payment-123' },
    });
    
    mockUseSquarePayment.mockReturnValue({
      isReady: true,
      isProcessing: false,
      error: null,
      initializeSquare: jest.fn(),
      processPayment: mockProcessPayment,
    });

    render(<PaymentForm {...mockProps} />);
    
    // Fill out form
    fireEvent.change(screen.getByLabelText('Cardholder Name'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByLabelText('Card Number'), {
      target: { value: '4532015112830366' },
    });
    // ... fill other fields
    
    const submitButton = screen.getByRole('button', { name: /pay/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockProcessPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          amount: 10000,
          currency: 'USD',
        })
      );
    });
  });
});
```

### Storybook Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};

export default config;
```

### Component Story Example

```typescript
// components/common/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Plus, ShoppingCart } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Common/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: { type: 'radio' },
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Add to Cart',
    leftIcon: <ShoppingCart className="h-4 w-4" />,
  },
};

export const Loading: Story = {
  args: {
    children: 'Processing...',
    isLoading: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
```

---

This comprehensive frontend component library documentation provides a complete reference for implementing and maintaining the Square payment integration components. Each component includes TypeScript definitions, usage examples, and testing guidelines to ensure consistency and quality across the application.