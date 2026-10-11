import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, LogOut, Plus, RefreshCw, Key, ShoppingBag } from 'lucide-react';
import { JkLogo } from '@/components/JkLogo';
import { clsx } from 'clsx';

// ── Admin API client (uses Authorization header, not cookies) ─────────────────

const ADMIN_TOKEN_KEY = 'jk_admin_token';

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      ...(options?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenRow {
  _id: string;
  code: string;
  plan: string;
  durationDays: number;
  shopId?: { name: string } | null;
  redeemedAt?: string;
  createdAt: string;
}

interface ShopRow {
  _id: string;
  name: string;
  location: string;
  plan: string;
  status: 'trialing' | 'active' | 'grace' | 'expired';
  trialEndsAt?: string;
  accessExpiry?: string;
  createdAt: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await adminFetch<{ token: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      onLogin();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4 shadow-lg">
            <JkLogo size={32} color="#ffffff" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Platform Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to manage tokens and shops</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Admin email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@juakali.rw"
                className="input mt-1"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input mt-1"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">JUAKALI Platform v1.0</p>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ShopRow['status'] }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide', {
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400': status === 'active',
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400': status === 'trialing',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': status === 'grace',
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400': status === 'expired',
    })}>
      {status}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'tokens' | 'shops'>('tokens');
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [genPlan, setGenPlan] = useState<string>('lifetime');
  const [genCount, setGenCount] = useState(1);
  const [genNotes, setGenNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [tokenFilter, setTokenFilter] = useState<'all' | 'available' | 'redeemed'>('all');
  const [grantShopId, setGrantShopId] = useState('');
  const [grantDays, setGrantDays] = useState(30);

  async function loadTokens() {
    setLoadingData(true);
    try {
      const res = await adminFetch<{ tokens: TokenRow[] }>(`/tokens?status=${tokenFilter}`);
      setTokens(res.tokens);
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoadingData(false); }
  }

  async function loadShops() {
    setLoadingData(true);
    try {
      const res = await adminFetch<{ shops: ShopRow[] }>('/shops');
      setShops(res.shops);
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoadingData(false); }
  }

  useState(() => { loadTokens(); });

  function handleTabChange(t: 'tokens' | 'shops') {
    setTab(t);
    if (t === 'tokens') loadTokens();
    else loadShops();
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await adminFetch<{ tokens: { code: string; plan: string }[] }>('/tokens', {
        method: 'POST',
        body: JSON.stringify({ plan: genPlan, count: genCount, notes: genNotes || undefined }),
      });
      toast.success(`Generated ${res.tokens.length} token(s)`);
      setGenNotes('');
      loadTokens();
    } catch (err) { toast.error((err as Error).message); }
    finally { setGenerating(false); }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch(`/shops/${grantShopId}/grant`, {
        method: 'PATCH',
        body: JSON.stringify({ days: grantDays }),
      });
      toast.success(`Granted ${grantDays} days`);
      setGrantShopId('');
      loadShops();
    } catch (err) { toast.error((err as Error).message); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  }

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const TABS = [
    { id: 'tokens' as const, label: 'Access Tokens', icon: Key },
    { id: 'shops'  as const, label: 'Shops',         icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top nav */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600">
              <JkLogo size={20} color="#ffffff" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">JUAKALI</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Platform Admin</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors font-medium"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tokens tab ───────────────────────────────────────────────────────── */}
        {tab === 'tokens' && (
          <div className="space-y-5">
            {/* Generate form */}
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Generate Tokens</h2>
              <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label">Plan</label>
                  <select
                    value={genPlan}
                    onChange={(e) => setGenPlan(e.target.value)}
                    className="input mt-1 w-auto"
                  >
                    <option value="monthly">Monthly (30 days)</option>
                    <option value="quarterly">Quarterly (90 days)</option>
                    <option value="yearly">Yearly (365 days)</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
                <div>
                  <label className="label">Count</label>
                  <input
                    type="number" min={1} max={100}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="input mt-1 w-20 text-center"
                  />
                </div>
                <div className="flex-1 min-w-40">
                  <label className="label">Notes <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={genNotes}
                    onChange={(e) => setGenNotes(e.target.value)}
                    placeholder="e.g. Sold to Musa via MoMo"
                    className="input mt-1 w-full"
                  />
                </div>
                <button type="submit" disabled={generating} className="btn-primary gap-1.5 disabled:opacity-50">
                  <Plus size={14} /> {generating ? 'Generating…' : 'Generate'}
                </button>
              </form>
            </div>

            {/* Token list */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex gap-1">
                  {(['all', 'available', 'redeemed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setTokenFilter(f); setTimeout(loadTokens, 0); }}
                      className={clsx(
                        'px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                        tokenFilter === f
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={loadTokens} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
                  <RefreshCw size={14} className={clsx(loadingData && 'animate-spin')} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Code</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Plan</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Days</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Redeemed by</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {tokens.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                          No tokens yet — generate some above
                        </td>
                      </tr>
                    )}
                    {tokens.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{t.code}</span>
                            <button
                              onClick={() => copyCode(t.code)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              title="Copy code"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 capitalize">{t.plan}</td>
                        <td className="px-4 py-3 text-slate-500 tabular-nums">{t.durationDays}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            t.shopId
                              ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          )}>
                            {t.shopId ? 'Redeemed' : 'Available'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {t.shopId ? (typeof t.shopId === 'object' ? t.shopId.name : '—') : '—'}
                          {t.redeemedAt && <span className="block text-slate-400">{fmtDate(t.redeemedAt)}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Shops tab ────────────────────────────────────────────────────────── */}
        {tab === 'shops' && (
          <div className="space-y-5">
            {/* Manual grant */}
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Manual Access Grant</h2>
              <form onSubmit={handleGrant} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-52">
                  <label className="label">Shop ID</label>
                  <input
                    type="text"
                    value={grantShopId}
                    onChange={(e) => setGrantShopId(e.target.value)}
                    placeholder="MongoDB ObjectId (copy from table below)"
                    className="input mt-1 w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="label">Days</label>
                  <input
                    type="number" min={1}
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value))}
                    className="input mt-1 w-24 text-center"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!grantShopId.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  Grant Access
                </button>
              </form>
            </div>

            {/* Shops list */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">All Shops</span>
                <button onClick={loadShops} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
                  <RefreshCw size={14} className={clsx(loadingData && 'animate-spin')} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Shop</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Plan</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Trial ends</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Access until</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {shops.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                          No shops registered yet
                        </td>
                      </tr>
                    )}
                    {shops.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.location}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 capitalize text-xs">{s.plan}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(s.trialEndsAt)}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(s.accessExpiry)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { navigator.clipboard.writeText(s._id); toast.success('ID copied'); }}
                            className="font-mono text-xs text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 transition-colors"
                            title="Copy full ID"
                          >
                            {s._id.slice(-8)} <Copy size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AdminPage() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(ADMIN_TOKEN_KEY));

  function handleLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAuthed(false);
  }

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />;
  return <Dashboard onLogout={handleLogout} />;
}
