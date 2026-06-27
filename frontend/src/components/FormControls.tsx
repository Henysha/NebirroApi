import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const fieldClass =
  'w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-50 outline-none transition placeholder:text-slate-400 hover:border-slate-500 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-400/30';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const className =
    variant === 'primary'
      ? 'bg-indigo-200 text-slate-950 shadow-lg shadow-indigo-950/20 hover:bg-white'
      : 'border border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:bg-slate-700';

  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</span>
      {children}
    </label>
  );
}
