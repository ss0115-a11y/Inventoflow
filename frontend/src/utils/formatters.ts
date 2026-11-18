const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY || '₹';

/**
 * Format any numeric or Decimal string value into currency with configurable symbol
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return `${CURRENCY_SYMBOL}0.00`;
  }

  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) {
    return `${CURRENCY_SYMBOL}0.00`;
  }

  const isNegative = num < 0;
  const absValue = Math.abs(num);

  const formatted = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${CURRENCY_SYMBOL}${formatted}` : `${CURRENCY_SYMBOL}${formatted}`;
}

/**
 * Format percentage value (e.g. 15.4 -> "15.4%")
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0.0%';
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
}

/**
 * Format date to short readable string
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date & time to readable string
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
