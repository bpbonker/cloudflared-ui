import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, ScrollText, Settings, LogOut, Cloud } from 'lucide-react';
import clsx from 'clsx';
import { auth } from '../lib/api';

const ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/subdomains', label: 'Subdomains', icon: Globe },
  { to: '/logs',       label: 'Logs',       icon: ScrollText },
  { to: '/settings',   label: 'Settings',   icon: Settings },
];

export default function Nav({ children }) {
  const navigate = useNavigate();
  function logout() {
    auth.clear();
    navigate('/login');
  }

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-ink-200 px-4 py-6">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Cloud size={20} />
          </div>
          <div>
            <div className="font-semibold leading-tight">Tunnel Manager</div>
            <div className="text-xs text-ink-500">Cloudflare</div>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50')
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="btn-ghost justify-start text-ink-600">
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-ink-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
            <Cloud size={16} />
          </div>
          <div className="font-semibold">Tunnel Manager</div>
        </div>
        <button onClick={logout} aria-label="Sign out" className="text-ink-600 p-2">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-200 safe-bottom">
        <ul className="grid grid-cols-4">
          {ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  clsx('flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium',
                    isActive ? 'text-brand-700' : 'text-ink-500')
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
