import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h2>
        {detail ? <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p> : null}
      </div>
    </div>
  );
}
