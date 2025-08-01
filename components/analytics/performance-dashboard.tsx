/**
 * Performance Metrics Dashboard
 * Comprehensive performance monitoring and visualization
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity,
  Zap,
  Timer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import performanceMonitor from '@/lib/monitoring/performance-monitor';

interface MetricData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  target: number;
  timestamp: number;
}

interface HistoricalMetric {
  timestamp: string;
  fcp: number;
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
}

interface ResourceTiming {
  name: string;
  type: string;
  duration: number;
  size: number;
  cached: boolean;
}

interface PageLoadBreakdown {
  metric: string;
  duration: number;
  percentage: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const RATING_COLORS = {
  good: '#10b981',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444'
};

const WEB_VITALS_TARGETS = {
  fcp: { good: 1800, poor: 3000 },
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 }
};

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalMetric[]>([]);
  const [resources, setResources] = useState<ResourceTiming[]>([]);
  const [pageLoadBreakdown, setPageLoadBreakdown] = useState<PageLoadBreakdown[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    // Initial load
    loadMetrics();
    loadHistoricalData();
    loadResources();
    calculatePageLoadBreakdown();

    // Auto refresh
    const interval = autoRefresh ? setInterval(() => {
      loadMetrics();
      setLastUpdate(new Date());
    }, 30000) : null; // Update every 30 seconds

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, timeRange]);

  const loadMetrics = async () => {
    try {
      const currentMetrics = performanceMonitor.getMetrics();
      
      const formattedMetrics: MetricData[] = [
        {
          name: 'First Contentful Paint (FCP)',
          value: currentMetrics.find(m => m.name === 'FCP')?.value || 0,
          rating: getRating('fcp', currentMetrics.find(m => m.name === 'FCP')?.value || 0),
          target: WEB_VITALS_TARGETS.fcp.good,
          timestamp: Date.now()
        },
        {
          name: 'Largest Contentful Paint (LCP)',
          value: currentMetrics.find(m => m.name === 'LCP')?.value || 0,
          rating: getRating('lcp', currentMetrics.find(m => m.name === 'LCP')?.value || 0),
          target: WEB_VITALS_TARGETS.lcp.good,
          timestamp: Date.now()
        },
        {
          name: 'First Input Delay (FID)',
          value: currentMetrics.find(m => m.name === 'FID')?.value || 0,
          rating: getRating('fid', currentMetrics.find(m => m.name === 'FID')?.value || 0),
          target: WEB_VITALS_TARGETS.fid.good,
          timestamp: Date.now()
        },
        {
          name: 'Cumulative Layout Shift (CLS)',
          value: currentMetrics.find(m => m.name === 'CLS')?.value || 0,
          rating: getRating('cls', currentMetrics.find(m => m.name === 'CLS')?.value || 0),
          target: WEB_VITALS_TARGETS.cls.good,
          timestamp: Date.now()
        },
        {
          name: 'Time to First Byte (TTFB)',
          value: currentMetrics.find(m => m.name === 'TTFB')?.value || 0,
          rating: getRating('ttfb', currentMetrics.find(m => m.name === 'TTFB')?.value || 0),
          target: WEB_VITALS_TARGETS.ttfb.good,
          timestamp: Date.now()
        }
      ];

      setMetrics(formattedMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const loadHistoricalData = async () => {
    // Simulate historical data - in production, this would come from your API
    const now = Date.now();
    const dataPoints = 24; // 24 hours
    const data: HistoricalMetric[] = [];

    for (let i = dataPoints - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000);
      data.push({
        timestamp: timestamp.toISOString(),
        fcp: 1500 + Math.random() * 1000,
        lcp: 2000 + Math.random() * 1500,
        fid: 50 + Math.random() * 100,
        cls: 0.05 + Math.random() * 0.1,
        ttfb: 600 + Math.random() * 600
      });
    }

    setHistoricalData(data);
  };

  const loadResources = () => {
    // Get resource timing data
    if (typeof window !== 'undefined' && window.performance) {
      const resourceTimings = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      const formattedResources: ResourceTiming[] = resourceTimings
        .slice(-20) // Last 20 resources
        .map(resource => ({
          name: resource.name.split('/').pop() || resource.name,
          type: resource.initiatorType,
          duration: Math.round(resource.duration),
          size: resource.transferSize || 0,
          cached: resource.transferSize === 0 && resource.duration > 0
        }))
        .sort((a, b) => b.duration - a.duration);

      setResources(formattedResources);
    }
  };

  const calculatePageLoadBreakdown = () => {
    if (typeof window !== 'undefined' && window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const total = timing.loadEventEnd - timing.navigationStart;

      const breakdown: PageLoadBreakdown[] = [
        {
          metric: 'DNS Lookup',
          duration: timing.domainLookupEnd - timing.domainLookupStart,
          percentage: 0
        },
        {
          metric: 'TCP Connection',
          duration: timing.connectEnd - timing.connectStart,
          percentage: 0
        },
        {
          metric: 'Request/Response',
          duration: timing.responseEnd - timing.requestStart,
          percentage: 0
        },
        {
          metric: 'DOM Processing',
          duration: timing.domComplete - timing.domLoading,
          percentage: 0
        },
        {
          metric: 'Page Load',
          duration: timing.loadEventEnd - timing.loadEventStart,
          percentage: 0
        }
      ];

      // Calculate percentages
      breakdown.forEach(item => {
        item.percentage = total > 0 ? (item.duration / total) * 100 : 0;
      });

      setPageLoadBreakdown(breakdown);
    }
  };

  const getRating = (metric: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
    const targets = WEB_VITALS_TARGETS[metric as keyof typeof WEB_VITALS_TARGETS];
    if (!targets) return 'needs-improvement';

    if (value <= targets.good) return 'good';
    if (value <= targets.poor) return 'needs-improvement';
    return 'poor';
  };

  const getScoreColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreIcon = (rating: string) => {
    switch (rating) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'needs-improvement': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'poor': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return null;
    }
  };

  const formatValue = (metric: string, value: number): string => {
    if (metric.includes('CLS')) return value.toFixed(3);
    return `${Math.round(value)}ms`;
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      resources,
      pageLoadBreakdown
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Metrics</h2>
          <p className="text-muted-foreground">
            Monitor Core Web Vitals and application performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {metric.name.split(' (')[1]?.replace(')', '') || metric.name}
                </CardTitle>
                {getScoreIcon(metric.rating)}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(metric.rating)}`}>
                {formatValue(metric.name, metric.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Target: {formatValue(metric.name, metric.target)}
              </p>
              <Progress 
                value={(metric.target / metric.value) * 100} 
                className="mt-2 h-2"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="breakdown">Page Load</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals Trends</CardTitle>
              <CardDescription>Performance metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number, name: string) => [
                        name === 'cls' ? value.toFixed(3) : `${Math.round(value)}ms`,
                        name.toUpperCase()
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="fcp" stroke="#8b5cf6" name="FCP" />
                    <Line type="monotone" dataKey="lcp" stroke="#ef4444" name="LCP" />
                    <Line type="monotone" dataKey="fid" stroke="#3b82f6" name="FID" />
                    <Line type="monotone" dataKey="ttfb" stroke="#f59e0b" name="TTFB" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CLS Trend</CardTitle>
              <CardDescription>Cumulative Layout Shift over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => value.toFixed(3)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cls" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Loading Performance</CardTitle>
              <CardDescription>Slowest resources impacting page load</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {resources.map((resource, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={resource.cached ? 'secondary' : 'default'}>
                          {resource.type}
                        </Badge>
                        <span className="text-sm font-medium">{resource.name}</span>
                        {resource.cached && (
                          <Badge variant="outline" className="text-xs">
                            Cached
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {resource.duration}ms
                      </span>
                    </div>
                    <Progress 
                      value={(resource.duration / resources[0].duration) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Page Load Breakdown</CardTitle>
              <CardDescription>Time spent in each loading phase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pageLoadBreakdown}
                      dataKey="duration"
                      nameKey="metric"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ metric, percentage }) => `${metric}: ${percentage.toFixed(1)}%`}
                    >
                      {pageLoadBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value}ms`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading Timeline</CardTitle>
              <CardDescription>Sequential breakdown of page load events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pageLoadBreakdown.map((phase, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">{phase.metric}</div>
                    <div className="flex-1">
                      <Progress value={phase.percentage} className="h-6" />
                    </div>
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      {phase.duration}ms
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Optimization Suggestions</CardTitle>
              <CardDescription>Recommendations based on current metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.map((metric) => {
                  if (metric.rating === 'good') return null;
                  
                  return (
                    <div key={metric.name} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${getScoreColor(metric.rating)}`} />
                        <div className="flex-1">
                          <h4 className="font-medium">{metric.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Current: {formatValue(metric.name, metric.value)} | 
                            Target: {formatValue(metric.name, metric.target)}
                          </p>
                          <div className="mt-2 text-sm">
                            {getOptimizationSuggestion(metric.name, metric.rating)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>Last updated: {lastUpdate.toLocaleTimeString()}</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span>Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
            <span>Needs Improvement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span>Poor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getOptimizationSuggestion(metric: string, rating: string): string {
  const suggestions: Record<string, Record<string, string>> = {
    'First Contentful Paint (FCP)': {
      'needs-improvement': 'Consider optimizing critical rendering path, reduce render-blocking resources, and implement server-side rendering.',
      'poor': 'Critical: Minimize server response time, eliminate render-blocking JavaScript and CSS, optimize fonts loading.'
    },
    'Largest Contentful Paint (LCP)': {
      'needs-improvement': 'Optimize images with next-gen formats, implement lazy loading, and consider using a CDN.',
      'poor': 'Critical: Preload important resources, optimize server response times, compress images aggressively.'
    },
    'First Input Delay (FID)': {
      'needs-improvement': 'Break up long JavaScript tasks, use web workers for heavy computations.',
      'poor': 'Critical: Minimize JavaScript execution time, defer non-critical scripts, optimize third-party scripts.'
    },
    'Cumulative Layout Shift (CLS)': {
      'needs-improvement': 'Add size attributes to images and videos, avoid inserting content above existing content.',
      'poor': 'Critical: Reserve space for dynamic content, avoid non-composited animations, preload fonts.'
    },
    'Time to First Byte (TTFB)': {
      'needs-improvement': 'Implement caching strategies, optimize database queries, consider edge servers.',
      'poor': 'Critical: Use a CDN, optimize server configuration, implement aggressive caching policies.'
    }
  };

  return suggestions[metric]?.[rating] || 'Monitor this metric and consider optimization strategies.';
}