import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Download,
  Edit2,
  Trash2,
  PlusCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { productsApi, categoriesApi, exportApi } from '../api/client';
import type { Product, Category } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { Badge } from '../components/UI/Badge';
import { SkeletonTable } from '../components/UI/Skeleton';
import { EmptyState } from '../components/UI/EmptyState';
import { AddStockModal } from '../components/Modals/AddStockModal';
import { AddEditProductModal } from '../components/Modals/AddEditProductModal';
import { useToast } from '../context/ToastContext';

export const InventoryPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modal States
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Delete Confirmation state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.list();
      setCategories(cats);
    } catch {
      // Ignore initial category fetch error
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productsApi.list({
        search: search.trim() || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        low_stock: lowStockOnly ? true : undefined,
        page,
        page_size: pageSize,
      });
      setProducts(data.items);
      setTotalPages(data.pages);
      setTotalCount(data.total);
    } catch (err: any) {
      showError('Failed to fetch inventory', err.response?.data?.detail || 'Error loading products');
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, lowStockOnly, page, pageSize, showError]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await exportApi.downloadProductsCsv();
      showSuccess('Export Successful', 'products.csv downloaded');
    } catch (err: any) {
      showError('Export Failed', err.response?.data?.detail || 'Could not export products');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to deactivate this product?')) {
      return;
    }

    try {
      setDeletingId(id);
      await productsApi.delete(id);
      showSuccess('Product Deactivated', 'Item was marked inactive');
      fetchProducts();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.detail || 'Could not delete product');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalCount} total product{totalCount === 1 ? '' : 's'} in catalog
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Admin only: Export CSV */}
          {isAdmin && (
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              ) : (
                <Download className="w-4 h-4 text-brand-600" />
              )}
              <span>Export CSV</span>
            </button>
          )}

          {/* Admin only: Add Product */}
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}

          <button
            onClick={() => fetchProducts()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product or SKU..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative w-full sm:w-56">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Filter */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded-md text-brand-600 focus:ring-brand-500 w-4 h-4"
            />
            <span>Low Stock Only</span>
          </label>
        </div>

        {(search || categoryId || lowStockOnly) && (
          <button
            onClick={() => {
              setSearch('');
              setCategoryId('');
              setLowStockOnly(false);
              setPage(1);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Products Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={8} columns={isAdmin ? 7 : 6} />
          </div>
        ) : products.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Products Found"
              description="No inventory items match your current search and filter criteria."
              action={
                search || categoryId || lowStockOnly
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearch('');
                        setCategoryId('');
                        setLowStockOnly(false);
                      },
                    }
                  : isAdmin
                  ? {
                      label: 'Add First Product',
                      onClick: () => setShowAddModal(true),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-6">Product Details</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Price</th>
                  {/* ADMIN ONLY: Cost price column */}
                  {isAdmin && <th className="py-3.5 px-3">Cost Price</th>}
                  <th className="py-3.5 px-3">Stock Level</th>
                  <th className="py-3.5 px-3">Threshold</th>
                  <th className="py-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {products.map((p) => {
                  const isLow = p.stock <= p.low_stock_threshold;
                  const isOut = p.stock <= 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isOut
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/60'
                          : isLow
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Name & SKU */}
                      <td className="py-4 pl-6">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-slate-400">{p.sku}</span>
                          {isOut ? (
                            <Badge variant="rose" size="sm" dot>
                              Out of Stock
                            </Badge>
                          ) : isLow ? (
                            <Badge variant="amber" size="sm" dot>
                              Low Stock
                            </Badge>
                          ) : null}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-3 text-slate-600 dark:text-slate-300 text-xs">
                        {p.category?.name || '—'}
                      </td>

                      {/* Selling Price */}
                      <td className="py-4 px-3 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(p.price)}
                      </td>

                      {/* ADMIN ONLY: Cost Column */}
                      {isAdmin && (
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                          {p.cost !== undefined ? formatCurrency(p.cost) : '—'}
                        </td>
                      )}

                      {/* Stock Level */}
                      <td className="py-4 px-3">
                        <span
                          className={`font-bold ${
                            isOut
                              ? 'text-rose-600 dark:text-rose-400'
                              : isLow
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {p.stock} units
                        </span>
                      </td>

                      {/* Low Stock Threshold */}
                      <td className="py-4 px-3 text-xs text-slate-400 font-mono">
                        ≤ {p.low_stock_threshold}
                      </td>

                      {/* Actions */}
                      <td className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Add Stock (available to all roles) */}
                          <button
                            onClick={() => setStockModalProduct(p)}
                            title="Add stock"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-300 text-xs font-semibold transition-colors"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Add Stock</span>
                          </button>

                          {/* Admin Only: Edit Product */}
                          {isAdmin && (
                            <button
                              onClick={() => setEditModalProduct(p)}
                              title="Edit product"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Admin Only: Delete Product */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              disabled={deletingId === p.id}
                              title="Deactivate product"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            >
                              {deletingId === p.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalCount}</span> items
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={!!stockModalProduct}
        product={stockModalProduct}
        onClose={() => setStockModalProduct(null)}
        onSuccess={() => fetchProducts()}
      />

      {/* Add / Edit Product Modal (Admin) */}
      {(showAddModal || !!editModalProduct) && (
        <AddEditProductModal
          isOpen={showAddModal || !!editModalProduct}
          product={editModalProduct}
          categories={categories}
          onClose={() => {
            setShowAddModal(false);
            setEditModalProduct(null);
          }}
          onSuccess={() => {
            fetchProducts();
            fetchCategories();
          }}
          onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
        />
      )}
    </div>
  );
};
