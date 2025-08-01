/**
 * Real-Time Analytics Dashboard
 * Live monitoring and metrics visualization
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Globe,
  MousePointer,
  Clock,
  AlertCircle,
  BarChart3,
  LineChart,
  PieChart
} from 'lucide-react';
import { analytics } from '@/lib/analytics/analytics-engine';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { RealTimeMetrics } from '@/lib/analytics/analytics-types';
import { ErrorReport } from '@/lib/monitoring/error-tracker';

export function RealTimeDashboard() {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [errorReport, setErrorReport] = useState<ErrorReport | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize analytics
    analytics.initialize({
      enabled: true,
      debug: process.env.NODE_ENV === 'development'
    });

    // Start real-time updates
    const updateMetrics = () => {
      try {
        const newMetrics = analytics.getRealTimeMetrics();
        setMetrics(newMetrics);
        
        const newErrorReport = errorTracker.getErrorReport();
        setErrorReport(newErrorReport);
        
        setLastUpdate(new Date());
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to update metrics:', error);
        setIsConnected(false);
      }
    };

    // Initial update
    updateMetrics();

    // Set up interval
    updateInterval.current = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, []);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Real-Time Analytics</h2>
          <p className="text-muted-foreground">
            Live monitoring of user activity and system performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Users"
          value={metrics.activeUsers}
          icon={Users}
          description="Users online now"
          trend={metrics.activeUsers > 50 ? 'up' : 'stable'}
        />
        <MetricCard
          title="Page Views/Min"
          value={metrics.pageViewsPerMinute}
          icon={Activity}
          description="Real-time activity"
          trend={metrics.pageViewsPerMinute > 100 ? 'up' : 'stable'}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          description="Goal completions"
          trend={metrics.conversionRate > 5 ? 'up' : 'down'}
        />
        <MetricCard
          title="Bounce Rate"
          value={`${metrics.bounceRate.toFixed(1)}%`}
          icon={TrendingDown}
          description="Single page sessions"
          trend={metrics.bounceRate < 40 ? 'up' : 'down'}
          inverse
        />
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Top Pages
                </CardTitle>
                <CardDescription>Most visited pages right now</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topPages.map((page, index) => (
                    <div key={page.path} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-medium">{page.path}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {page.users}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointer className="h-5 w-5" />
                  Top Events
                </CardTitle>
                <CardDescription>Most triggered events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topEvents.map((event, index) => (
                    <div key={event.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-medium">{event.name}</span>
                      </div>
                      <Badge variant="secondary">{event.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Session Analytics
              </CardTitle>
              <CardDescription>Real-time session information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium">Active Sessions</p>
                  <p className="text-2xl font-bold">{metrics.activeSessions}</p>
                  <p className="text-xs text-muted-foreground">Currently active</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Avg. Session Duration</p>
                  <p className="text-2xl font-bold">
                    {Math.floor(metrics.avgSessionDuration / 60)}:{String(metrics.avgSessionDuration % 60).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-muted-foreground">Minutes:Seconds</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Events/Minute</p>
                  <p className="text-2xl font-bold">{metrics.eventsPerMinute}</p>
                  <p className="text-xs text-muted-foreground">User interactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <CardDescription>Core Web Vitals and loading performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <PerformanceMetric
                  name="First Contentful Paint (FCP)"
                  value={1.2}
                  target={1.8}
                  unit="s"
                />
                <PerformanceMetric
                  name="Largest Contentful Paint (LCP)"
                  value={2.1}
                  target={2.5}
                  unit="s"
                />
                <PerformanceMetric
                  name="First Input Delay (FID)"
                  value={45}
                  target={100}
                  unit="ms"
                />
                <PerformanceMetric
                  name="Cumulative Layout Shift (CLS)"
                  value={0.08}
                  target={0.1}
                  unit=""
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {errorReport && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                  title="Total Errors"
                  value={errorReport.summary.totalErrors}
                  icon={AlertCircle}
                  description="In current session"
                  variant="destructive"
                />
                <MetricCard
                  title="Error Rate"
                  value={`${((errorReport.summary.totalErrors / metrics.eventsPerMinute) * 100).toFixed(1)}%`}
                  icon={TrendingUp}
                  description="Of total events"
                  variant="destructive"
                />
                <MetricCard
                  title="Affected Users"
                  value={errorReport.summary.affectedUsers}
                  icon={Users}
                  description="Experienced errors"
                  variant="destructive"
                />
                <MetricCard
                  title="Affected Sessions"
                  value={errorReport.summary.affectedSessions}
                  icon={Activity}
                  description="Contains errors"
                  variant="destructive"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Errors</CardTitle>
                  <CardDescription>Most frequent errors in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {errorReport.summary.topErrors.map((error, index) => (
                      <div key={error.fingerprint} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{error.message}</p>
                          <Badge variant="destructive">{error.count}</Badge>
                        </div>
                        <Progress 
                          value={(error.count / errorReport.summary.totalErrors) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                User Behavior Insights
              </CardTitle>
              <CardDescription>Patterns and engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Device Categories</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Desktop</span>
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Mobile</span>
                      <span className="text-sm font-medium">30%</span>
                    </div>
                    <Progress value={30} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tablet</span>
                      <span className="text-sm font-medium">5%</span>
                    </div>
                    <Progress value={5} className="h-2" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Traffic Sources</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Direct</span>
                      <span className="text-sm font-medium">40%</span>
                    </div>
                    <Progress value={40} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Organic Search</span>
                      <span className="text-sm font-medium">35%</span>
                    </div>
                    <Progress value={35} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Social Media</span>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  trend?: 'up' | 'down' | 'stable';
  inverse?: boolean;
  variant?: 'default' | 'destructive';
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend = 'stable',
  inverse = false,
  variant = 'default'
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const trendColor = inverse 
    ? (trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-gray-500')
    : (trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{value}</div>
          {TrendIcon && (
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

interface PerformanceMetricProps {
  name: string;
  value: number;
  target: number;
  unit: string;
}

function PerformanceMetric({ name, value, target, unit }: PerformanceMetricProps) {
  const percentage = Math.min((target / value) * 100, 100);
  const status = value <= target ? 'good' : 'needs-improvement';
  const statusColor = status === 'good' ? 'text-green-600' : 'text-orange-600';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className={`text-sm font-medium ${statusColor}`}>
          {value}{unit} / {target}{unit}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${status === 'good' ? '[&>div]:bg-green-600' : '[&>div]:bg-orange-600'}`}
      />
    </div>
  );
}