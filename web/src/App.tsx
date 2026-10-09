import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Suspense } from 'react';
import { queryClient } from '@/lib/queryClient';
import '@/i18n';
import '@/styles/globals.css';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { SuppliersPage } from '@/features/suppliers/SuppliersPage';
import { PurchasesPage } from '@/features/purchases/PurchasesPage';
import { SellPage } from '@/features/pos/SellPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { SalesHistoryPage } from '@/features/sales/SalesHistoryPage';
import { CreditsPage } from '@/features/credits/CreditsPage';

function AppSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">Coming in a future phase.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<AppSkeleton />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"  element={<DashboardPage />} />
                <Route path="/products"   element={<ProductsPage />} />
                <Route path="/suppliers"  element={<SuppliersPage />} />
                <Route path="/purchases"  element={<PurchasesPage />} />
                <Route path="/sell"       element={<SellPage />} />
                <Route path="/expenses"   element={<ExpensesPage />} />
                <Route path="/customers"  element={<CustomersPage />} />
                <Route path="/sales-history" element={<SalesHistoryPage />} />
                <Route path="/credits"    element={<CreditsPage />} />
                <Route path="/reports"    element={<PlaceholderPage title="Reports" />} />
                <Route path="/settings"   element={<PlaceholderPage title="Settings" />} />
                <Route path="/more"       element={<PlaceholderPage title="More" />} />
                <Route path="/ai"         element={<PlaceholderPage title="AI Assistant" />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
