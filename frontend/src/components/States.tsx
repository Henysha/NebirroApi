export function LoadingState({ label = 'Loading data...' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm font-medium text-sky-100">
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-300/35 bg-rose-500/15 p-4 text-sm font-medium leading-6 text-rose-50">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-500 bg-slate-950/60 p-6 text-center text-sm font-medium leading-6 text-slate-200">
      {message}
    </div>
  );
}
