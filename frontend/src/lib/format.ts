export function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format(amount / 100);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
