import { apiClient } from './apiClient';
import { PaginatedResult } from './types';

export type GrnStatus =
  | 'Draft'
  | 'SubmittedForInspection'
  | 'Inspected'
  | 'Approved'
  | 'Posted'
  | 'Rejected'
  | 'ReturnedForCorrection'
  | 'Cancelled';

export interface InspectionChecklistDto {
  challanMatchesPO: boolean;
  vehicleUnloadedSafely: boolean;
  physicallyCounted: boolean;
  packagingIntact: boolean;
  batchTestCertsProvided: boolean;
  testCertificateNumber?: string;
  materialsMeetSpecs: boolean;
  binTagsAttached: boolean;
  inspectionRemarks: string;
  discrepancyIdentified: boolean;
  debitNoteRequired: boolean;
  debitNoteReason?: string;
}

export interface GoodsReceivedItemDto {
  id: string;
  purchaseOrderItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  specification?: string;
  unitId?: string;
  unitCode: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  poOutstandingQuantity: number;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  remarks?: string;
  storageLocation: string;
  unitPrice: number;
  totalAcceptedAmount: number;
}

export interface GrnAuditEntryDto {
  id: string;
  grnId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  comments: string;
  timestampUtc: string;
}

export interface GoodsReceivedNoteDto {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  projectId: string;
  projectName: string;
  warehouseId: string;
  warehouseName: string;
  storageLocation: string;
  grnDate: string;
  receivedAtUtc: string;
  deliveryChallanNumber: string;
  deliveryChallanDate: string;
  vehicleNumber: string;
  deliveredBy: string;
  status: GrnStatus;
  inspectionChecklist: InspectionChecklistDto;
  items: GoodsReceivedItemDto[];
  totalDeliveredQuantity: number;
  totalAcceptedQuantity: number;
  totalRejectedQuantity: number;
  totalDamagedQuantity: number;
  totalShortQuantity: number;
  totalAcceptedValue: number;
  generalRemarks?: string;
  rejectionReason?: string;
  correctionNotes?: string;
  auditTrail: GrnAuditEntryDto[];
  receivedByUserId: string;
  receivedByName: string;
  inspectedByUserId?: string;
  inspectedByName?: string;
  inspectedAtUtc?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  postedByUserId?: string;
  postedByName?: string;
  postedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GrnSummaryMetrics {
  totalCount: number;
  draftCount: number;
  pendingInspectionCount: number;
  inspectedCount: number;
  approvedCount: number;
  postedCount: number;
  totalAcceptedValue: number;
}

export interface GrnListFilterParams {
  search?: string;
  purchaseOrderId?: string;
  supplierId?: string;
  warehouseId?: string;
  projectId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateGrnPayload {
  purchaseOrderId: string;
  warehouseId?: string;
  warehouseName?: string;
  storageLocation?: string;
  deliveryChallanNumber: string;
  deliveryChallanDate?: string;
  vehicleNumber?: string;
  deliveredBy?: string;
  grnDate?: string;
  generalRemarks?: string;
  items: {
    purchaseOrderItemId: string;
    materialId?: string;
    deliveredQuantity: number;
    acceptedQuantity?: number;
    rejectedQuantity?: number;
    damagedQuantity?: number;
    shortQuantity?: number;
    storageLocation?: string;
    remarks?: string;
  }[];
  inspectionChecklist?: Partial<InspectionChecklistDto>;
}

export interface PurchaseOrderReceiptSummaryDto {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: string;
  supplierName: string;
  projectName: string;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  totalOutstandingQuantity: number;
  grnCount: number;
  postedGrnCount: number;
  itemSummaries: {
    purchaseOrderItemId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    orderedQuantity: number;
    receivedQuantity: number;
    ledgerCumulativeReceived: number;
    outstandingQuantity: number;
    unitRate: number;
    isFullyReceived: boolean;
  }[];
  grns: GoodsReceivedNoteDto[];
  receipts: any[];
}

export const grnService = {
  async getGrns(
    params?: GrnListFilterParams
  ): Promise<PaginatedResult<GoodsReceivedNoteDto> & { metrics?: GrnSummaryMetrics }> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.purchaseOrderId && params.purchaseOrderId !== 'ALL') query.append('purchaseOrderId', params.purchaseOrderId);
      if (params.supplierId && params.supplierId !== 'ALL') query.append('supplierId', params.supplierId);
      if (params.warehouseId && params.warehouseId !== 'ALL') query.append('warehouseId', params.warehouseId);
      if (params.projectId && params.projectId !== 'ALL') query.append('projectId', params.projectId);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.page) query.append('page', params.page.toString());
      if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    }
    const endpoint = `/grns${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiClient.get<PaginatedResult<GoodsReceivedNoteDto> & { metrics?: GrnSummaryMetrics }>(endpoint);
    return res.data;
  },

  async getGrnById(id: string): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.get<GoodsReceivedNoteDto>(`/grns/${id}`);
    return res.data;
  },

  async getGrnHistory(id: string): Promise<GrnAuditEntryDto[]> {
    const res = await apiClient.get<GrnAuditEntryDto[]>(`/grns/${id}/history`);
    return res.data;
  },

  async createGrn(payload: CreateGrnPayload): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>('/grns', payload);
    return res.data;
  },

  async updateGrn(id: string, payload: Partial<CreateGrnPayload>): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.put<GoodsReceivedNoteDto>(`/grns/${id}`, payload);
    return res.data;
  },

  async submitGrn(id: string, comments?: string): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>(`/grns/${id}/submit`, { comments });
    return res.data;
  },

  async inspectGrn(
    id: string,
    payload: {
      checklist?: Partial<InspectionChecklistDto>;
      items?: any[];
      comments?: string;
    }
  ): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>(`/grns/${id}/inspect`, payload);
    return res.data;
  },

  async approveGrn(id: string, comments?: string): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>(`/grns/${id}/approve`, { comments });
    return res.data;
  },

  async rejectGrn(id: string, reason: string): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>(`/grns/${id}/reject`, { reason });
    return res.data;
  },

  async returnGrnForCorrection(id: string, notes: string): Promise<GoodsReceivedNoteDto> {
    const res = await apiClient.post<GoodsReceivedNoteDto>(`/grns/${id}/return-for-correction`, { notes });
    return res.data;
  },

  async postGrn(id: string): Promise<{ success: boolean; message: string; data: GoodsReceivedNoteDto; purchaseOrderStatus: string }> {
    const res = await apiClient.post<{ success: boolean; message: string; data: GoodsReceivedNoteDto; purchaseOrderStatus: string }>(`/grns/${id}/post`, {});
    return res.data;
  },

  async getPurchaseOrderReceipts(poId: string): Promise<PurchaseOrderReceiptSummaryDto> {
    const res = await apiClient.get<PurchaseOrderReceiptSummaryDto>(`/purchase-orders/${poId}/receipts`);
    return res.data;
  },
};
