import { apiClient } from './apiClient';
import { ApiResponse, PaginatedResult } from './types';

export type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'ReturnedForCorrection' | 'PartiallyFulfilled' | 'FullyFulfilled';
export type RequisitionPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ProjectDto {
  id: string;
  code: string;
  name: string;
  location: string;
  projectManagerId: string;
  projectManagerName: string;
  isActive: boolean;
  startDate?: string;
  targetCompletionDate?: string;
}

export interface RequisitionItemDto {
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
  stockAvailabilityNote: string;
}

export interface ApprovalHistoryEntryDto {
  id: string;
  requisitionId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Rejected' | 'ReturnedForCorrection';
  comments?: string;
  timestampUtc: string;
}

export interface MaterialRequisitionDto {
  id: string;
  requisitionNumber: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  requesterUserId: string;
  requesterName: string;
  requesterRole: string;
  requiredDate: string;
  priority: RequisitionPriority;
  purpose: string;
  workActivity?: string;
  siteLocationDetail?: string;
  status: RequisitionStatus;
  items: RequisitionItemDto[];
  approvalHistory: ApprovalHistoryEntryDto[];
  rejectionReason?: string;
  correctionNotes?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface CreateRequisitionPayload {
  projectId: string;
  requiredDate: string;
  priority?: RequisitionPriority;
  purpose: string;
  workActivity?: string;
  siteLocationDetail?: string;
  items: {
    materialId: string;
    requestedQuantity: number;
    remarks?: string;
  }[];
  submitImmediately?: boolean;
  initialComments?: string;
}

export interface UpdateRequisitionPayload {
  projectId?: string;
  requiredDate?: string;
  priority?: RequisitionPriority;
  purpose?: string;
  workActivity?: string;
  siteLocationDetail?: string;
  items?: {
    id?: string;
    materialId: string;
    requestedQuantity: number;
    remarks?: string;
  }[];
  updateComments?: string;
}

export const requisitionService = {
  async getProjects(): Promise<ProjectDto[]> {
    const res = await apiClient.get<ProjectDto[]>('/projects');
    return res.data;
  },

  async getRequisitions(params?: {
    search?: string;
    status?: string;
    projectId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<MaterialRequisitionDto>> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.projectId && params.projectId !== 'ALL') query.set('projectId', params.projectId);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());

    const queryString = query.toString();
    const endpoint = queryString ? `/requisitions?${queryString}` : '/requisitions';
    const res = await apiClient.get<PaginatedResult<MaterialRequisitionDto>>(endpoint);
    return res.data;
  },

  async getRequisitionById(id: string): Promise<MaterialRequisitionDto> {
    const res = await apiClient.get<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}`);
    return res.data;
  },

  async createRequisition(payload: CreateRequisitionPayload): Promise<MaterialRequisitionDto> {
    const res = await apiClient.post<MaterialRequisitionDto>('/requisitions', payload);
    return res.data;
  },

  async updateRequisition(id: string, payload: UpdateRequisitionPayload): Promise<MaterialRequisitionDto> {
    const res = await apiClient.put<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  async submitRequisition(id: string, comments?: string): Promise<MaterialRequisitionDto> {
    const res = await apiClient.post<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}/submit`, { comments });
    return res.data;
  },

  async approveRequisition(id: string, comments?: string): Promise<MaterialRequisitionDto> {
    const res = await apiClient.post<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}/approve`, { comments });
    return res.data;
  },

  async rejectRequisition(id: string, reason: string): Promise<MaterialRequisitionDto> {
    const res = await apiClient.post<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}/reject`, { reason });
    return res.data;
  },

  async returnForCorrection(id: string, notes: string): Promise<MaterialRequisitionDto> {
    const res = await apiClient.post<MaterialRequisitionDto>(`/requisitions/${encodeURIComponent(id)}/return-for-correction`, { notes });
    return res.data;
  },

  async getApprovalInbox(): Promise<MaterialRequisitionDto[]> {
    const res = await apiClient.get<MaterialRequisitionDto[]>('/approvals/inbox');
    return res.data;
  },

  async deleteRequisition(id: string): Promise<void> {
    await apiClient.delete<null>(`/requisitions/${encodeURIComponent(id)}`);
  },

  async getFulfillmentDetails(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/requisitions/${encodeURIComponent(id)}/fulfillment`);
    return res.data;
  },
};
