export function StatusBadge({ value }: { value: string }) {
  const tone = value.includes('FAILED')
    ? 'border-rose-300/50 bg-rose-500/20 text-rose-50'
    : value.includes('PENDING')
      ? 'border-amber-300/50 bg-amber-400/20 text-amber-50'
      : 'border-emerald-300/50 bg-emerald-400/20 text-emerald-50';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${tone}`}>{value}</span>;
}

export function LedgerBadge({ type }: { type: 'CREDIT' | 'DEBIT' }) {
  const tone =
    type === 'CREDIT'
      ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-50'
      : 'border-sky-300/50 bg-sky-400/20 text-sky-50';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${tone}`}>{type}</span>;
}
