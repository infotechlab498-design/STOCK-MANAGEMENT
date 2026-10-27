import { apiClient, ApiClientException, getActiveAuthToken } from './apiClient';
import { apiConfig } from './apiConfig';

export interface DashboardFilterParams {
  projectId?: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DashboardLowStockItem {
  balanceId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  categoryName: string;
  unitCode: string;
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  quantityOnHand: number;
  quantityAvailable: number;
  quantityInTransit: number;
  minimumStockLevel: number;
  reorderLevel: number;
  shortfallQuantity: number;
  weightedAverageCost: number;
  estimatedReplenishmentCost: number;
  severity: 'OutOfStock' | 'Critical' | 'Reorder';
}

export interface DashboardLocationSummary {
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  distinctMaterials: number;
  quantityOnHand: number;
  quantityAvailable: number;
  quantityInTransit: number;
  inventoryValue: number;
  lowStockCount: number;
  pendingGrnCount: number;
  openIssueCount: number;
  openTransferCount: number;
}

export interface DashboardCategoryValuation {
  categoryName: string;
  totalQuantity: number;
  totalValue: number;
  itemCount: number;
  sharePercent: number;
}

export interface DashboardMovementItem {
  id: string;
  referenceNumber: string;
  transactionType: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
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
  transactionDate: string;
  timestampUtc: string;
  createdByName: string;
}

export interface DashboardAuditActivityItem {
  id: string;
  timestampUtc: string;
  module: string;
  documentNumber: string;
  documentId: string;
  action: string;
  actorName: string;
  actorRole: string;
  summary: string;
  projectId: string;
  warehouseId?: string;
  targetRoute: string;
}

export interface DashboardSummaryData {
  asOfTimestampUtc: string;
  filtersApplied: {
    projectId: string;
    warehouseId: string;
    fromDate: string | null;
    toDate: string | null;
  };
  accessibleScopes: {
    projects: Array<{ id: string; code: string; name: string; location: string }>;
    warehouses: Array<{ id: string; name: string; projectId: string }>;
  };
  kpis: {
    totalInventoryValue: number;
    totalQuantityOnHand: number;
    totalQuantityReserved: number;
    totalQuantityAvailable: number;
    totalInTransitQuantity: number;
    totalInTransitValue: number;
    distinctMaterialsCount: number;
    activeLocationsCount: number;
    lowStockCount: number;
    criticalStockCount: number;
    pendingRequisitionApprovals: number;
    outstandingMaterialIssues: number;
    pendingIssueApprovalsCount: number;
    pendingGrnsInspection: number;
    openTransfersCount: number;
    inTransitTransfersCount: number;
    unresolvedDiscrepanciesCount: number;
    grnDiscrepanciesCount: number;
    transferDiscrepanciesCount: number;
    returnDiscrepanciesCount: number;
    pendingPoApprovalsCount: number;
  };
  lowStockItems: DashboardLowStockItem[];
  locationSummaries: DashboardLocationSummary[];
  categoryValuation: DashboardCategoryValuation[];
  recentMovements: DashboardMovementItem[];
  recentAuditActivity: DashboardAuditActivityItem[];
}

export type ReportTypeKey =
  | 'stock-balances'
  | 'inventory-valuation'
  | 'stock-ledger'
  | 'grn-po-summary'
  | 'consumption-issues-returns'
  | 'transfers-in-transit'
  | 'requisition-turnaround'
  | 'low-stock-reorder';

export interface ReportFilterParams {
  projectId?: string;
  warehouseId?: string;
  materialId?: string;
  supplierId?: string;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ReportColumnDefinition {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
}

export interface ScopedReportResponse {
  reportType: ReportTypeKey;
  title: string;
  subtitle: string;
  asOfTimestampUtc: string;
  filtersApplied: Record<string, any>;
  summary: Record<string, any>;
  columns: ReportColumnDefinition[];
  items: Array<Record<string, any>>;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

function buildQueryString(params: Record<string, any>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      qs.set(k, String(v));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const dashboardReportService = {
  async getDashboardSummary(filters: DashboardFilterParams = {}): Promise<DashboardSummaryData> {
    const query = buildQueryString(filters);
    const res = await apiClient.get<DashboardSummaryData>(`/dashboard/summary${query}`);
    return res.data;
  },

  async getReport(reportType: ReportTypeKey, filters: ReportFilterParams = {}): Promise<ScopedReportResponse> {
    const query = buildQueryString(filters);
    const res = await apiClient.get<ScopedReportResponse>(`/reports/${reportType}${query}`);
    return res.data;
  },

  async downloadReportCsv(reportType: ReportTypeKey, filters: ReportFilterParams = {}): Promise<void> {
    const query = buildQueryString({ ...filters, format: 'csv' });
    const url = `${apiConfig.baseUrl.replace(/\/$/, '')}/reports/${reportType}/export${query}`;
    const token = getActiveAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let msg = `CSV export failed (${response.status})`;
      try {
        const json = await response.json();
        if (json?.message) msg = json.message;
      } catch {
        // ignore JSON parse error
      }
      throw new ApiClientException(msg, response.status);
    }

    const csvText = await response.text();
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `${reportType}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  },
};
