import { useState } from 'react';
import { KeyRound, AlertTriangle } from 'lucide-react';
import { JkLogo } from '@/components/JkLogo';
import { toast } from 'sonner';
import { useSubscription, useRedeemToken } from '@/hooks/useSubscription';
import type { SubscriptionData } from '@/lib/subscriptionApi';

// ── Redeem modal ──────────────────────────────────────────────────────────────

function RedeemModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const redeem = useRedeemToken();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    redeem.mutate(code.trim(), {
      onSuccess: (data) => {
        toast.success(`Access granted! ${data.daysLeft} days remaining.`);
        onClose();
      },
      onError: (err: Error) => toast.error(err.message),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <KeyRound size={18} className="text-primary-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Redeem Access Token</h2>
            <p className="text-xs text-slate-400">Enter the code you received from JUAKALI</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="JK-XXXX-XXXX-XXXX"
            className="input w-full font-mono tracking-widest"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={redeem.isPending || !code.trim()} className="btn btn-primary flex-1">
              {redeem.isPending ? 'Activating…' : 'Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expiry warning banner ─────────────────────────────────────────────────────

export function SubscriptionBanner({ data }: { data: SubscriptionData }) {
  const [showModal, setShowModal] = useState(false);

  if (data.status === 'active' && data.daysLeft > 7) return null;
  if (data.status === 'trialing' && data.daysLeft > 7) return null;

  const isGrace = data.status === 'grace';
  const msg = isGrace
    ? `Your trial ended. You have ${data.graceDaysLeft} grace day(s) left.`
    : `Your ${data.status === 'trialing' ? 'trial' : 'subscription'} expires in ${data.daysLeft} day(s).`;

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
        <AlertTriangle size={13} />
        <span>{msg}</span>
        <button onClick={() => setShowModal(true)} className="ml-auto underline font-medium whitespace-nowrap">
          Redeem token
        </button>
      </div>
      {showModal && <RedeemModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Paywall ───────────────────────────────────────────────────────────────────

function Paywall() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <JkLogo size={36} color="#ffffff" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Your trial has ended</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
          To continue using JUAKALI, redeem an access token.<br />
          Contact us to purchase one.
        </p>

        <button onClick={() => setShowModal(true)} className="btn btn-primary w-full py-3 text-base mb-3">
          <KeyRound size={16} className="mr-2" />
          Redeem Access Token
        </button>

        <p className="text-xs text-slate-400">
          Need a token? WhatsApp{' '}
          <a href="https://wa.me/250788268061" className="text-primary-600 underline">+250 788 268 061</a>
        </p>
      </div>

      {showModal && <RedeemModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Guard ─────────────────────────────────────────────────────────────────────

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { data } = useSubscription();

  if (data?.status === 'expired') return <Paywall />;

  return <>{children}</>;
}
