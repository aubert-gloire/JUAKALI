import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, Receipt, CreditCard, ClipboardList,
  Truck, ShoppingBag, Settings, Bot, LogOut, Bell,
  AlertCircle, Clock, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { creditsApi } from '@/lib/creditsApi';
import { clsx } from 'clsx';

const NAV_SECTIONS = [
  {
    label: 'Sales',
    items: [
      { to: '/sales-history', label: 'Sales History',  icon: ClipboardList, desc: 'View all transactions' },
      { to: '/credits',       label: 'Credits',        icon: CreditCard,    desc: 'Track installment payments' },
      { to: '/customers',     label: 'Customers',      icon: Users,         desc: 'Customer profiles' },
      { to: '/expenses',      label: 'Expenses',       icon: Receipt,       desc: 'Record shop expenses' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/suppliers', label: 'Suppliers',      icon: Truck,       desc: 'Manage your suppliers' },
      { to: '/purchases', label: 'Purchase Orders', icon: ShoppingBag, desc: 'Restock and track orders' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports',  label: 'Reports',      icon: BarChart3, desc: 'P&L, top products, analytics' },
      { to: '/settings', label: 'Settings',     icon: Settings,  desc: 'Shop, staff & account' },
      { to: '/ai',       label: 'AI Assistant', icon: Bot,       desc: 'Ask your shop assistant' },
    ],
  },
];

// ── Notification summary ──────────────────────────────────────────────────────

function NotificationSummary() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['credits', 'reminders'],
    queryFn: creditsApi.reminders,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const overdue = data?.overdueCount ?? 0;
  const today = data?.todayCount ?? 0;
  const total = overdue + today;

  if (total === 0 && !data) return null;

  return (
    <button
      onClick={() => navigate('/credits')}
      className={clsx(
        'w-full flex items-center gap-3 rounded-xl p-4 mb-4 text-left transition-colors',
        total > 0
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
      )}
    >
      <div className={clsx('p-2 rounded-lg', total > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40')}>
        <Bell size={16} className={total > 0 ? 'text-red-600' : 'text-green-600'} />
      </div>
      <div className="flex-1">
        {total > 0 ? (
          <>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {total} payment{total > 1 ? 's' : ''} need{total === 1 ? 's' : ''} attention
            </p>
            <div className="flex gap-3 mt-0.5">
              {overdue > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-red-600">
                  <AlertCircle size={10} /> {overdue} overdue
                </span>
              )}
              {today > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600">
                  <Clock size={10} /> {today} due today
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">All payments on track</p>
        )}
      </div>
      <ChevronRight size={14} className="text-slate-400" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MorePage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { t } = useTranslation();
  const { data: auth } = useAuth();

  const membership = auth?.memberships?.[0];
  const shopName = (membership?.shopId as { name?: string } | undefined)?.name ?? 'Shop';
  const userName = auth?.user?.name ?? '';
  const userRole = membership?.role ?? '';
  const initial = userName[0]?.toUpperCase() ?? '?';

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto">
      {/* User card */}
      <div className="flex items-center gap-3 mb-5 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="h-12 w-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-white">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{userName}</p>
          <p className="text-xs text-slate-400 truncate">{shopName} · <span className="capitalize">{userRole}</span></p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings size={16} />
        </button>
      </div>

      <NotificationSummary />

      {/* Nav sections */}
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 mb-2">
            {section.label}
          </p>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
            {section.items.map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                  <item.icon size={16} className="text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Sign out */}
      <button
        onClick={() => logout.mutate()}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-left"
      >
        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
          <LogOut size={16} className="text-red-600" />
        </div>
        <span className="text-sm font-medium text-red-600">{t('auth.logout')}</span>
      </button>
    </div>
  );
}
