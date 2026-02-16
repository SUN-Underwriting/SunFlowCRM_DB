/**
 * Format a number as currency using Intl.NumberFormat.
 * Handles currency code -> proper symbol display.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USD'
): string {
  const num = value ?? 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${num.toLocaleString()}`;
  }
}
