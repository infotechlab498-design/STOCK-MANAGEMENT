import { apiClient } from './apiClient';
import { PaginatedResult } from './types';

export type PurchaseOrderStatus =
  | 'Draft'
  | 'PendingApproval'
  | 'Approved'
  | 'Issued'
  | 'PartiallyReceived'
  | 'FullyReceived'
  | 'Cancelled'
  | 'Rejected';

export interface PurchaseOrderItemDto {
  id: string;
  parentPoId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  specification?: string;
  unitId: string;
  unitCode: string;
  requisitionItemId?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  outstandingQuantity: number;
  unitRate: number;
  lineDiscount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  notes?: string;
}

export interface PurchaseOrderApprovalEntryDto {
  id: string;
  poId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Rejected' | 'Issued' | 'Cancelled';
  comments?: string;
  timestampUtc: string;
}

export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierContact: string;
  requisitionId?: string | null;
  requisitionNumber?: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  deliveryLocation: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency: string;
  paymentTerms: string;
  notes?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItemDto[];
  subtotal: number;
  itemsDiscount: number;
  headerDiscount: number;
  totalDiscount: number;
  taxAmount: number;
  freight: number;
  grandTotal: number;
  approvalHistory: PurchaseOrderApprovalEntryDto[];
  rejectionReason?: string;
  cancellationReason?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  issuedByUserId?: string;
  issuedByName?: string;
  issuedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
  createdByUserId: string;
  createdByName: string;
}

export interface CreatePurchaseOrderPayload {
  supplierId: string;
  projectId: string;
  deliveryLocation?: string;
  orderDate?: string;
  expectedDeliveryDate: string;
  paymentTerms?: string;
  notes?: string;
  requisitionId?: string | null;
  items: {
    materialId: string;
    requisitionItemId?: string | null;
    orderedQuantity: number;
    unitRate: number;
    lineDiscount?: number;
    taxRate?: number;
    notes?: string;
  }[];
  freight?: number;
  headerDiscount?: number;
  submitImmediately?: boolean;
  initialComments?: string;
}

export interface UpdatePurchaseOrderPayload {
  supplierId?: string;
  deliveryLocation?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  items?: {
    id?: string;
    materialId: string;
    requisitionItemId?: string | null;
    orderedQuantity: number;
    unitRate: number;
    lineDiscount?: number;
    taxRate?: number;
    notes?: string;
  }[];
  freight?: number;
  headerDiscount?: number;
  updateComments?: string;
}

export interface ApprovedRequisitionForPoDto {
  id: string;
  requisitionNumber: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  requiredDate: string;
  purpose: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  hasAvailableLines: boolean;
  items: {
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    categoryId: string;
    categoryName: string;
    requestedQuantity: number;
    unitId: string;
    unitCode: string;
    remarks?: string;
    allocatedQuantity: number;
    unallocatedQuantity: number;
    isFullyAllocated: boolean;
  }[];
}

export interface QuotationDto {
  id: string;
  quotationReference: string;
  supplierId: string;
  supplierName: string;
  date: string;
  validUntil: string;
  currency: string;
  paymentTerms: string;
  notes?: string;
  items: {
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    quotedQuantity: number;
    unitRate: number;
    discount: number;
    taxRate: number;
    estimatedFreight: number;
    lineTotal: number;
  }[];
  createdAtUtc: string;
}

export interface RateComparisonItemDto {
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  lowestRateSupplier: string;
  lowestEffectiveRate: number;
  quotes: {
    quotationId: string;
    quotationReference: string;
    supplierId: string;
    supplierName: string;
    validUntil: string;
    quotedQuantity: number;
    unitRate: number;
    discount: number;
    taxRate: number;
    estimatedFreight: number;
    lineTotal: number;
    effectiveUnitCost: number;
  }[];
}

export const purchaseOrderService = {
  async getPurchaseOrders(params?: {
    search?: string;
    status?: string;
    supplierId?: string;
    projectId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: PurchaseOrderDto[];
    totalCount: number;
    totalPages: number;
    metrics: {
      totalCount: number;
      totalCommittedValue: number;
      pendingApprovalCount: number;
      approvedCount: number;
      issuedCount: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.supplierId && params.supplierId !== 'ALL') query.set('supplierId', params.supplierId);
    if (params?.projectId && params.projectId !== 'ALL') query.set('projectId', params.projectId);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());

    const queryString = query.toString();
    const endpoint = queryString ? `/purchase-orders?${queryString}` : '/purchase-orders';
    const res = await apiClient.get<any>(endpoint);
    return res.data;
  },

  async getPurchaseOrderById(id: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.get<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}`);
    return res.data;
  },

  async createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>('/purchase-orders', payload);
    return res.data;
  },

  async updatePurchaseOrder(id: string, payload: UpdatePurchaseOrderPayload): Promise<PurchaseOrderDto> {
    const res = await apiClient.put<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  async submitPurchaseOrder(id: string, comments?: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}/submit`, { comments });
    return res.data;
  },

  async approvePurchaseOrder(id: string, comments?: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}/approve`, { comments });
    return res.data;
  },

  async rejectPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}/reject`, { reason });
    return res.data;
  },

  async issuePurchaseOrder(id: string, comments?: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}/issue`, { comments });
    return res.data;
  },

  async cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderDto> {
    const res = await apiClient.post<PurchaseOrderDto>(`/purchase-orders/${encodeURIComponent(id)}/cancel`, { reason });
    return res.data;
  },

  async getPurchaseOrderHistory(id: string): Promise<PurchaseOrderApprovalEntryDto[]> {
    const res = await apiClient.get<PurchaseOrderApprovalEntryDto[]>(`/purchase-orders/${encodeURIComponent(id)}/history`);
    return res.data;
  },

  async getApprovedRequisitionsForPo(): Promise<ApprovedRequisitionForPoDto[]> {
    const res = await apiClient.get<ApprovedRequisitionForPoDto[]>('/requisitions/approved-for-po');
    return res.data;
  },

  async getQuotations(): Promise<QuotationDto[]> {
    const res = await apiClient.get<QuotationDto[]>('/quotations');
    return res.data;
  },

  async createQuotation(payload: any): Promise<QuotationDto> {
    const res = await apiClient.post<QuotationDto>('/quotations', payload);
    return res.data;
  },

  async getRateComparison(): Promise<RateComparisonItemDto[]> {
    const res = await apiClient.get<RateComparisonItemDto[] | { items?: RateComparisonItemDto[] }>(
      '/quotations/compare'
    );
    const payload = res.data as RateComparisonItemDto[] | { items?: RateComparisonItemDto[] } | null;
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  },
};
