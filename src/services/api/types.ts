/**
 * Standard API Request & Response Contracts
 * Aligned with ASP.NET Core .NET 10 Web API envelopes
 */

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
  timestampUtc: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiError {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
  timestampUtc: string;
}
