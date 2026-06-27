import { NavLink, Outlet } from 'react-router-dom';
import { maskApiKey, useApiKey } from './lib/auth';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/partners', label: 'Partners' },
  { to: '/api-keys', label: 'API Keys' },
  { to: '/customers', label: 'Customers' },
  { to: '/wallets', label: 'Wallets' },
  { to: '/transfers', label: 'Transfers' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/webhooks', label: 'Webhook Events' },
  { to: '/sdk', label: 'Developer SDK' },
];

export function App() {
  const { apiKey, setActiveApiKey, clearApiKey } = useApiKey();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#312e81,transparent_32rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-700/80 bg-slate-950/95 p-6 shadow-2xl shadow-black/30 backdrop-blur md:block">
        <div className="text-xl font-bold tracking-tight text-white">NebirroAPI</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Programmable financial infrastructure for trusted capital networks.
        </p>
        <nav className="mt-10 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-indigo-200 text-slate-950 shadow-lg shadow-indigo-950/30'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="md:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-700/80 bg-slate-950/90 shadow-xl shadow-black/10 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-200">Developer Console</p>
              <p className="mt-1 text-sm font-medium text-slate-300">
                API base URL: http://localhost:3000/api · {apiKey ? 'Active API key restored' : 'No active API key'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span
                className={`rounded-full border px-3 py-2 text-xs font-bold ${
                  apiKey
                    ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-50'
                    : 'border-amber-300/40 bg-amber-400/15 text-amber-50'
                }`}
              >
                {apiKey ? `Active: ${maskApiKey(apiKey)}` : 'API key required'}
              </span>
              <input
                data-testid="active-api-key-input"
                value={apiKey}
                onChange={(event) => setActiveApiKey(event.target.value)}
                placeholder="Paste active x-api-key"
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm font-medium text-white outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-400/30 sm:w-96"
              />
              <button
                type="button"
                onClick={clearApiKey}
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Clear
              </button>
            </div>
            <p className="text-xs font-medium text-slate-300 lg:hidden">{maskApiKey(apiKey)}</p>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
