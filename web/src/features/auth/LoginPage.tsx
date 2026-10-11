import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useAuth } from '@/hooks/useAuth';
import { clsx } from 'clsx';
import { Package, TrendingUp, ShieldCheck } from 'lucide-react';
import { JkLogo } from '@/components/JkLogo';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof schema>;

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-orange-600 p-12 text-white relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-500/40" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-orange-700/40" />
      <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-orange-500/20" />

      {/* Brand */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <JkLogo size={40} color="#ffffff" />
          <h1 className="text-4xl font-extrabold tracking-tight">JUAKALI</h1>
        </div>
        <p className="mt-1 text-orange-200 text-sm font-medium tracking-widest uppercase">Smart Inventory</p>
      </div>

      {/* Value props */}
      <div className="relative z-10 space-y-6">
        <p className="text-2xl font-bold leading-snug">
          Run your shop smarter.<br />
          <span className="text-orange-200">Know your numbers.</span>
        </p>

        <div className="space-y-4">
          {[
            { icon: Package, text: 'Track every product in real-time' },
            { icon: TrendingUp, text: 'See profit on every sale instantly' },
            { icon: ShieldCheck, text: 'Manage staff with role-based access' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Icon size={16} />
              </div>
              <p className="text-sm text-orange-100">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer tagline */}
      <p className="relative z-10 text-xs text-orange-300">
        Trusted by spare parts shops across Rwanda
      </p>
    </div>
  );
}

export function LoginPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
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
        setError('root', { message: 'Invalid email or password' });
      }
    }
  };

  return (
    <div className="flex min-h-screen">
      <BrandPanel />

      {/* Right: login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white dark:bg-slate-900">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <JkLogo size={32} />
            <h1 className="text-3xl font-extrabold text-orange-600">JUAKALI</h1>
          </div>
          <p className="text-xs text-slate-400 tracking-widest uppercase mt-0.5">Smart Inventory</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your shop</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="label mb-1">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={clsx('input', errors.email && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label mb-1">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={clsx('input', errors.password && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
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
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400">
              Create your shop
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
