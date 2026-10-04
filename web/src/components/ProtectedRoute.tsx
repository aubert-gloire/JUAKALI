import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';

export function ProtectedRoute() {
  const { data, isLoading, isError } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change before accessing any other page
  if (data.user.mustChangePassword && location.pathname !== '/change-password') {
    return <ChangePasswordPage forced />;
  }

  return <Outlet />;
}
