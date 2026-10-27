import { apiClient } from './apiClient';
import { ApiResponse, PaginatedResult } from './types';

export type TransferStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Dispatched'
  | 'PartiallyReceived'
  | 'Received'
  | 'Completed'
  | 'Rejected'
  | 'ReturnedForCorrection'
  | 'Cancelled';

export type TransferDiscrepancyStatus = 'None' | 'PendingReview' | 'Resolved';

export type TransferPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface StockTransferItem {
  id: string;
  stockTransferId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedGoodQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  disputedQuantity: number;
  remainingInTransitQuantity: number;
  unitCostAtDispatch: number;
  totalDispatchedAmount: number;
  sourceStockLedgerEntryId?: string;
  destinationStockLedgerEntryId?: string;
  destinationStockLedgerEntryIds?: string[];
  discrepancyReason?: string;
  inspectionNotes?: string;
  evidenceReferences?: string[];
  resolutionStatus?: 'None' | 'Pending' | 'Resolved';
  resolutionAction?: 'WriteOffApproved' | 'CarrierClaimInitiated' | 'SourceCountAdjusted' | 'QuarantineInspect' | 'Resolved';
  resolutionNotes?: string;
  resolvedByUserId?: string;
  resolvedByName?: string;
  resolvedAtUtc?: string;
}

export interface StockTransferAudit {
  id: string;
  stockTransferId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action:
    | 'DraftCreated'
    | 'Updated'
    | 'Submitted'
    | 'Approved'
    | 'Rejected'
    | 'ReturnedForCorrection'
    | 'Dispatched'
    | 'Received'
    | 'Inspected'
    | 'DiscrepancyResolved'
    | 'Completed'
    | 'Cancelled';
  comments: string;
  timestampUtc: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceProjectId: string;
  sourceProjectName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationProjectId: string;
  destinationProjectName: string;
  isCrossProject?: boolean;
  isCrossWarehouse?: boolean;
  requestDate: string;
  plannedDispatchDate?: string;
  actualDispatchDate?: string;
  expectedArrivalDate?: string;
  actualReceiptDate?: string;
  purpose: string;
  transferReason?: string;
  referenceNumber?: string;
  vehicleNumber?: string;
  driverName?: string;
  dispatchReference?: string;
  priority: TransferPriority;
  status: TransferStatus;
  discrepancyStatus: TransferDiscrepancyStatus;
  postingJournalStatus?: 'None' | 'PendingDispatch' | 'Dispatched' | 'PendingReceipt' | 'Completed';
  items: StockTransferItem[];
  auditTrail: StockTransferAudit[];
  remarks?: string;
  rejectionReason?: string;
  correctionNotes?: string;
  cancellationReason?: string;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAtUtc?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  dispatchedByUserId?: string;
  dispatchedByName?: string;
  dispatchedAtUtc?: string;
  receivedByUserId?: string;
  receivedByName?: string;
  receivedAtUtc?: string;
  inspectedByUserId?: string;
  inspectedByName?: string;
  inspectedAtUtc?: string;
  completedByUserId?: string;
  completedByName?: string;
  completedAtUtc?: string;
  cancelledByUserId?: string;
  cancelledByName?: string;
  cancelledAtUtc?: string;
  updatedAtUtc?: string;
}

export interface InTransitItemSummary {
  id: string;
  lineId: string;
  stockTransferId: string;
  transferNumber: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  sourceProjectId: string;
  sourceProjectName: string;
  destinationProjectId: string;
  destinationProjectName: string;
  dispatchedQuantity: number;
  receivedGoodQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  disputedQuantity: number;
  remainingInTransitQuantity: number;
  unitCostAtDispatch: number;
  totalInTransitValue: number;
  actualDispatchDate?: string;
  expectedArrivalDate?: string;
  dispatchedByName?: string;
  vehicleNumber?: string;
  driverName?: string;
  priority?: TransferPriority;
  status: TransferStatus;
}

export interface InTransitInventoryResponse {
  items: InTransitItemSummary[];
  transfers: StockTransfer[];
  metrics: {
    activeTransferCount: number;
    totalInTransitQuantity: number;
    totalInTransitValue: number;
  };
}

export interface TransferDiscrepancyItem {
  id: string;
  lineId: string;
  stockTransferId: string;
  transferNumber: string;
  transferStatus: TransferStatus;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceProjectId: string;
  sourceProjectName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationProjectId: string;
  destinationProjectName: string;
  sourceLocation: string;
  destinationLocation: string;
  dispatchedQuantity: number;
  receivedGoodQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  disputedQuantity: number;
  remainingInTransitQuantity: number;
  unitCostAtDispatch: number;
  varianceValue: number;
  discrepancyReason: string;
  inspectionNotes: string;
  evidenceReferences: string[];
  resolutionStatus: 'Pending' | 'Resolved' | 'None';
  resolutionAction?: string;
  resolutionNotes?: string;
  resolvedByName?: string;
  resolvedAtUtc?: string;
  reportedBy: string;
  reportedAtUtc: string;
}

export interface TransferReconciliationLine {
  lineId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  requestedQuantity: number;
  approvedQuantity: number;
  dispatchedQuantity: number;
  receivedGoodQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  disputedQuantity: number;
  remainingInTransitQuantity: number;
  totalAccounted: number;
  isReconciled: boolean;
  variance: number;
  unitCostAtDispatch: number;
  sourceStockLedgerEntryId?: string;
  destinationStockLedgerEntryId?: string;
  destinationStockLedgerEntryIds?: string[];
  resolutionStatus: string;
  resolutionNotes?: string;
  discrepancyReason?: string;
}

