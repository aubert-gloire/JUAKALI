import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useChangePassword } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10, 'Password must be at least 10 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  forced?: boolean;
}

export function ChangePasswordPage({ forced }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const changePw = useChangePassword();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await changePw.mutateAsync({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('root', { message: (err as Error).message });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="card">
          <h2 className="text-xl font-semibold mb-1">{t('auth.changePassword')}</h2>
          {forced && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
              {t('auth.mustChangePassword')}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="label mb-1">{t('auth.currentPassword')}</label>
              <input
                type="password"
                autoComplete="current-password"
                className={clsx('input', errors.currentPassword && 'border-red-500')}
                {...register('currentPassword')}
              />
            </div>

            <div>
              <label className="label mb-1">{t('auth.newPassword')}</label>
              <input
                type="password"
                autoComplete="new-password"
                className={clsx('input', errors.newPassword && 'border-red-500')}
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="label mb-1">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                className={clsx('input', errors.confirmPassword && 'border-red-500')}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {errors.root.message}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? t('common.loading') : t('auth.changePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
