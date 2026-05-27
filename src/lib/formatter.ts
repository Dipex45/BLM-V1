export function formatCurrency(amount: number, currency: string = 'NGN', symbol: string = '₦'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return `${symbol} ${formatted}`;
}

export function truncateId(id: string, length: number = 6): string {
  if (!id) return '';
  return id.slice(-length).toUpperCase();
}