export interface TransferReconciliationResponse {
  transferId: string;
  transferNumber: string;
  status: TransferStatus;
  discrepancyStatus: TransferDiscrepancyStatus;
  isFullyReconciled: boolean;
  lines: TransferReconciliationLine[];
}

export interface CreateStockTransferPayload {
  sourceWarehouseId: string;
  sourceProjectId: string;
  destinationWarehouseId: string;
  destinationProjectId: string;
  purpose: string;
  transferReason?: string;
  referenceNumber?: string;
  priority?: TransferPriority;
  requestDate?: string;
  plannedDispatchDate?: string;
  expectedArrivalDate?: string;
  remarks?: string;
  submitImmediately?: boolean;
  items: Array<{
    materialId: string;
    requestedQuantity: number;
  }>;
}

export interface UpdateStockTransferPayload {
  sourceWarehouseId?: string;
  sourceProjectId?: string;
  destinationWarehouseId?: string;
  destinationProjectId?: string;
  purpose?: string;
  transferReason?: string;
  referenceNumber?: string;
  priority?: TransferPriority;
  plannedDispatchDate?: string;
  expectedArrivalDate?: string;
  remarks?: string;
  items?: Array<{
    id?: string;
    materialId: string;
    requestedQuantity: number;
  }>;
}

export interface StockTransferQueryParams {
  search?: string;
  status?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  projectId?: string;
  hasDiscrepancy?: boolean;
  page?: number;
  pageSize?: number;
}

export const stockTransferService = {
  async getAll(params?: StockTransferQueryParams): Promise<ApiResponse<StockTransfer[] | PaginatedResult<StockTransfer>>> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.sourceWarehouseId && params.sourceWarehouseId !== 'ALL') query.set('sourceWarehouseId', params.sourceWarehouseId);
    if (params?.destinationWarehouseId && params.destinationWarehouseId !== 'ALL') query.set('destinationWarehouseId', params.destinationWarehouseId);
    if (params?.projectId && params.projectId !== 'ALL') query.set('projectId', params.projectId);
    if (params?.hasDiscrepancy) query.set('hasDiscrepancy', 'true');
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const qs = query.toString();
    return apiClient.get<StockTransfer[] | PaginatedResult<StockTransfer>>(`/stock-transfers${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.get<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}`);
  },

  async getHistory(id: string): Promise<ApiResponse<StockTransferAudit[]>> {
    return apiClient.get<StockTransferAudit[]>(`/stock-transfers/${encodeURIComponent(id)}/history`);
  },

  async getReconciliation(id: string): Promise<ApiResponse<TransferReconciliationResponse>> {
    return apiClient.get<TransferReconciliationResponse>(`/stock-transfers/${encodeURIComponent(id)}/reconciliation`);
  },

  async getInTransit(): Promise<ApiResponse<InTransitInventoryResponse>> {
    return apiClient.get<InTransitInventoryResponse>('/inventory/in-transit');
  },

  async getDiscrepancies(includeResolved = false): Promise<ApiResponse<TransferDiscrepancyItem[]>> {
    return apiClient.get<TransferDiscrepancyItem[]>(
      `/stock-transfers/discrepancies${includeResolved ? '?includeResolved=true' : ''}`
    );
  },

  async create(payload: CreateStockTransferPayload): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>('/stock-transfers', payload);
  },

  async update(id: string, payload: UpdateStockTransferPayload): Promise<ApiResponse<StockTransfer>> {
    return apiClient.put<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}`, payload);
  },

  async submit(id: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/submit`, {});
  },

  async approve(
    id: string,
    payload: {
      items?: Array<{ id?: string; materialId?: string; approvedQuantity: number }>;
      comments?: string;
    }
  ): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/approve`, payload);
  },

  async reject(id: string, rejectionReason: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/reject`, {
      rejectionReason,
    });
  },

  async returnForCorrection(id: string, correctionNotes: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/return-for-correction`, {
      correctionNotes,
    });
  },

  async cancel(id: string, cancellationReason: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/cancel`, {
      cancellationReason,
    });
  },

  async dispatch(
    id: string,
    payload: {
      items?: Array<{ id?: string; materialId?: string; dispatchedQuantity: number }>;
      dispatchDate?: string;
      expectedArrivalDate?: string;
      vehicleNumber?: string;
      driverName?: string;
      dispatchReference?: string;
      remarks?: string;
    }
  ): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/dispatch`, payload);
  },

  async receive(
    id: string,
    payload: {
      items: Array<{
        id?: string;
        materialId?: string;
        receivedGoodQuantity: number;
        damagedQuantity?: number;
        shortQuantity?: number;
        disputedQuantity?: number;
        discrepancyReason?: string;
        inspectionNotes?: string;
        evidenceReferences?: string[];
        isIncremental?: boolean;
        isCumulative?: boolean;
      }>;
      actualReceiptDate?: string;
      remarks?: string;
      isIncremental?: boolean;
    }
  ): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/receive`, payload);
  },

  async inspect(
    id: string,
    payload: {
      items?: Array<{
        id?: string;
        materialId?: string;
        inspectionNotes?: string;
        discrepancyReason?: string;
        evidenceReferences?: string[];
      }>;
      inspectionNotes?: string;
      comments?: string;
    }
  ): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/inspect`, payload);
  },

  async complete(id: string, comments?: string): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(`/stock-transfers/${encodeURIComponent(id)}/complete`, { comments });
  },

  async resolveDiscrepancy(
    transferId: string,
    lineId: string,
    payload: {
      resolutionAction?: string;
      resolutionNotes: string;
    }
  ): Promise<ApiResponse<StockTransfer>> {
    return apiClient.post<StockTransfer>(
      `/stock-transfers/${encodeURIComponent(transferId)}/discrepancies/${encodeURIComponent(lineId)}/resolve`,
      payload
    );
  },
};
