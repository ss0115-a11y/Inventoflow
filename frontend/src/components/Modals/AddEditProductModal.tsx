import React, { useState, useEffect } from 'react';
import { Modal } from '../UI/Modal';
import type { Product, Category, ProductFormData } from '../../types';
import { productsApi, categoriesApi } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Loader2, Plus, Save } from 'lucide-react';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null; // null = create new product
  categories: Category[];
  onSuccess: () => void;
  onCategoryCreated?: (cat: Category) => void;
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  onSuccess,
  onCategoryCreated,
}) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    category_id: null,
    price: 0,
    cost: 0,
    stock: 0,
    low_stock_threshold: 10,
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        category_id: product.category_id,
        price: Number(product.price),
        cost: product.cost !== undefined ? Number(product.cost) : 0,
        stock: product.stock,
        low_stock_threshold: product.low_stock_threshold,
      });
    } else {
      setFormData({
        sku: '',
        name: '',
        category_id: categories.length > 0 ? categories[0].id : null,
        price: 0,
        cost: 0,
        stock: 0,
        low_stock_threshold: 10,
      });
    }
    setShowNewCatInput(false);
  }, [product, categories, isOpen]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await categoriesApi.create(newCatName.trim());
      showSuccess('Category Created', `Added "${created.name}"`);
      if (onCategoryCreated) onCategoryCreated(created);
      setFormData((prev) => ({ ...prev, category_id: created.id }));
      setNewCatName('');
      setShowNewCatInput(false);
    } catch (err: any) {
      showError('Failed to create category', err.response?.data?.detail || 'Error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.sku.trim()) {
      showError('Validation Error', 'Product Name and SKU are required');
      return;
    }

    if (formData.price <= 0) {
      showError('Validation Error', 'Selling price must be greater than zero');
      return;
    }

    if (formData.cost !== undefined && formData.cost < 0) {
      showError('Validation Error', 'Cost price cannot be negative');
      return;
    }

    try {
      setIsSubmitting(true);
      if (product) {
        // Edit existing product
        await productsApi.update(product.id, {
          sku: formData.sku,
          name: formData.name,
          category_id: formData.category_id,
          price: formData.price,
          cost: formData.cost,
          stock: formData.stock,
          low_stock_threshold: formData.low_stock_threshold,
        });
        showSuccess('Product Updated', `Updated ${formData.name}`);
      } else {
        // Create new product
        await productsApi.create({
          sku: formData.sku.trim().toUpperCase(),
          name: formData.name.trim(),
          category_id: formData.category_id,
          price: formData.price,
          cost: formData.cost || 0,
          stock: formData.stock || 0,
          low_stock_threshold: formData.low_stock_threshold || 10,
        });
        showSuccess('Product Created', `Added ${formData.name} to inventory`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save product';
      showError('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      description={
        product
          ? 'Update product details, selling price, and stock parameters'
          : 'Create a new inventory item with pricing and stock levels'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SKU */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              SKU Code *
            </label>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm font-mono"
              placeholder="e.g. ELEC-101"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => setShowNewCatInput(!showNewCatInput)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                {showNewCatInput ? 'Cancel' : 'New'}
              </button>
            </div>
            {showNewCatInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-medium"
                >
                  Add
                </button>
              </div>
            ) : (
              <select
                value={formData.category_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Product Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
            placeholder="e.g. Wireless Ergonomic Mouse"
          />
        </div>

        {/* Pricing: Price & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Selling Price *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.price || ''}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm font-medium"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Cost Price (Admin Only) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.cost || ''}
              onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm font-medium"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Stock & Threshold */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {product ? 'Stock On Hand' : 'Initial Stock Quantity'} *
            </label>
            <input
              type="number"
              min="0"
              required
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Low Stock Alert Threshold *
            </label>
            <input
              type="number"
              min="0"
              required
              value={formData.low_stock_threshold}
              onChange={(e) =>
                setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="10"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-md shadow-brand-500/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{product ? 'Save Changes' : 'Create Product'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
