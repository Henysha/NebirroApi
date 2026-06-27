import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/developers', label: 'Developers' },
];

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-slate-950/95 p-6 md:block">
        <div className="text-xl font-semibold tracking-tight">NebirroAPI</div>
        <p className="mt-2 text-sm text-slate-400">
          Programmable financial infrastructure for trusted capital networks.
        </p>
        <nav className="mt-10 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-3 text-sm ${
                  isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="md:pl-72">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
