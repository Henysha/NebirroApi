const stats = [
  { label: 'API surface', value: '18 routes' },
  { label: 'Ledger model', value: 'Append-only' },
  { label: 'Auth', value: 'API keys' },
  { label: 'Idempotency', value: 'Transfers' },
];

export function DashboardPage() {
  return (
    <section>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-indigo-300">
          Trusted capital networks
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Build programmable money movement with wallets, ledgers, transfers, and webhooks.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          NebirroAPI gives partners a Stripe-style infrastructure layer for creating customers,
          issuing wallets, funding balances, moving value, and receiving event callbacks.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm text-slate-400">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
