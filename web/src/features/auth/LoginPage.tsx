import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useLogin, useAuth } from '@/hooks/useAuth';
import { clsx } from 'clsx';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: auth, isLoading: authLoading } = useAuth();
  const login = useLogin();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (auth) return <Navigate to={from} replace />;

  const onSubmit = async (data: LoginForm) => {
    try {
      await login.mutateAsync(data);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('locked')) {
        setError('root', { message: msg });
      } else {
        setError('root', { message: t('auth.invalidCredentials') });
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 dark:text-primary-400 mb-1">Juakali</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">PEOPLE'S SHOP</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {t('auth.loginTitle')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {t('auth.loginSubtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label mb-1">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={clsx('input', errors.email && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label mb-1">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={clsx('input', errors.password && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? t('common.loading') : t('auth.login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
