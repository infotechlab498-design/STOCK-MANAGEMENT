/**
 * Inventory, Stock Ledger & Moving Weighted-Average Costing Service
 * Provides client interfaces for stock balances, authoritative ledger, WAC valuation, and reconciliation.
 */

import { apiClient } from './apiClient';
import { ApiResponse } from './types';

export interface StockLedgerEntry {
  id: string;
  referenceNumber: string; // e.g. STK-2026-0001
  transactionType: 'OpeningBalance' | 'GoodsReceivedNote' | 'MaterialIssue' | 'SiteReturn' | 'TransferOut' | 'TransferIn' | 'StockAdjustment';
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  sourceLineId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  quantityIn: number;
  quantityOut: number;
  signedQuantity: number;
  unitCost: number;
  transactionValue: number;
  balanceQuantityAfter: number;
  weightedAverageCostAfter: number;
  totalValuationAfter: number;
  batchNumber?: string;
  idempotencyKey: string;
  transactionDate: string;
  timestampUtc: string;
  createdByUserId: string;
  createdByName: string;
  remarks?: string;
}

export interface InventoryBalance {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  categoryId?: string;
  categoryName?: string;
  unitCode: string;
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityInTransit: number;
  weightedAverageCost: number;
  inventoryValue: number;
  version: number;
  lastUpdatedUtc: string;
  // Master material threshold reference (clearly noted as master global)
  globalMinimumStockLevel?: number;
  globalReorderLevel?: number;
  isLowStock?: boolean;
}

export interface InventoryBalancesResponse {
  items: InventoryBalance[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  metrics: {
    totalMaterials: number;
    totalLocations: number;
    totalInventoryValue: number;
    totalQuantityOnHand: number;
    lowStockCount: number;
  };
}

export interface InventoryLedgerResponse {
  items: StockLedgerEntry[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface MaterialValuationGroup {
  materialId: string;
  materialCode: string;
  materialName: string;
  categoryName: string;
  unitCode: string;
  totalQuantity: number;
  averageCost: number;
  totalValue: number;
  locationCount: number;
}

export interface LocationValuationGroup {
  locationId: string;
  locationName: string;
  locationType: 'Warehouse' | 'Project';
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface InventoryValuationData {
  byMaterial: MaterialValuationGroup[];
  byWarehouse: LocationValuationGroup[];
  byProject: LocationValuationGroup[];
  summary: {
    totalInventoryValue: number;
    totalQuantityOnHand: number;
    distinctMaterials: number;
    activeLocations: number;
    asOfTimestampUtc: string;
  };
}

export interface DiscrepancyItem {
  id: string;
  type: 'UNPOSTED_RECEIPT' | 'QUANTITY_MISMATCH' | 'VALUE_MISMATCH' | 'ORPHAN_LEDGER_ENTRY';
  description: string;
  sourceReference: string;
  materialCode: string;
  location: string;
  expectedValue: string | number;
  actualValue: string | number;
  canAutoRecover: boolean;
}

export interface ReconciliationReport {
  isReconciled: boolean;
  totalDiscrepancies: number;
  grnVsLedgerDiscrepancies: DiscrepancyItem[];
  ledgerVsBalanceDiscrepancies: DiscrepancyItem[];
  unreconciledReceiptCount: number;
  lastReconciledAtUtc: string;
}

export const inventoryService = {
  /**
   * List paginated inventory balances with search & filters
   */
  async getBalances(params?: {
    materialId?: string;
    warehouseId?: string;
    projectId?: string;
    search?: string;
    status?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<InventoryBalancesResponse>> {
    const query = new URLSearchParams();
    if (params) {
      if (params.materialId && params.materialId !== 'ALL') query.append('materialId', params.materialId);
      if (params.warehouseId && params.warehouseId !== 'ALL') query.append('warehouseId', params.warehouseId);
      if (params.projectId && params.projectId !== 'ALL') query.append('projectId', params.projectId);
      if (params.search) query.append('search', params.search);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.page) query.append('page', params.page.toString());
      if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    }
    const endpoint = `/inventory/balances${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<InventoryBalancesResponse>(endpoint);
  },

  /**
   * Get balance breakdown for a single material across all authorized locations
   */
  async getBalanceByMaterial(materialId: string): Promise<ApiResponse<InventoryBalance[]>> {
    return apiClient.get<InventoryBalance[]>(`/inventory/balances/${materialId}`);
  },

  /**
   * List paginated authoritative stock ledger transactions
   */
  async getLedger(params?: {
    materialId?: string;
    warehouseId?: string;
    projectId?: string;
    transactionType?: string;
    search?: string;
    referenceNumber?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<InventoryLedgerResponse>> {
    const query = new URLSearchParams();
    if (params) {
      if (params.materialId && params.materialId !== 'ALL') query.append('materialId', params.materialId);
      if (params.warehouseId && params.warehouseId !== 'ALL') query.append('warehouseId', params.warehouseId);
      if (params.projectId && params.projectId !== 'ALL') query.append('projectId', params.projectId);
      if (params.transactionType && params.transactionType !== 'ALL') query.append('transactionType', params.transactionType);
      if (params.search) query.append('search', params.search);
      if (params.referenceNumber) query.append('referenceNumber', params.referenceNumber);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.page) query.append('page', params.page.toString());
      if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    }
    const endpoint = `/inventory/ledger${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<InventoryLedgerResponse>(endpoint);
  },

  /**
   * Get specific stock ledger transaction details
   */
  async getLedgerEntry(id: string): Promise<ApiResponse<StockLedgerEntry>> {
    return apiClient.get<StockLedgerEntry>(`/inventory/ledger/${id}`);
  },

  /**
   * Get grouped inventory valuation rollups
   */
  async getValuation(params?: {
    warehouseId?: string;
    projectId?: string;
  }): Promise<ApiResponse<InventoryValuationData>> {
    const query = new URLSearchParams();
    if (params) {
      if (params.warehouseId && params.warehouseId !== 'ALL') query.append('warehouseId', params.warehouseId);
      if (params.projectId && params.projectId !== 'ALL') query.append('projectId', params.projectId);
    }
    const endpoint = `/inventory/valuation${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<InventoryValuationData>(endpoint);
  },

  /**
   * Audit reconciliation check between GRN receipts, stock ledger, and stock balances
   */
  async getReconciliation(): Promise<ApiResponse<ReconciliationReport>> {
    return apiClient.get<ReconciliationReport>('/inventory/reconciliation');
  },

  /**
   * Idempotently recover and post any unreconciled posted receipts
   */
  async recoverReconciliation(): Promise<ApiResponse<{ recoveredCount: number; message: string }>> {
    return apiClient.post<{ recoveredCount: number; message: string }>('/inventory/reconciliation/recover');
  },
};
