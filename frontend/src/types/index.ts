export type UserRole = 'admin' | 'staff';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category?: Category | null;
  price: number | string;
  cost?: number | string; // Optional: omitted by backend for staff users
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  sku: string;
  name: string;
  category_id: number | null;
  price: number;
  cost?: number;
  stock: number;
  low_stock_threshold: number;
}

export interface DailyTrendItem {
  date: string;
  revenue: number | string;
  orders: number;
}

export interface TopProductItem {
  product_id: number;
  name: string;
  sku: string;
  quantity_sold: number;
  revenue: number | string;
}

export interface DashboardSummary {
  revenue_today: number | string;
  revenue_7d: number | string;
  revenue_30d: number | string;
  profit?: number | string; // Optional: omitted for staff
  margin_percent?: number | string; // Optional: omitted for staff
  daily_trend: DailyTrendItem[];
  top_products: TopProductItem[];
  low_stock: Product[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name?: string | null;
  product_sku?: string | null;
  quantity: number;
  unit_price: number | string;
  unit_cost?: number | string; // Optional: omitted for staff
  line_total: number | string;
}

export interface Sale {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  total_amount: number | string;
  total_cost?: number | string; // Optional: omitted for staff
  created_at: string;
  items: SaleItem[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface StockAdjustPayload {
  type: 'purchase' | 'adjustment';
  quantity: number;
  reason?: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  user_id: number | null;
  type: 'purchase' | 'sale' | 'adjustment';
  quantity: number;
  reason: string | null;
  created_at: string;
  user_name?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
