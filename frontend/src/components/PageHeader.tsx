interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-200">{eyebrow}</p>
      ) : null}
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 md:text-base">{description}</p>
    </div>
  );
}
