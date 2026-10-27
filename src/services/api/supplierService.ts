import { apiClient } from './apiClient';
import { PaginatedResult } from './types';

export interface SupplierDto {
  id: string;
  supplierCode: string;
  normalizedSupplierCode?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxReference?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
  createdByUserId?: string;
}

export interface CreateSupplierPayload {
  supplierCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxReference?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateSupplierPayload {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxReference?: string;
  paymentTerms?: string;
  notes?: string;
}

export const supplierService = {
  async getSuppliers(params?: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<SupplierDto[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());

    const queryString = query.toString();
    const endpoint = queryString ? `/suppliers?${queryString}` : '/suppliers';
    const res = await apiClient.get<SupplierDto[] | PaginatedResult<SupplierDto>>(endpoint);
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return (res.data as PaginatedResult<SupplierDto>).items || [];
  },

  async getSupplierById(id: string): Promise<SupplierDto> {
    const res = await apiClient.get<SupplierDto>(`/suppliers/${encodeURIComponent(id)}`);
    return res.data;
  },

  async createSupplier(payload: CreateSupplierPayload): Promise<SupplierDto> {
    const res = await apiClient.post<SupplierDto>('/suppliers', payload);
    return res.data;
  },

  async updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<SupplierDto> {
    const res = await apiClient.put<SupplierDto>(`/suppliers/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  async updateSupplierStatus(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
    const res = await apiClient.patch<{ id: string; isActive: boolean }>(`/suppliers/${encodeURIComponent(id)}/status`, { isActive });
    return res.data;
  },

  async getSupplierPurchaseOrders(id: string): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/suppliers/${encodeURIComponent(id)}/purchase-orders`);
    return res.data;
  },
};
