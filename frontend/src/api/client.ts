import axios, { AxiosError } from 'axios';
import type {
  User,
  Product,
  Category,
  DashboardSummary,
  Sale,
  PaginatedResponse,
  StockAdjustPayload,
  StockMovement,
  ProductFormData,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token if present in localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: redirect to /login on 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post<{ access_token: string; token_type: string; user: User }>(
      '/auth/login',
      { email, password }
    );
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

// -------------------------------------------------------------
// Dashboard API
// -------------------------------------------------------------
export const dashboardApi = {
  getSummary: async (days: number = 7) => {
    const response = await apiClient.get<DashboardSummary>(`/dashboard/summary?days=${days}`);
    return response.data;
  },
};

// -------------------------------------------------------------
// Products API
// -------------------------------------------------------------
export interface ProductListParams {
  search?: string;
  category_id?: number;
  low_stock?: boolean;
  page?: number;
  page_size?: number;
  include_inactive?: boolean;
}

export const productsApi = {
  list: async (params: ProductListParams = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category_id) query.append('category_id', String(params.category_id));
    if (params.low_stock) query.append('low_stock', 'true');
    if (params.page) query.append('page', String(params.page));
    if (params.page_size) query.append('page_size', String(params.page_size));
    if (params.include_inactive) query.append('include_inactive', 'true');

    const response = await apiClient.get<PaginatedResponse<Product>>(`/products?${query.toString()}`);
    return response.data;
  },
  getById: async (id: number) => {
    const response = await apiClient.get<Product>(`/products/${id}`);
    return response.data;
  },
  create: async (data: ProductFormData) => {
    const response = await apiClient.post<Product>('/products', data);
    return response.data;
  },
  update: async (id: number, data: Partial<ProductFormData & { is_active?: boolean }>) => {
    const response = await apiClient.put<Product>(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await apiClient.delete<{ message: string }>(`/products/${id}`);
    return response.data;
  },
  adjustStock: async (id: number, payload: StockAdjustPayload) => {
    const response = await apiClient.post<Product>(`/products/${id}/stock`, payload);
    return response.data;
  },
  getMovements: async (id: number) => {
    const response = await apiClient.get<StockMovement[]>(`/products/${id}/movements`);
    return response.data;
  },
};

// -------------------------------------------------------------
// Categories API
// -------------------------------------------------------------
export const categoriesApi = {
  list: async () => {
    const response = await apiClient.get<Category[]>('/categories');
    return response.data;
  },
  create: async (name: string) => {
    const response = await apiClient.post<Category>('/categories', { name });
    return response.data;
  },
};

// -------------------------------------------------------------
// Sales API
// -------------------------------------------------------------
export interface CreateSalePayload {
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
}

export interface SaleListParams {
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

export const salesApi = {
  create: async (payload: CreateSalePayload) => {
    const response = await apiClient.post<Sale>('/sales', payload);
    return response.data;
  },
  list: async (params: SaleListParams = {}) => {
    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.page) query.append('page', String(params.page));
    if (params.page_size) query.append('page_size', String(params.page_size));

    const response = await apiClient.get<PaginatedResponse<Sale>>(`/sales?${query.toString()}`);
    return response.data;
  },
};

// -------------------------------------------------------------
// Export API (blob download with auth headers)
// -------------------------------------------------------------
export const exportApi = {
  downloadProductsCsv: async () => {
    const response = await apiClient.get('/export/products.csv', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'products.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadSalesCsv: async (fromDate?: string, toDate?: string) => {
    const query = new URLSearchParams();
    if (fromDate) query.append('from', fromDate);
    if (toDate) query.append('to', toDate);

    const response = await apiClient.get(`/export/sales.csv?${query.toString()}`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_${fromDate || 'all'}_to_${toDate || 'today'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
