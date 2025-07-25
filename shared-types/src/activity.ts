export interface Activity {
  id: string;
  timestamp: string;
  type: 'registration' | 'volunteer' | 'payment' | 'content' | 'system';
  action: string;
  description: string;
  details: Record<string, unknown>;
  userId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}