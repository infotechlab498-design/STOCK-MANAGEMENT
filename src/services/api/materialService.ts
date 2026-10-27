/**
 * Material Master Management API Service
 * Interacts with .NET 10 / Node.js API endpoints backed by thread-safe atomic local JSON storage.
 * Frontend never accesses JSON files directly.
 */

import { apiClient } from './apiClient';
import { ApiResponse } from './types';

export interface Material {
  id: string;
  itemCode: string;
  normalizedItemCode: string;
  name: string;
  description?: string;
  specification?: string;
  categoryId: string;
  categoryName: string;
  baseUnitId: string;
  baseUnitName: string;
  minimumStockLevel: number;
  reorderLevel: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}

export interface MaterialCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

export interface UnitConversion {
  id: string;
  materialId?: string;
  fromUnitId: string;
  fromUnitCode: string;
  toUnitId: string;
  toUnitCode: string;
  conversionFactor: number;
  description?: string;
  isActive: boolean;
}

export interface CreateMaterialPayload {
  itemCode: string;
  name: string;
  description?: string;
  specification?: string;
  categoryId: string;
  baseUnitId: string;
  minimumStockLevel: number;
  reorderLevel: number;
}

export interface UpdateMaterialPayload {
  name: string;
  description?: string;
  specification?: string;
  categoryId: string;
  baseUnitId: string;
  minimumStockLevel: number;
  reorderLevel: number;
}

export const materialService = {
  /**
   * Query all material records with optional search, category, and status filters
   */
  getMaterials: async (search?: string, categoryId?: string, status?: string): Promise<ApiResponse<Material[]>> => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append('search', search.trim());
    if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
    if (status && status !== 'ALL') params.append('status', status);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Material[]>(`/api/materials${queryString}`);
  },

  /**
   * Fetch single material record by unique GUID/ID
   */
  getMaterialById: async (id: string): Promise<ApiResponse<Material>> => {
    return apiClient.get<Material>(`/api/materials/${encodeURIComponent(id)}`);
  },

  /**
   * Create a new material SKU with unique ItemCode and validated stock thresholds
   */
  createMaterial: async (payload: CreateMaterialPayload): Promise<ApiResponse<Material>> => {
    return apiClient.post<Material>('/api/materials', payload);
  },

  /**
   * Update an existing material's specifications and stock parameters
   */
  updateMaterial: async (id: string, payload: UpdateMaterialPayload): Promise<ApiResponse<Material>> => {
    return apiClient.put<Material>(`/api/materials/${encodeURIComponent(id)}`, payload);
  },

  /**
   * Activate or deactivate a material's operational availability
   */
  updateMaterialStatus: async (id: string, isActive: boolean): Promise<ApiResponse<{ id: string; isActive: boolean }>> => {
    return apiClient.patch<{ id: string; isActive: boolean }>(`/api/materials/${encodeURIComponent(id)}/status`, { isActive });
  },

  /**
   * Fetch master list of material categories
   */
  getCategories: async (): Promise<ApiResponse<MaterialCategory[]>> => {
    return apiClient.get<MaterialCategory[]>('/api/material-categories');
  },

  /**
   * Create a new material category
   */
  createCategory: async (payload: { code: string; name: string; description?: string }): Promise<ApiResponse<MaterialCategory>> => {
    return apiClient.post<MaterialCategory>('/api/material-categories', payload);
  },

  /**
   * Fetch master list of units of measure (UoM)
   */
  getUnits: async (): Promise<ApiResponse<UnitOfMeasure[]>> => {
    return apiClient.get<UnitOfMeasure[]>('/api/units');
  },

  /**
   * Fetch unit conversions, optionally filtered by specific material ID
   */
  getUnitConversions: async (materialId?: string): Promise<ApiResponse<UnitConversion[]>> => {
    const queryString = materialId ? `?materialId=${encodeURIComponent(materialId)}` : '';
    return apiClient.get<UnitConversion[]>(`/api/unit-conversions${queryString}`);
  },
};
