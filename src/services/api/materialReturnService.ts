import { apiClient } from './apiClient';

export interface MaterialReturnItem {
  id: string;
  materialReturnId: string;
  materialIssueItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  issuedQuantity: number;
  previouslyReturnedQuantity: number;
  maxReturnableQuantity: number;
  returnedQuantity: number;
  condition: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
  disposition: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
  unitCost: number;
  totalReturnAmount: number;
  inspectionNotes?: string;
  stockLedgerEntryId?: string;
}

export interface MaterialReturnAudit {
  id: string;
  materialReturnId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Inspected' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
  comments?: string;
  timestampUtc: string;
}

export interface MaterialReturn {
  id: string;
  returnNumber: string;
  materialIssueId: string;
  materialIssueNumber: string;
  requisitionId: string;
  requisitionNumber: string;
  projectId: string;
  projectName: string;
  warehouseId: string;
  warehouseName: string;
  returnDate: string;
  returnedByPerson: string;
  reason: string;
  status: 'Draft' | 'Submitted' | 'Inspected' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
  items: MaterialReturnItem[];
  auditTrail: MaterialReturnAudit[];
  rejectionReason?: string;
  remarks?: string;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  inspectedByUserId?: string;
  inspectedByName?: string;
  inspectedAtUtc?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  postedByUserId?: string;
  postedByName?: string;
  postedAtUtc?: string;
  updatedAtUtc?: string;
}

export interface MaterialReturnListResponse {
  items: MaterialReturn[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CreateMaterialReturnPayload {
  materialIssueId: string;
  returnDate?: string;
  returnedByPerson: string;
  reason: string;
  items: {
    materialIssueItemId: string;
    materialId: string;
    returnedQuantity: number;
    condition?: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
    disposition?: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
    inspectionNotes?: string;
  }[];
  remarks?: string;
}

export const materialReturnService = {
  async getReturns(params?: {
    search?: string;
    status?: string;
    materialIssueId?: string;
    projectId?: string;
    warehouseId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.materialIssueId) searchParams.append('materialIssueId', params.materialIssueId);
    if (params?.projectId) searchParams.append('projectId', params.projectId);
    if (params?.warehouseId) searchParams.append('warehouseId', params.warehouseId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const queryString = searchParams.toString();
    const url = `/material-returns${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<MaterialReturnListResponse | MaterialReturn[]>(url);
  },

  async getReturnById(id: string) {
    return apiClient.get<MaterialReturn>(`/material-returns/${id}`);
  },

  async createReturn(payload: CreateMaterialReturnPayload) {
    return apiClient.post<MaterialReturn>('/material-returns', payload);
  },

  async updateReturn(id: string, payload: Partial<CreateMaterialReturnPayload>) {
    return apiClient.put<MaterialReturn>(`/material-returns/${id}`, payload);
  },

  async inspectReturn(
    id: string,
    items?: {
      id?: string;
      materialId?: string;
      condition?: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
      disposition?: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
      inspectionNotes?: string;
    }[],
    comments?: string
  ) {
    return apiClient.post<MaterialReturn>(`/material-returns/${id}/inspect`, { items, comments });
  },

  async approveReturn(id: string, comments?: string) {
    return apiClient.post<MaterialReturn>(`/material-returns/${id}/approve`, { comments });
  },

  async postReturn(id: string) {
    return apiClient.post<MaterialReturn>(`/material-returns/${id}/post`);
  },

  async getReturnHistory(id: string) {
    return apiClient.get<MaterialReturnAudit[]>(`/material-returns/${id}/history`);
  },
};
