import React, { useState } from 'react';
import { Modal } from '../UI/Modal';
import type { Product } from '../../types';
import { productsApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PlusCircle, Loader2 } from 'lucide-react';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export const AddStockModal: React.FC<AddStockModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const [quantity, setQuantity] = useState<number>(10);
  const [type, setType] = useState<'purchase' | 'adjustment'>('purchase');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      showError('Invalid Quantity', 'Please enter a positive quantity to add');
      return;
    }

    try {
      setIsSubmitting(true);
      await productsApi.adjustStock(product.id, {
        type,
        quantity: Number(quantity),
        reason: reason.trim() || `${type === 'purchase' ? 'Stock Restock' : 'Inventory Adjustment'}`,
      });
      showSuccess('Stock Updated', `Added ${quantity} units to ${product.name}`);
      onSuccess();
      onClose();
      setQuantity(10);
      setReason('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update stock';
      showError('Stock Update Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Inventory Stock"
      description={`Increase current on-hand units for ${product.name} (SKU: ${product.sku})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Stock Info Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Current Stock</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {product.stock} units
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">Low Stock Alert</p>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              ≤ {product.low_stock_threshold} units
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Quantity to Add *
          </label>
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm font-medium"
            placeholder="e.g. 25"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Movement Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'purchase' | 'adjustment')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
          >
            <option value="purchase">Purchase (New Stock In)</option>
            <option value="adjustment">Adjustment (Correction / Audit)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Reason / Notes (Optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
            placeholder="e.g. Received shipment PO-4091"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            <span>Add Stock</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
