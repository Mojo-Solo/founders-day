/**
 * Real-Time Analytics Page
 * Live monitoring of user activity and system metrics
 */

import { Metadata } from 'next';
import { RealTimeDashboard } from '@/components/analytics/real-time-dashboard';

export const metadata: Metadata = {
  title: 'Real-Time Analytics | Founders Day',
  description: 'Live monitoring of user activity and system performance'
};

export default function RealTimePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <RealTimeDashboard />
    </div>
  );
}