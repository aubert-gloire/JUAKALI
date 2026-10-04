import { useTranslation } from 'react-i18next';

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        {t('dashboard.title')}
      </h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.todaySales'), value: 'RWF 0', color: 'text-green-600' },
          { label: t('dashboard.todayProfit'), value: 'RWF 0', color: 'text-blue-600' },
          { label: t('dashboard.totalExpenses'), value: 'RWF 0', color: 'text-red-600' },
          { label: t('dashboard.lowStock'), value: '0', color: 'text-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-400 text-center">
        Phase 1 — Dashboard charts coming in Phase 4
      </p>
    </div>
  );
}
