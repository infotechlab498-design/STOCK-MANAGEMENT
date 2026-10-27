import { apiClient } from './apiClient';

export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Critical';
export type NotificationCategory =
  | 'Requisition'
  | 'PurchaseOrder'
  | 'GRN'
  | 'MaterialIssue'
  | 'MaterialReturn'
  | 'StockTransfer'
  | 'LowStock'
  | 'Reconciliation';

export interface NotificationItem {
  id: string;
  eventKey: string;
  category: NotificationCategory;
  eventType: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  targetRoute: string;
  projectId?: string;
  projectName?: string;
  warehouseId?: string;
  warehouseName?: string;
  secondaryProjectId?: string;
  secondaryWarehouseId?: string;
  isRead: boolean;
  readAtUtc?: string | null;
  createdAtUtc: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
  category?: string;
  eventType?: string;
  projectId?: string;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}

export const notificationService = {
  async getNotifications(filters: NotificationFilters = {}): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (filters.unreadOnly) params.set('unreadOnly', 'true');
    if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters.eventType && filters.eventType !== 'ALL') params.set('eventType', filters.eventType);
    if (filters.projectId && filters.projectId !== 'ALL') params.set('projectId', filters.projectId);
    if (filters.warehouseId && filters.warehouseId !== 'ALL') params.set('warehouseId', filters.warehouseId);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

    const queryString = params.toString();
    const res = await apiClient.get<NotificationListResponse>(
      `/notifications${queryString ? `?${queryString}` : ''}`
    );
    return res.data;
  },

  async getUnreadCount(): Promise<{ unreadCount: number; totalAccessibleCount: number }> {
    const res = await apiClient.get<{ unreadCount: number; totalAccessibleCount: number }>(
      '/notifications/unread-count'
    );
    return res.data;
  },

  async markAsRead(id: string): Promise<NotificationItem> {
    const res = await apiClient.post<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`);
    return res.data;
  },

  async markAllAsRead(scope?: { projectId?: string; warehouseId?: string }): Promise<{ markedReadCount: number }> {
    const res = await apiClient.post<{ markedReadCount: number }>('/notifications/read-all', scope || {});
    return res.data;
  },
};
