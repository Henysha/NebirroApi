const resources = [
  'Partners and API keys',
  'Customers and wallets',
  'Ledger-derived balances',
  'Funding and transfers',
  'Webhook endpoints and events',
];

export function DevelopersPage() {
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Developer Console</h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        A clean operational surface for partners to onboard, manage API keys, inspect balances,
        and trace every capital movement through immutable ledger entries.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {resources.map((resource) => (
          <div key={resource} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-lg font-medium">{resource}</div>
            <p className="mt-2 text-sm text-slate-400">
              Foundation route and service boundaries are ready for iterative build-out.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
