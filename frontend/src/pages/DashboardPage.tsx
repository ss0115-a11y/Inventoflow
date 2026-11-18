import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Percent,
  AlertTriangle,
  PlusCircle,
  RefreshCw,
  PackageCheck,
  Award,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../api/client';
import type { DashboardSummary, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { Badge } from '../components/UI/Badge';
import { SkeletonCard, SkeletonChart } from '../components/UI/Skeleton';
import { AddStockModal } from '../components/Modals/AddStockModal';
import { useToast } from '../context/ToastContext';

export const DashboardPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { theme } = useTheme();
  const { showError } = useToast();

  const [days, setDays] = useState<number>(7);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Selected product for Add Stock modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);

  const fetchSummary = useCallback(async (selectedDays: number, showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await dashboardApi.getSummary(selectedDays);
      setSummary(data);
    } catch (err: any) {
      showError('Failed to load dashboard', err.response?.data?.detail || 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchSummary(days);
  }, [days, fetchSummary]);

  const handleStockAdded = () => {
    fetchSummary(days, false);
  };

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time sales velocity, key metrics, and stock alerts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 7d / 30d Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                days === 7
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                days === 30
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={() => fetchSummary(days, false)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: isAdmin ? 5 : 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Revenue Today */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Revenue Today
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary?.revenue_today)}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <span>Today's gross sales</span>
              </p>
            </div>
          </div>

          {/* Revenue 7 Days */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Revenue (7 Days)
              </span>
              <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary?.revenue_7d)}
              </div>
              <p className="text-xs text-slate-400 mt-1">Past 7 days volume</p>
            </div>
          </div>

          {/* Revenue 30 Days */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Revenue (30 Days)
              </span>
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(summary?.revenue_30d)}
              </div>
              <p className="text-xs text-slate-400 mt-1">Past 30 days volume</p>
            </div>
          </div>

          {/* ADMIN ONLY: Gross Profit */}
          {isAdmin && summary?.profit !== undefined && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Gross Profit ({days}d)
                </span>
                <Badge variant="indigo" size="sm">Admin</Badge>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-200 tracking-tight">
                  {formatCurrency(summary.profit)}
                </div>
                <p className="text-xs text-indigo-500/80 dark:text-indigo-400/80 mt-1">
                  Revenue minus unit costs
                </p>
              </div>
            </div>
          )}

          {/* ADMIN ONLY: Margin % */}
          {isAdmin && summary?.margin_percent !== undefined && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Margin ({days}d)
                </span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-200 tracking-tight">
                  {formatPercent(summary.margin_percent)}
                </div>
                <p className="text-xs text-indigo-500/80 dark:text-indigo-400/80 mt-1">
                  Net profit margin
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Analytics Row: Daily Trend Area Chart & Top 5 Sellers Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Trend Area Chart (spans 2 columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Daily Sales Trend
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Revenue trajectory over the past {days} days
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
              <span>Revenue</span>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <SkeletonChart />
            ) : !summary?.daily_trend || summary.daily_trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No trend data available for this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.daily_trend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={textColor}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      try {
                        const parts = val.split('-');
                        return `${parts[1]}/${parts[2]}`;
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis
                    stroke={textColor}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                      return `₹${val}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#trendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 Best Sellers Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Top 5 Sellers</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Ranked by units sold</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {loading ? (
              <SkeletonChart />
            ) : !summary?.top_products || summary.top_products.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
                <PackageCheck className="w-8 h-8 mb-2 opacity-50" />
                <span>No sales recorded yet</span>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.top_products.map((item, index) => {
                  const maxQty = Math.max(...summary.top_products.map((p) => p.quantity_sold), 1);
                  const pct = Math.round((item.quantity_sold / maxQty) * 100);
                  const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#38bdf8', '#34d399'];

                  return (
                    <div key={item.product_id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {index + 1}. {item.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.quantity_sold} sold
                          </span>
                          <span className="text-slate-400">({formatCurrency(item.revenue)})</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: colors[index % colors.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Panel */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Low Stock Alert Panel
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Items requiring restock (stock on hand ≤ configured threshold)
              </p>
            </div>
          </div>
          {summary?.low_stock && (
            <Badge variant={summary.low_stock.length > 0 ? 'amber' : 'emerald'} size="md">
              {summary.low_stock.length} item{summary.low_stock.length === 1 ? '' : 's'} flagged
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !summary?.low_stock || summary.low_stock.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-emerald-200 dark:border-emerald-900/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20">
            <PackageCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Inventory Healthy
            </h4>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
              All active products are above their minimum stock thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Product</th>
                  <th className="pb-3">SKU</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Stock Level</th>
                  <th className="pb-3">Threshold</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {summary.low_stock.map((item) => {
                  const isOutOfStock = item.stock <= 0;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 pl-2 font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.sku}
                      </td>
                      <td className="py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.category?.name || 'General'}
                      </td>
                      <td className="py-3.5 font-bold">
                        <span className={isOutOfStock ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}>
                          {item.stock} units
                        </span>
                      </td>
                      <td className="py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        ≤ {item.low_stock_threshold}
                      </td>
                      <td className="py-3.5">
                        <Badge
                          variant={isOutOfStock ? 'rose' : 'amber'}
                          size="sm"
                          dot
                        >
                          {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <button
                          onClick={() => setStockModalProduct(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-300 text-xs font-semibold transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Stock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={!!stockModalProduct}
        product={stockModalProduct}
        onClose={() => setStockModalProduct(null)}
        onSuccess={handleStockAdded}
      />
    </div>
  );
};
