import { apiClient } from './apiClient';

export interface MaterialIssueItem {
  id: string;
  materialIssueId: string;
  requisitionItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  requestedQuantity: number;
  previouslyFulfilledQuantity: number;
  outstandingQuantity: number;
  quantityToIssue: number;
  actualIssuedQuantity?: number;
  previouslyReturnedQuantity?: number;
  unitCost?: number;
  totalIssuedAmount?: number;
  storageLocation?: string;
  remarks?: string;
  stockLedgerEntryId?: string;
}

export interface MaterialIssueAudit {
  id: string;
  materialIssueId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'ReturnedForCorrection' | 'Cancelled';
  comments?: string;
  timestampUtc: string;
}

export interface MaterialIssue {
  id: string;
  issueNumber: string;
  requisitionId: string;
  requisitionNumber: string;
  projectId: string;
  projectName: string;
  warehouseId: string;
  warehouseName: string;
  issueDate: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'ReturnedForCorrection' | 'Cancelled';
  purpose: string;
  workActivity?: string;
  receivedByPerson: string;
  items: MaterialIssueItem[];
  auditTrail: MaterialIssueAudit[];
  rejectionReason?: string;
  correctionNotes?: string;
  remarks?: string;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  submittedByUserId?: string;
  submittedByName?: string;
  submittedAtUtc?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  postedByUserId?: string;
  postedByName?: string;
  postedAtUtc?: string;
  updatedAtUtc?: string;
}

export interface MaterialIssueListResponse {
  items: MaterialIssue[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CreateMaterialIssuePayload {
  requisitionId: string;
  warehouseId: string;
  purpose: string;
  workActivity?: string;
  receivedByPerson: string;
  issueDate?: string;
  items: {
    requisitionItemId: string;
    materialId: string;
    quantityToIssue: number;
    storageLocation?: string;
    remarks?: string;
  }[];
  remarks?: string;
  submitImmediately?: boolean;
}

export const materialIssueService = {
  async getIssues(params?: {
    search?: string;
    status?: string;
    requisitionId?: string;
    projectId?: string;
    warehouseId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.requisitionId) searchParams.append('requisitionId', params.requisitionId);
    if (params?.projectId) searchParams.append('projectId', params.projectId);
    if (params?.warehouseId) searchParams.append('warehouseId', params.warehouseId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const queryString = searchParams.toString();
    const url = `/material-issues${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<MaterialIssueListResponse | MaterialIssue[]>(url);
  },

  async getIssueById(id: string) {
    return apiClient.get<MaterialIssue>(`/material-issues/${id}`);
  },

  async createIssue(payload: CreateMaterialIssuePayload) {
    return apiClient.post<MaterialIssue>('/material-issues', payload);
  },

  async updateIssue(id: string, payload: Partial<CreateMaterialIssuePayload>) {
    return apiClient.put<MaterialIssue>(`/material-issues/${id}`, payload);
  },

  async submitIssue(id: string) {
    return apiClient.post<MaterialIssue>(`/material-issues/${id}/submit`);
  },

  async approveIssue(id: string, comments?: string) {
    return apiClient.post<MaterialIssue>(`/material-issues/${id}/approve`, { comments });
  },

  async rejectIssue(id: string, reason: string) {
    return apiClient.post<MaterialIssue>(`/material-issues/${id}/reject`, { rejectionReason: reason });
  },

  async returnForCorrection(id: string, notes: string) {
    return apiClient.post<MaterialIssue>(`/material-issues/${id}/return-for-correction`, { correctionNotes: notes });
  },

  async postIssue(id: string) {
    return apiClient.post<MaterialIssue>(`/material-issues/${id}/post`);
  },

  async getIssueHistory(id: string) {
    return apiClient.get<MaterialIssueAudit[]>(`/material-issues/${id}/history`);
  },
};
