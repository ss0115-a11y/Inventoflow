import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  Receipt,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { productsApi, salesApi } from '../api/client';
import type { Product, Sale, CartItem, Category } from '../types';
import { categoriesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Badge } from '../components/UI/Badge';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/UI/EmptyState';

export const SalesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();

  // Products catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Recent Sales
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState<boolean>(true);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await productsApi.list({
        search: search.trim() || undefined,
        category_id: selectedCat ? Number(selectedCat) : undefined,
        page_size: 50,
      });
      setProducts(data.items);
    } catch {
      // error handled
    } finally {
      setLoadingProducts(false);
    }
  }, [search, selectedCat]);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.list();
      setCategories(cats);
    } catch {
      // error handled
    }
  }, []);

  const fetchRecentSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const data = await salesApi.list({ page: 1, page_size: 10 });
      setRecentSales(data.items);
    } catch {
      // error handled
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchRecentSales();
  }, [fetchCategories, fetchRecentSales]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Cart actions
  const addToCart = (product: Product) => {
    setCheckoutError(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showError('Stock Limit', `Only ${product.stock} units available on hand`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCheckoutError(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              showError('Stock Limit', `Only ${item.product.stock} units available`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCheckoutError(null);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Complete Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    setCheckingOut(true);

    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      };

      const result = await salesApi.create(payload);

      showSuccess(
        'Sale Recorded Successfully!',
        `Order #${result.id} processed for ${formatCurrency(result.total_amount)}`
      );

      // Reset cart and reload catalog + sales
      setCart([]);
      fetchCatalog();
      fetchRecentSales();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d.detail).join(', ')
          : 'Failed to process sale';

      setCheckoutError(errorMsg);
      showError('Sale Rejected', errorMsg);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Point of Sale (POS)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Scan or search products, manage customer basket, and record sales
        </p>
      </div>

      {/* POS Terminal Grid: Products Catalog on Left, Live Cart on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Selection & Catalog (7 or 8 columns) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search & Category Filter */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
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
          </div>

          {/* Product Cards Grid */}
          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <EmptyState
                title="No Products Available"
                description="No products match your current search criteria."
                action={
                  search || selectedCat
                    ? {
                        label: 'Clear Filters',
                        onClick: () => {
                          setSearch('');
                          setSelectedCat('');
                        },
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {products.map((product) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock <= product.low_stock_threshold;

                return (
                  <div
                    key={product.id}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {product.sku}
                        </span>
                        {inCart && (
                          <Badge variant="indigo" size="sm">
                            {inCart.quantity} in cart
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {product.category?.name || 'General'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-base font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(product.price)}
                        </div>
                        <div className="text-[11px] font-medium">
                          {isOutOfStock ? (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              Out of stock
                            </span>
                          ) : isLowStock ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {product.stock} left (Low)
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {product.stock} in stock
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock || (inCart ? inCart.quantity >= product.stock : false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Cart & Live Checkout Panel (5 or 4 columns) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-5 flex flex-col space-y-4">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Current Basket
                  </h2>
                  <p className="text-xs text-slate-400">
                    {cartItemsCount} item{cartItemsCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Error Banner when checkout fails (e.g. Insufficient stock with product name) */}
            {checkoutError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Transaction Failed</p>
                  <p className="mt-0.5 leading-relaxed">{checkoutError}</p>
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click "Add" on any product</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatCurrency(item.product.price)} each
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-1 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-2xs disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(item.product.price) * item.quantity)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[10px] text-rose-500 hover:text-rose-700 mt-0.5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Live Total Summary */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Total Items</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {cartItemsCount}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-1">
                <span>Grand Total</span>
                <span className="text-brand-600 dark:text-brand-400 text-lg">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {checkingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Complete Sale ({formatCurrency(cartTotal)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Sales History Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Sales Orders
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin ? 'All transactions across cashiers' : 'Your sales records'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchRecentSales}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
          >
            Refresh
          </button>
        </div>

        {loadingSales ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentSales.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No recent sales found. Complete a sale above to get started!
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {recentSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;

              return (
                <div key={sale.id} className="py-3">
                  <div
                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        #{sale.id}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{formatDateTime(sale.created_at)}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-slate-500 font-normal">
                            Sold by {sale.user_name || 'Staff'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {sale.items?.length || 0} line item{sale.items?.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(sale.total_amount)}
                        </div>
                        {isAdmin && sale.total_cost !== undefined && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost: {formatCurrency(sale.total_cost)}
                          </div>
                        )}
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Items Receipt details */}
                  {isExpanded && sale.items && sale.items.length > 0 && (
                    <div className="mt-2 ml-4 sm:ml-12 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 animate-in fade-in-50">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Items Purchased
                      </p>
                      <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
                        {sale.items.map((item) => (
                          <div
                            key={item.id}
                            className="py-1.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {item.product_name || `Product #${item.product_id}`}
                              </span>
                              <span className="text-slate-400 ml-2">
                                × {item.quantity} @ {formatCurrency(item.unit_price)}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(item.line_total)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
