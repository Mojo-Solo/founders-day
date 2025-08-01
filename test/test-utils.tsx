/**
 * Test Utilities
 * 
 * Custom render functions and test helpers for React Testing Library
 */

import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'

// Mock providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider session={null}>
      {children}
    </SessionProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender }