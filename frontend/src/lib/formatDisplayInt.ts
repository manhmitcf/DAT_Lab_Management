/**
 * Stable UI integers: truncate toward zero, pad non-negative values to at least 2 digits (01, 14).
 * Reduces layout shift when realtime metrics update.
 */
export function formatDisplayInt(value: number | string): string {
    const num = typeof value === 'string' ? Number(String(value).replace(/,/g, '')) : value;
    if (!Number.isFinite(num)) return '00';
    const n = Math.trunc(num);
    if (n < 0) return String(n);
    return String(n).padStart(2, '0');
}
