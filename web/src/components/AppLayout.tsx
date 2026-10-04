import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { OfflineBanner } from './OfflineBanner';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MoreHorizontal,
  BarChart3,
  ShoppingBag,
  Users,
  Layers,
  Settings,
  LogOut,
  Bot,
} from 'lucide-react';
import { clsx } from 'clsx';

const BOTTOM_TABS = [
  { to: '/sell', label: 'nav.sell', icon: ShoppingCart },
  { to: '/products', label: 'nav.products', icon: Package },
  { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/more', label: 'nav.more', icon: MoreHorizontal },
];

const SIDEBAR_LINKS = [
  { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/sell', label: 'nav.sell', icon: ShoppingCart },
  { to: '/products', label: 'nav.products', icon: Package },
  { to: '/purchases', label: 'nav.purchases', icon: ShoppingBag },
  { to: '/expenses', label: 'nav.expenses', icon: Layers },
  { to: '/customers', label: 'nav.customers', icon: Users },
  { to: '/reports', label: 'nav.reports', icon: BarChart3 },
  { to: '/settings', label: 'nav.settings', icon: Settings },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { data } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex h-14 items-center px-4 border-b border-slate-200 dark:border-slate-700">
          <span className="font-bold text-primary-700 dark:text-primary-400 text-lg">Juakali</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {SIDEBAR_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
                )
              }
            >
              <link.icon size={18} />
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-1">
          <button
            onClick={() => navigate('/ai')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
          >
            <Bot size={18} />
            {t('nav.aiAssistant')}
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{data?.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{data?.user.email}</p>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t('auth.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 flex pb-safe-bottom">
          {BOTTOM_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-500 dark:text-slate-400',
                )
              }
            >
              <tab.icon size={22} />
              <span>{t(tab.label)}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <OfflineBanner />
    </div>
  );
}
