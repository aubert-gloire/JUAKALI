import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRegister, useAuth } from '@/hooks/useAuth';
import { clsx } from 'clsx';
import { Package, TrendingUp, ShieldCheck, ArrowLeft } from 'lucide-react';
import { JkLogo } from '@/components/JkLogo';

// ── Schemas ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const step2Schema = z.object({
  shopName: z.string().min(2, 'Shop name is required'),
  shopLocation: z.string().min(2, 'Location is required'),
  shopPhone: z.string().optional(),
});

type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;

// ── Brand panel (same as LoginPage) ──────────────────────────────────────────

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-orange-600 p-12 text-white relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-500/40" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-orange-700/40" />
      <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-orange-500/20" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <JkLogo size={40} color="#ffffff" />
          <h1 className="text-4xl font-extrabold tracking-tight">JUAKALI</h1>
        </div>
        <p className="mt-1 text-orange-200 text-sm font-medium tracking-widest uppercase">Smart Inventory</p>
      </div>

      <div className="relative z-10 space-y-6">
        <p className="text-2xl font-bold leading-snug">
          Set up your shop<br />
          <span className="text-orange-200">in 2 minutes.</span>
        </p>

        <div className="space-y-4">
          {[
            { icon: Package, text: 'Add products and track stock' },
            { icon: TrendingUp, text: 'Sell and record every transaction' },
            { icon: ShieldCheck, text: 'Invite staff with the right permissions' },
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

      <p className="relative z-10 text-xs text-orange-300">Free to get started · No credit card required</p>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              n < current
                ? 'bg-orange-600 text-white'
                : n === current
                  ? 'bg-orange-600 text-white ring-4 ring-orange-100'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
            )}
          >
            {n < current ? '✓' : n}
          </div>
          {n < 2 && (
            <div className={clsx('w-10 h-0.5', n < current ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-700')} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-slate-400">Step {current} of 2</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SignupPage() {
  const navigate = useNavigate();
  const { data: auth, isLoading: authLoading } = useAuth();
  const register_ = useRegister();

  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Form | null>(null);

  const form1 = useForm<Step1Form>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Form>({ resolver: zodResolver(step2Schema) });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  if (auth) return <Navigate to="/dashboard" replace />;

  const onStep1 = (data: Step1Form) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2 = async (data: Step2Form) => {
    if (!step1Data) return;
    try {
      await register_.mutateAsync({ ...step1Data, ...data });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? 'Something went wrong';
      form2.setError('root', { message: msg });
    }
  };

  return (
    <div className="flex min-h-screen">
      <BrandPanel />

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
          <StepIndicator current={step} />

          {step === 1 && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">First, tell us about you</p>
              </div>

              <form onSubmit={form1.handleSubmit(onStep1)} noValidate className="space-y-4">
                <div>
                  <label htmlFor="name" className="label mb-1">Full name</label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jean-Paul Habimana"
                    className={clsx('input', form1.formState.errors.name && 'border-red-500')}
                    {...form1.register('name')}
                  />
                  {form1.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-600">{form1.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="signup-email" className="label mb-1">Email address</label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={clsx('input', form1.formState.errors.email && 'border-red-500')}
                    {...form1.register('email')}
                  />
                  {form1.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-600">{form1.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="signup-password" className="label mb-1">Password</label>
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    className={clsx('input', form1.formState.errors.password && 'border-red-500')}
                    {...form1.register('password')}
                  />
                  {form1.formState.errors.password && (
                    <p className="mt-1 text-xs text-red-600">{form1.formState.errors.password.message}</p>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full">
                  Continue
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-3"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Set up your shop</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tell us about your business</p>
              </div>

              <form onSubmit={form2.handleSubmit(onStep2)} noValidate className="space-y-4">
                <div>
                  <label htmlFor="shopName" className="label mb-1">Shop name</label>
                  <input
                    id="shopName"
                    type="text"
                    placeholder="e.g. Toyota Parts Kacyiru"
                    className={clsx('input', form2.formState.errors.shopName && 'border-red-500')}
                    {...form2.register('shopName')}
                  />
                  {form2.formState.errors.shopName && (
                    <p className="mt-1 text-xs text-red-600">{form2.formState.errors.shopName.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="shopLocation" className="label mb-1">Location</label>
                  <input
                    id="shopLocation"
                    type="text"
                    placeholder="e.g. Kacyiru, Kigali"
                    className={clsx('input', form2.formState.errors.shopLocation && 'border-red-500')}
                    {...form2.register('shopLocation')}
                  />
                  {form2.formState.errors.shopLocation && (
                    <p className="mt-1 text-xs text-red-600">{form2.formState.errors.shopLocation.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="shopPhone" className="label mb-1">
                    Phone number <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="shopPhone"
                    type="tel"
                    placeholder="+250 7XX XXX XXX"
                    className="input"
                    {...form2.register('shopPhone')}
                  />
                </div>

                {form2.formState.errors.root && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {form2.formState.errors.root.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={register_.isPending}
                  className="btn-primary w-full"
                >
                  {register_.isPending ? 'Creating your shop…' : 'Create shop & sign in'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
