import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  SECURITY = 'SECURITY',
}

export enum NotificationCategory {
  SURAT = 'SURAT',
  IURAN = 'IURAN',
  RONDA = 'RONDA',
  KEAMANAN = 'KEAMANAN',
  PENGUMUMAN = 'PENGUMUMAN',
}

export interface SSEEventData {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  deepLink?: string;
  createdAt: string;
}

export interface SSEMessagePayload {
  event: 'notification' | 'heartbeat' | 'security_alert' | 'system';
  data: SSEEventData | { time: string };
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'promise' | 'security';

export interface AppToastOptions {
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  errorCode?: string;
  auditId?: string;
}

export const NotificationQueryFilterSchema = PaginationQuerySchema.extend({
  category: z.nativeEnum(NotificationCategory).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  isRead: z.coerce.boolean().optional(),
});
export type NotificationQueryFilter = z.infer<typeof NotificationQueryFilterSchema>;

