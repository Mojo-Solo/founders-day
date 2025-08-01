/**
 * Performance Analytics Page
 * Displays comprehensive performance metrics and monitoring
 */

import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/analytics/performance-dashboard';

export const metadata: Metadata = {
  title: 'Performance Analytics | Founders Day',
  description: 'Monitor and analyze application performance metrics'
};

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <PerformanceDashboard />
    </div>
  );
}